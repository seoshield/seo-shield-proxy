/**
 * Configuration Manager
 * Manages runtime configuration with hot reload support
 */

import fs from 'fs/promises';
import path from 'path';

// For CommonJS compatibility, use process.cwd() and resolve path
const CONFIG_FILE = path.join(process.cwd(), 'src', 'admin', 'runtime-config.json');

export interface AdminAuth {
  enabled: boolean;
  username: string;
  password: string;
}

export interface CacheRulesConfig {
  noCachePatterns: string[];
  cachePatterns: string[];
  cacheByDefault: boolean;
  metaTagName: string;
}

export interface BotRules {
  allowedBots: string[];
  blockedBots: string[];
  renderAllBots: boolean;
}

export interface RuntimeConfig {
  adminPath: string;
  adminAuth: AdminAuth;
  cacheRules: CacheRulesConfig;
  botRules: BotRules;
  cacheTTL: number;
  maxCacheSize: number;
  userAgent?: string;

  // Hotfix engine configuration
  hotfixRules?: Array<{
    id: string;
    name: string;
    description?: string;
    enabled: boolean;
    priority: number;
    urlPattern: string;
    conditions: {
      userAgent?: string;
      headers?: Record<string, string>;
      query?: Record<string, string>;
    };
    actions: Array<{
      type: 'replace' | 'prepend' | 'append' | 'remove' | 'attribute';
      selector: string;
      target?: string;
      value?: string;
      regex?: string;
    }>;
    createdAt: Date | string;
    updatedAt: Date | string;
    createdBy?: string;
    expiresAt?: Date | string;
  }>;

  // Blocking manager configuration
  blockingRules?: Array<{
    id: string;
    name: string;
    description?: string;
    enabled: boolean;
    type: 'domain' | 'url' | 'pattern' | 'resource';
    pattern: string;
    action: 'block' | 'redirect' | 'modify';
    options?: {
      redirectUrl?: string;
      modifyHeaders?: Record<string, string>;
      responseCode?: number;
      responseText?: string;
    };
    priority: number;
    stats: {
      blockedCount: number;
      lastBlocked?: Date;
      totalRequests: number;
    };
    createdAt: Date | string;
    updatedAt: Date | string;
    expiresAt?: Date | string;
  }>;
}

class ConfigManager {
  private config: RuntimeConfig | null = null;
  private defaultConfig: RuntimeConfig;

  constructor() {
    this.defaultConfig = {
      adminPath: '/admin',
      adminAuth: {
        enabled: true,
        username: 'admin',
        password: 'seo-shield-2025', // Should be changed in production
      },
      cacheRules: {
        noCachePatterns: ['/checkout', '/cart', '/admin/*', '/api/*'],
        cachePatterns: [],
        cacheByDefault: true,
        metaTagName: 'x-seo-shield-cache',
      },
      botRules: {
        allowedBots: [
          'Googlebot',
          'Bingbot',
          'Twitterbot',
          'Facebookbot',
          'LinkedInBot',
          'Slackbot',
        ],
        blockedBots: [],
        renderAllBots: true,
      },
      cacheTTL: 3600,
      maxCacheSize: 1000,
    };
  }

  /**
   * Initialize config file if it doesn't exist
   */
  async initialize(): Promise<void> {
    try {
      await fs.access(CONFIG_FILE);
      await this.loadConfig();
    } catch (error) {
      console.log('📝 Creating default runtime-config.json');
      await this.saveConfig(this.defaultConfig);
      this.config = this.defaultConfig;
    }
  }

  /**
   * Load configuration from file
   */
  async loadConfig(): Promise<RuntimeConfig> {
    try {
      const data = await fs.readFile(CONFIG_FILE, 'utf-8');
      this.config = JSON.parse(data) as RuntimeConfig;
      console.log('✅ Runtime configuration loaded');
      return this.config;
    } catch (error) {
      console.error('❌ Error loading runtime config:', (error as Error).message);
      this.config = this.defaultConfig;
      return this.config;
    }
  }

