/**
 * Emergency Meta Tag Injection Engine
 * Applies real-time hotfixes to HTML without code deployment
 */

import cache from '../cache';
import configManager from './config-manager';
import { Logger } from '../utils/logger';

interface HotfixRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  priority: number; // Higher number = higher priority
  urlPattern: string; // Regex or glob pattern
  conditions: {
    userAgent?: string; // User agent pattern
    headers?: Record<string, string>; // Header patterns
    query?: Record<string, string>; // Query parameter patterns
  };
  actions: HotfixAction[];
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  expiresAt?: Date;
}

interface HotfixAction {
  type: 'replace' | 'prepend' | 'append' | 'remove' | 'attribute';
  selector: string; // CSS selector or regex for content matching
  target?: string; // Attribute name or new content
  value?: string; // New value or content
  regex?: string; // Regex pattern for matching
  flags?: string; // Regex flags
}

interface HotfixResult {
  applied: boolean;
  matchedRules: Array<{
    ruleId: string;
    ruleName: string;
    actions: number;
  }>;
  html: string;
  processingTime: number;
}

interface HotfixTest {
  url: string;
  originalHtml: string;
  hotfixedHtml: string;
  result: HotfixResult;
  timestamp: Date;
}

class HotfixEngine {
  private logger = new Logger('HotfixEngine');
  private rules: Map<string, HotfixRule> = new Map();
  private testHistory: HotfixTest[] = [];

  constructor() {
    this.loadRules();
  }

  /**
   * Load hotfix rules from configuration
   */
  private async loadRules(): Promise<void> {
    try {
      const config = configManager.getConfig();
      const hotfixRules = config.hotfixRules || [];

      this.rules.clear();
      for (const rule of hotfixRules) {
        this.rules.set(rule.id, {
          ...rule,
          createdAt: new Date(rule.createdAt),
          updatedAt: new Date(rule.updatedAt),
          expiresAt: rule.expiresAt ? new Date(rule.expiresAt) : undefined,
        });
      }

      this.logger.info(`Loaded ${this.rules.size} hotfix rules`);
    } catch (error) {
      this.logger.error('Failed to load hotfix rules:', error);
    }
  }

  /**
   * Save hotfix rules to configuration
   */
  private async saveRules(): Promise<void> {
    try {
      const rulesArray = Array.from(this.rules.values()).map((rule) => ({
        ...rule,
        createdAt: rule.createdAt.toISOString(),
        updatedAt: rule.updatedAt.toISOString(),
        expiresAt: rule.expiresAt?.toISOString(),
      }));

      await configManager.updateConfig({
        hotfixRules: rulesArray,
      });

      this.logger.info('Saved hotfix rules to configuration');
    } catch (error) {
      this.logger.error('Failed to save hotfix rules:', error);
      throw error;
    }
  }

  /**
   * Apply hotfix rules to HTML content
   */
  async applyHotfixes(
    html: string,
    url: string,
    headers: Record<string, string> = {}
  ): Promise<HotfixResult> {
    const startTime = Date.now();
    const result: HotfixResult = {
      applied: false,
      matchedRules: [],
      html,
      processingTime: 0,
    };

    try {
      // Get applicable rules
      const applicableRules = this.getApplicableRules(url, headers);

      if (applicableRules.length === 0) {
        result.processingTime = Date.now() - startTime;
        return result;
      }

      let modifiedHtml = html;
      const appliedRules: typeof result.matchedRules = [];

      // Sort rules by priority (highest first)
      applicableRules.sort((a, b) => b.priority - a.priority);

      for (const rule of applicableRules) {
        let ruleModified = false;
        let appliedActions = 0;

        for (const action of rule.actions) {
          try {
            const actionResult = this.applyAction(modifiedHtml, action);
            if (actionResult.changed) {
              modifiedHtml = actionResult.html;
              ruleModified = true;
              appliedActions++;
            }
          } catch (error) {
            this.logger.warn(`Failed to apply action for rule ${rule.id}:`, error);
          }
        }

        if (ruleModified) {
          appliedRules.push({
            ruleId: rule.id,
            ruleName: rule.name,
            actions: appliedActions,
          });
        }
      }

      result.applied = appliedRules.length > 0;
      result.matchedRules = appliedRules;
      result.html = modifiedHtml;
      result.processingTime = Date.now() - startTime;

      this.logger.debug(`Applied ${appliedRules.length} hotfix rules for ${url}`);
      return result;
    } catch (error) {
      this.logger.error('Failed to apply hotfixes:', error);
      result.processingTime = Date.now() - startTime;
      return result;
    }
  }

