/**
 * Request Blocking/Interceptor Manager
 * Dynamic request blocking with real-time rule management
 */

import configManager from './config-manager';
import { Logger } from '../utils/logger';

interface BlockingRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  type: 'domain' | 'url' | 'pattern' | 'resource';
  pattern: string; // Domain, URL pattern, regex, or resource type
  action: 'block' | 'redirect' | 'modify';
  options?: {
    redirectUrl?: string;
    modifyHeaders?: Record<string, string>;
    responseCode?: number;
    responseText?: string;
  };
  priority: number; // Higher = more priority
  stats: {
    blockedCount: number;
    lastBlocked?: Date;
    totalRequests: number;
  };
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

interface BlockingStats {
  totalRules: number;
  enabledRules: number;
  activeRules: number; // Alias for enabledRules (for frontend compatibility)
  totalBlocked: number;
  totalAllowed: number; // For frontend compatibility
  todayBlocked: number;
  blockedToday: number; // Alias for todayBlocked (for frontend compatibility)
  mostBlockedPattern: string; // For frontend compatibility
  topBlocked: Array<{
    pattern: string;
    count: number;
    type: string;
  }>;
  performanceImpact: {
    averageLatency: number; // ms saved per request
    bandwidthSaved: number; // bytes saved
  };
}

interface BlockingTest {
  url: string;
  userAgent?: string;
  headers?: Record<string, string>;
  results: {
    blocked: boolean;
    matchedRule?: string;
    action?: string;
    responseTime: number;
  };
  timestamp: Date;
}

class BlockingManager {
  private logger = new Logger('BlockingManager');
  private rules: Map<string, BlockingRule> = new Map();
  private testHistory: BlockingTest[] = [];

  constructor() {
    this.loadRules();
  }

  /**
   * Load blocking rules from configuration
   */
  private async loadRules(): Promise<void> {
    try {
      const config = configManager.getConfig();
      const blockingRules = config.blockingRules || [];

      this.rules.clear();
      for (const rule of blockingRules) {
        this.rules.set(rule.id, {
          ...rule,
          createdAt: new Date(rule.createdAt),
          updatedAt: new Date(rule.updatedAt),
          expiresAt: rule.expiresAt ? new Date(rule.expiresAt) : undefined,
          stats: rule.stats || {
            blockedCount: 0,
            totalRequests: 0,
          },
        });
      }

      this.logger.info(`Loaded ${this.rules.size} blocking rules`);
    } catch (error) {
      this.logger.error('Failed to load blocking rules:', error);
    }
  }

  /**
   * Save blocking rules to configuration
   */
  private async saveRules(): Promise<void> {
    try {
      const rulesArray = Array.from(this.rules.values()).map(rule => ({
        ...rule,
        createdAt: rule.createdAt.toISOString(),
        updatedAt: rule.updatedAt.toISOString(),
        expiresAt: rule.expiresAt?.toISOString(),
      }));

      await configManager.updateConfig({
        blockingRules: rulesArray,
      });

      this.logger.info('Saved blocking rules to configuration');
    } catch (error) {
      this.logger.error('Failed to save blocking rules:', error);
      throw error;
    }
  }

  /**
   * Check if a request should be blocked
   */
  shouldBlockRequest(url: string, resourceType: string = 'other'): {
    blocked: boolean;
    rule?: BlockingRule;
    action?: string;
    options?: any;
  } {
    const applicableRules = this.getApplicableRules(url, resourceType);

    if (applicableRules.length === 0) {
      return { blocked: false };
    }

    // Sort by priority (highest first)
    applicableRules.sort((a, b) => b.priority - a.priority);

    const rule = applicableRules[0];

    // Update stats
    rule.stats.blockedCount++;
    rule.stats.lastBlocked = new Date();
    rule.stats.totalRequests++;

    this.logger.debug(`Blocked request: ${url} by rule: ${rule.name}`);

    return {
      blocked: true,
      rule,
      action: rule.action,
      options: rule.options,
    };
  }

  /**
   * Get rules that apply to a request
   */
  private getApplicableRules(url: string, resourceType: string): BlockingRule[] {
    const applicableRules: BlockingRule[] = [];
    const now = new Date();

    for (const rule of this.rules.values()) {
      // Check if rule is enabled
      if (!rule.enabled) continue;

      // Check if rule has expired
      if (rule.expiresAt && now > rule.expiresAt) continue;

      // Check if rule matches
      if (this.ruleMatches(rule, url, resourceType)) {
        applicableRules.push(rule);
      }
    }

    return applicableRules;
  }