  /**
   * Save configuration to file
   */
  async saveConfig(config: RuntimeConfig = this.config || this.defaultConfig): Promise<boolean> {
    try {
      if (!config || typeof config !== 'object') {
        throw new Error('Invalid configuration object');
      }

      // Create backup before saving
      try {
        const backupFile = `${CONFIG_FILE}.backup`;
        if (this.config) {
          await fs.writeFile(backupFile, JSON.stringify(this.config, null, 2), 'utf-8');
        }
      } catch (backupError) {
        console.warn('⚠️  Could not create config backup:', (backupError as Error).message);
      }

      const data = JSON.stringify(config, null, 2);
      await fs.writeFile(CONFIG_FILE, data, 'utf-8');
      this.config = config;
      console.log('💾 Runtime configuration saved');
      return true;
    } catch (error) {
      console.error('❌ Error saving runtime config:', (error as Error).message);
      return false;
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): RuntimeConfig {
    return this.config || this.defaultConfig;
  }

  /**
   * Update configuration
   */
  async updateConfig(updates: Partial<RuntimeConfig>): Promise<RuntimeConfig> {
    const currentConfig = this.getConfig();
    const newConfig: RuntimeConfig = {
      ...currentConfig,
      ...updates,
      // Deep merge for nested objects
      cacheRules: {
        ...currentConfig.cacheRules,
        ...(updates.cacheRules || {}),
      },
      botRules: {
        ...currentConfig.botRules,
        ...(updates.botRules || {}),
      },
      adminAuth: {
        ...currentConfig.adminAuth,
        ...(updates.adminAuth || {}),
      },
    };

    await this.saveConfig(newConfig);
    return newConfig;
  }

  /**
   * Add a cache pattern
   */
  async addCachePattern(pattern: string, type: 'noCache' | 'cache' = 'noCache'): Promise<RuntimeConfig> {
    const config = this.getConfig();

    if (type === 'noCache') {
      if (!config.cacheRules.noCachePatterns.includes(pattern)) {
        config.cacheRules.noCachePatterns.push(pattern);
      }
    } else if (type === 'cache') {
      if (!config.cacheRules.cachePatterns.includes(pattern)) {
        config.cacheRules.cachePatterns.push(pattern);
      }
    } else {
      throw new Error(`Invalid pattern type: ${type}`);
    }

    await this.saveConfig(config);
    return config;
  }

  /**
   * Remove a cache pattern
   */
  async removeCachePattern(pattern: string, type: 'noCache' | 'cache' = 'noCache'): Promise<RuntimeConfig> {
    const config = this.getConfig();

    if (type === 'noCache') {
      config.cacheRules.noCachePatterns = config.cacheRules.noCachePatterns.filter(
        (p) => p !== pattern
      );
    } else {
      config.cacheRules.cachePatterns = config.cacheRules.cachePatterns.filter(
        (p) => p !== pattern
      );
    }

    await this.saveConfig(config);
    return config;
  }

  /**
   * Add an allowed bot
   */
  async addAllowedBot(botName: string): Promise<RuntimeConfig> {
    const config = this.getConfig();

    if (!config.botRules.allowedBots.includes(botName)) {
      config.botRules.allowedBots.push(botName);
    }

    config.botRules.blockedBots = config.botRules.blockedBots.filter((b) => b !== botName);

    await this.saveConfig(config);
    return config;
  }

  /**
   * Add a blocked bot
   */
  async addBlockedBot(botName: string): Promise<RuntimeConfig> {
    const config = this.getConfig();

    if (!config.botRules.blockedBots.includes(botName)) {
      config.botRules.blockedBots.push(botName);
    }

    config.botRules.allowedBots = config.botRules.allowedBots.filter((b) => b !== botName);

    await this.saveConfig(config);
    return config;
  }

  /**
   * Remove a bot from allowed/blocked lists
   */
  async removeBot(botName: string): Promise<RuntimeConfig> {
    const config = this.getConfig();

    config.botRules.allowedBots = config.botRules.allowedBots.filter((b) => b !== botName);
    config.botRules.blockedBots = config.botRules.blockedBots.filter((b) => b !== botName);

    await this.saveConfig(config);
    return config;
  }

  /**
   * Reset to default configuration
   */
  async resetToDefaults(): Promise<RuntimeConfig> {
    await this.saveConfig(this.defaultConfig);
    return this.defaultConfig;
  }

  /**
   * Check if a bot should be rendered
   */
  shouldRenderBot(botName: string): boolean {
    const config = this.getConfig();

    if (config.botRules.renderAllBots) {
      return !config.botRules.blockedBots.includes(botName);
    }

    return config.botRules.allowedBots.includes(botName);
  }
}

// Export singleton instance
const configManager = new ConfigManager();

// Initialize on import
configManager.initialize().catch((error) => {
  console.error('Failed to initialize config manager:', error);
});

export default configManager;