  /**
   * Get rules that match the given URL and conditions
   */
  private getApplicableRules(url: string, headers: Record<string, string>): HotfixRule[] {
    const applicableRules: HotfixRule[] = [];

    for (const rule of this.rules.values()) {
      // Check if rule is enabled
      if (!rule.enabled) continue;

      // Check if rule has expired
      if (rule.expiresAt && new Date() > rule.expiresAt) continue;

      // Check URL pattern
      if (!this.matchPattern(url, rule.urlPattern)) continue;

      // Check user agent condition
      if (rule.conditions.userAgent && headers['user-agent']) {
        if (!this.matchPattern(headers['user-agent'], rule.conditions.userAgent)) continue;
      }

      // Check header conditions
      if (rule.conditions.headers) {
        let headerMatch = true;
        for (const [key, pattern] of Object.entries(rule.conditions.headers)) {
          const headerValue = headers[key.toLowerCase()];
          if (!headerValue || !this.matchPattern(headerValue, pattern)) {
            headerMatch = false;
            break;
          }
        }
        if (!headerMatch) continue;
      }

      applicableRules.push(rule);
    }

    return applicableRules;
  }

  /**
   * Apply a single hotfix action
   */
  private applyAction(html: string, action: HotfixAction): { html: string; changed: boolean } {
    const { type, selector, target, value, regex, flags } = action;
    let changed = false;

    switch (type) {
      case 'replace':
        if (regex) {
          const reg = new RegExp(regex, flags || 'g');
          const newHtml = html.replace(reg, value || '');
          changed = newHtml !== html;
          return { html: newHtml, changed };
        } else {
          // Simple string replacement
          const newHtml = html.replace(new RegExp(selector, 'g'), value || '');
          changed = newHtml !== html;
          return { html: newHtml, changed };
        }

      case 'prepend':
        const prependRegex = new RegExp(`(<${selector}[^>]*>)`, flags || 'i');
        const prependedHtml = html.replace(prependRegex, `$1${value || ''}`);
        changed = prependedHtml !== html;
        return { html: prependedHtml, changed };

      case 'append':
        const appendRegex = new RegExp(
          `(<${selector}[^>]*>.*?</${selector}>)(?![^<]*</${selector}>)`,
          flags || 'is'
        );
        const appendedHtml = html.replace(appendRegex, `$1${value || ''}`);
        changed = appendedHtml !== html;
        return { html: appendedHtml, changed };

      case 'remove':
        if (target) {
          // Remove specific attribute
          const attrRegex = new RegExp(`\\s+${target}="[^"]*"`, 'gi');
          const attrRemovedHtml = html.replace(attrRegex, '');
          changed = attrRemovedHtml !== html;
          return { html: attrRemovedHtml, changed };
        } else {
          // Remove element or content
          const removeRegex = new RegExp(selector, flags || 'gis');
          const removedHtml = html.replace(removeRegex, '');
          changed = removedHtml !== html;
          return { html: removedHtml, changed };
        }

      case 'attribute':
        if (target && value) {
          // Add or update attribute
          const attrRegex = new RegExp(`(<${selector}[^>]*)(>)`, flags || 'i');
          const attrUpdatedHtml = html.replace(attrRegex, `$1 ${target}="${value}"$2`);
          changed = attrUpdatedHtml !== html;
          return { html: attrUpdatedHtml, changed };
        }
        break;
    }

    return { html, changed };
  }

  /**
   * Check if a pattern matches a string
   */
  private matchPattern(str: string, pattern: string): boolean {
    try {
      // Try as regex first
      new RegExp(pattern);
      return new RegExp(pattern).test(str);
    } catch {
      // If not a valid regex, do simple string matching
      return str.includes(pattern);
    }
  }