  /**
   * Check if a rule matches a request
   */
  private ruleMatches(rule: BlockingRule, url: string, resourceType: string): boolean {
    try {
      switch (rule.type) {
        case 'domain':
          return new URL(url).hostname.includes(rule.pattern) ||
                 new URL(url).hostname.endsWith(rule.pattern);

        case 'url':
          return url.includes(rule.pattern) || this.matchesPattern(url, rule.pattern);

        case 'pattern':
          return new RegExp(rule.pattern).test(url);

        case 'resource':
          return resourceType === rule.pattern ||
                 this.matchesPattern(resourceType, rule.pattern);

        default:
          return false;
      }
    } catch (error) {
      this.logger.warn(`Error matching rule ${rule.name}:`, error);
      return false;
    }
  }

  /**
   * Simple pattern matching (supports wildcards)
   */
  private matchesPattern(str: string, pattern: string): boolean {
    if (!pattern.includes('*')) {
      return str === pattern;
    }

    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');

    return new RegExp(`^${regexPattern}$`).test(str);
  }

  /**
   * Create a new blocking rule
   */
  async createRule(ruleData: Omit<BlockingRule, 'id' | 'createdAt' | 'updatedAt' | 'stats'>): Promise<BlockingRule> {
    const rule: BlockingRule = {
      ...ruleData,
      id: `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      stats: {
        blockedCount: 0,
        totalRequests: 0,
      },
    };

    this.rules.set(rule.id, rule);
    await this.saveRules();

    this.logger.info(`Created blocking rule: ${rule.name}`);
    return rule;
  }

  /**
   * Update an existing blocking rule
   */
  async updateRule(id: string, updates: Partial<Omit<BlockingRule, 'id' | 'createdAt' | 'stats'>>): Promise<BlockingRule | null> {
    const existingRule = this.rules.get(id);
    if (!existingRule) return null;

    const updatedRule: BlockingRule = {
      ...existingRule,
      ...updates,
      id,
      createdAt: existingRule.createdAt,
      updatedAt: new Date(),
      stats: existingRule.stats, // Preserve stats
    };

    this.rules.set(id, updatedRule);
    await this.saveRules();

    this.logger.info(`Updated blocking rule: ${updatedRule.name}`);
    return updatedRule;
  }

  /**
   * Delete a blocking rule
   */
  async deleteRule(id: string): Promise<boolean> {
    const rule = this.rules.get(id);
    if (!rule) return false;

    const deleted = this.rules.delete(id);
    if (deleted) {
      await this.saveRules();
      this.logger.info(`Deleted blocking rule: ${rule.name}`);
    }
    return deleted;
  }

  /**
   * Toggle a rule on/off
   */
  async toggleRule(id: string): Promise<boolean> {
    const rule = this.rules.get(id);
    if (!rule) return false;

    rule.enabled = !rule.enabled;
    rule.updatedAt = new Date();

    await this.saveRules();
    this.logger.info(`${rule.enabled ? 'Enabled' : 'Disabled'} blocking rule: ${rule.name}`);
    return true;
  }

  /**
   * Get all blocking rules
   */
  getRules(): BlockingRule[] {
    return Array.from(this.rules.values()).sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get a specific blocking rule
   */
  getRule(id: string): BlockingRule | null {
    return this.rules.get(id) || null;
  }

  /**
   * Test blocking rules on a URL
   */
  async testBlocking(url: string, userAgent?: string, headers?: Record<string, string>): Promise<BlockingTest> {
    const startTime = Date.now();
    const result = this.shouldBlockRequest(url);
    const responseTime = Date.now() - startTime;

    const test: BlockingTest = {
      url,
      userAgent,
      headers,
      results: {
        blocked: result.blocked,
        matchedRule: result.rule?.name,
        action: result.action,
        responseTime,
      },
      timestamp: new Date(),
    };

    // Store in test history (keep last 100)
    this.testHistory.unshift(test);
    if (this.testHistory.length > 100) {
      this.testHistory = this.testHistory.slice(0, 100);
    }

    // Update rule stats
    if (result.rule) {
      result.rule.stats.totalRequests++;
    }

    this.logger.info(`Tested blocking for ${url}: ${result.blocked ? 'blocked' : 'allowed'}`);
    return test;
  }

  /**
   * Get test history
   */
  getTestHistory(limit: number = 20): BlockingTest[] {
    return this.testHistory.slice(0, limit);
  }

  /**
   * Get blocking statistics
   */
  getStats(): BlockingStats {
    const rules = Array.from(this.rules.values());
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let totalBlocked = 0;
    let todayBlocked = 0;
    const topBlocked: Array<{ pattern: string; count: number; type: string }> = [];

    for (const rule of rules) {
      totalBlocked += rule.stats.blockedCount;

      // Count today's blocked (approximate)
      if (rule.stats.lastBlocked && rule.stats.lastBlocked >= today) {
        todayBlocked += rule.stats.blockedCount;
      }

      if (rule.stats.blockedCount > 0) {
        topBlocked.push({
          pattern: rule.pattern,
          count: rule.stats.blockedCount,
          type: rule.type,
        });
      }
    }

    // Sort top blocked
    topBlocked.sort((a, b) => b.count - a.count);

    const enabledRules = rules.filter(r => r.enabled).length;
    const topBlockedList = topBlocked.slice(0, 10);

    return {
      totalRules: rules.length,
      enabledRules,
      activeRules: enabledRules, // Alias for frontend
      totalBlocked,
      totalAllowed: 0, // Not tracked, default to 0
      todayBlocked,
      blockedToday: todayBlocked, // Alias for frontend
      mostBlockedPattern: topBlockedList[0]?.pattern || '', // For frontend
      topBlocked: topBlockedList,
      performanceImpact: {
        averageLatency: this.estimateLatencySavings(),
        bandwidthSaved: this.estimateBandwidthSavings(),
      },
    };
  }

  /**
   * Estimate latency savings from blocked requests
   */
  private estimateLatencySavings(): number {
    // Simple estimation: each blocked request saves ~200ms on average
    return 200; // ms
  }

  /**
   * Estimate bandwidth savings
   */
  private estimateBandwidthSavings(): number {
    // Simple estimation: each blocked request saves ~50KB on average
    // Calculate totalBlocked directly to avoid recursive call to getStats
    let totalBlocked = 0;
    for (const rule of this.rules.values()) {
      totalBlocked += rule.stats.blockedCount;
    }
    return totalBlocked * 50 * 1024; // bytes
  }

  /**
   * Clear rule statistics
   */
  async clearStats(ruleId?: string): Promise<void> {
    if (ruleId) {
      const rule = this.rules.get(ruleId);
      if (rule) {
        rule.stats.blockedCount = 0;
        rule.stats.totalRequests = 0;
        rule.stats.lastBlocked = undefined;
        rule.updatedAt = new Date();
      }
    } else {
      // Clear all stats
      for (const rule of this.rules.values()) {
        rule.stats.blockedCount = 0;
        rule.stats.totalRequests = 0;
        rule.stats.lastBlocked = undefined;
        rule.updatedAt = new Date();
      }
    }
    await this.saveRules();
  }

  /**
   * Export rules to JSON
   */
  exportRules(): string {
    const rules = Array.from(this.rules.values()).map(rule => ({
      name: rule.name,
      description: rule.description,
      type: rule.type,
      pattern: rule.pattern,
      action: rule.action,
      options: rule.options,
      priority: rule.priority,
      enabled: rule.enabled,
    }));
    return JSON.stringify(rules, null, 2);
  }

  /**
   * Import rules from JSON
   */
  async importRules(rulesJson: string): Promise<number> {
    try {
      const importedRules = JSON.parse(rulesJson);
      let imported = 0;

      for (const ruleData of importedRules) {
        await this.createRule({
          ...ruleData,
          enabled: ruleData.enabled ?? true, // Default to enabled
        });
        imported++;
      }

      this.logger.info(`Imported ${imported} blocking rules`);
      return imported;
    } catch (error) {
      this.logger.error('Failed to import rules:', error);
      throw new Error('Invalid JSON format');
    }
  }

  /**
   * Get pre-defined rule templates
   */
  getRuleTemplates(): Array<{
    name: string;
    description: string;
    type: BlockingRule['type'];
    pattern: string;
    action: BlockingRule['action'];
    priority: number;
  }> {
    return [
      {
        name: 'Block Analytics Scripts',
        description: 'Blocks common analytics and tracking scripts',
        type: 'pattern',
        pattern: '.*google-analytics\\.com.*|.*googletagmanager\\.com.*|.*facebook\\.com/tr.*|.*doubleclick\\.net.*',
        action: 'block',
        priority: 80,
      },
      {
        name: 'Block Ad Networks',
        description: 'Blocks major advertising networks',
        type: 'pattern',
        pattern: '.*googlesyndication\\.com.*|.*googleadservices\\.com.*|.*adsystem\\.google\\.com.*',
        action: 'block',
        priority: 75,
      },
      {
        name: 'Block Social Media Widgets',
        description: 'Blocks social media buttons and widgets',
        type: 'pattern',
        pattern: '.*platform\\.twitter\\.com.*|.*connect\\.facebook\\.net.*|.*assets\\.pinterest\\.com.*',
        action: 'block',
        priority: 70,
      },
      {
        name: 'Block Heavy Fonts',
        description: 'Blocks external font requests that slow down rendering',
        type: 'resource',
        pattern: 'font',
        action: 'block',
        priority: 60,
      },
      {
        name: 'Block Images',
        description: 'Blocks all image requests for faster rendering',
        type: 'resource',
        pattern: 'image',
        action: 'block',
        priority: 50,
      },
      {
        name: 'Block CSS Animations',
        description: 'Blocks CSS files that might contain heavy animations',
        type: 'pattern',
        pattern: '.*\\.css.*animation|.*animate.*\\.css',
        action: 'block',
        priority: 40,
      },
    ];
  }
}

export default new BlockingManager();