  /**
   * Create a new hotfix rule
   */
  async createRule(
    ruleData: Omit<HotfixRule, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<HotfixRule> {
    const rule: HotfixRule = {
      ...ruleData,
      id: `hotfix_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.rules.set(rule.id, rule);
    await this.saveRules();

    this.logger.info(`Created hotfix rule: ${rule.name}`);
    return rule;
  }

  /**
   * Update an existing hotfix rule
   */
  async updateRule(
    id: string,
    updates: Partial<Omit<HotfixRule, 'id' | 'createdAt'>>
  ): Promise<HotfixRule | null> {
    const existingRule = this.rules.get(id);
    if (!existingRule) return null;

    const updatedRule: HotfixRule = {
      ...existingRule,
      ...updates,
      id,
      createdAt: existingRule.createdAt,
      updatedAt: new Date(),
    };

    this.rules.set(id, updatedRule);
    await this.saveRules();

    this.logger.info(`Updated hotfix rule: ${updatedRule.name}`);
    return updatedRule;
  }

  /**
   * Delete a hotfix rule
   */
  async deleteRule(id: string): Promise<boolean> {
    const deleted = this.rules.delete(id);
    if (deleted) {
      await this.saveRules();
      this.logger.info(`Deleted hotfix rule: ${id}`);
    }
    return deleted;
  }

  /**
   * Get all hotfix rules
   */
  getRules(): HotfixRule[] {
    return Array.from(this.rules.values()).sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get a specific hotfix rule
   */
  getRule(id: string): HotfixRule | null {
    return this.rules.get(id) || null;
  }

  /**
   * Test hotfix rules on a URL
   */
  async testHotfix(url: string): Promise<HotfixTest> {
    try {
      // Get the original HTML from cache or by fetching
      let originalHtml = '';
      const cached = cache.get(url);

      if (cached) {
        try {
          const cacheEntry = typeof cached === 'string' ? JSON.parse(cached) : cached;
          originalHtml = cacheEntry.html || '';
        } catch {
          // If cache parsing fails, treat as raw HTML
          originalHtml = typeof cached === 'string' ? cached : '';
        }
      } else {
        // Fetch the page directly
        const response = await fetch(url);
        originalHtml = await response.text();
      }

      // Apply hotfixes
      const result = await this.applyHotfixes(originalHtml, url);

      const test: HotfixTest = {
        url,
        originalHtml,
        hotfixedHtml: result.html,
        result,
        timestamp: new Date(),
      };

      // Store in test history (keep last 100)
      this.testHistory.unshift(test);
      if (this.testHistory.length > 100) {
        this.testHistory = this.testHistory.slice(0, 100);
      }

      this.logger.info(`Tested hotfix for ${url}: ${result.applied ? 'applied' : 'no changes'}`);
      return test;
    } catch (error) {
      this.logger.error(`Failed to test hotfix for ${url}:`, error);
      throw error;
    }
  }

  /**
   * Get test history
   */
  getTestHistory(limit: number = 20): HotfixTest[] {
    return this.testHistory.slice(0, limit);
  }

  /**
   * Enable/disable a rule
   */
  async toggleRule(id: string): Promise<boolean> {
    const rule = this.rules.get(id);
    if (!rule) return false;

    rule.enabled = !rule.enabled;
    rule.updatedAt = new Date();

    await this.saveRules();
    this.logger.info(`${rule.enabled ? 'Enabled' : 'Disabled'} hotfix rule: ${rule.name}`);
    return true;
  }

  /**
   * Get rule statistics
   */
  getStats(): {
    total: number;
    enabled: number;
    disabled: number;
    expired: number;
  } {
    const rules = Array.from(this.rules.values());
    const now = new Date();

    return {
      total: rules.length,
      enabled: rules.filter((r) => r.enabled).length,
      disabled: rules.filter((r) => !r.enabled).length,
      expired: rules.filter((r) => r.expiresAt && r.expiresAt < now).length,
    };
  }
}

export default new HotfixEngine();
