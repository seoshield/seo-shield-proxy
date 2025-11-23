/**
 * Configuration Manager
 * Manages runtime configuration with hot reload support
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_FILE = path.join(__dirname, '../../runtime-config.json');

class ConfigManager {
  constructor() {
    this.config = null;
    this.defaultConfig = {
      adminPath: '/admin',
      adminAuth: {
        enabled: true,
        username: 'admin',
        password: 'seo-shield-2024', // Should be changed in production
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
        renderAllBots: true, // If true, render for all bots regardless of allowedBots
      },
      cacheTTL: 3600,
      maxCacheSize: 1000, // Maximum number of cached pages
    };
  }

  /**
   * Initialize config file if it doesn't exist
   */
  async initialize() {
    try {
      await fs.access(CONFIG_FILE);
      // File exists, load it
      await this.loadConfig();
    } catch (error) {
      // File doesn't exist, create with defaults
      console.log('📝 Creating default runtime-config.json');
      await this.saveConfig(this.defaultConfig);
      this.config = this.defaultConfig;
    }
  }

  /**
   * Load configuration from file
   */
  async loadConfig() {
    try {
      const data = await fs.readFile(CONFIG_FILE, 'utf-8');
      this.config = JSON.parse(data);
      console.log('✅ Runtime configuration loaded');
      return this.config;
    } catch (error) {
      console.error('❌ Error loading runtime config:', error.message);
      this.config = this.defaultConfig;
      return this.config;
    }
  }

  /**
   * Save configuration to file
   * @param {object} config - Configuration object
   */
  async saveConfig(config = this.config) {
    try {
      // Validate config before saving
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
        console.warn('⚠️  Could not create config backup:', backupError.message);
      }

      const data = JSON.stringify(config, null, 2);
      await fs.writeFile(CONFIG_FILE, data, 'utf-8');
      this.config = config;
      console.log('💾 Runtime configuration saved');
      return true;
    } catch (error) {
      console.error('❌ Error saving runtime config:', error.message);
      return false;
    }
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return this.config || this.defaultConfig;
  }

  /**
   * Update configuration
   * @param {object} updates - Partial configuration updates
   */
  async updateConfig(updates) {
    const newConfig = {
      ...this.config,
      ...updates,
      // Deep merge for nested objects
      cacheRules: {
        ...this.config.cacheRules,
        ...(updates.cacheRules || {}),
      },
      botRules: {
        ...this.config.botRules,
        ...(updates.botRules || {}),
      },
      adminAuth: {
        ...this.config.adminAuth,
        ...(updates.adminAuth || {}),
      },
    };

    await this.saveConfig(newConfig);
    return newConfig;
  }

  /**
   * Add a cache pattern
   * @param {string} pattern - URL pattern
   * @param {string} type - 'noCache' or 'cache'
   */
  async addCachePattern(pattern, type = 'noCache') {
    const config = this.getConfig();

    if (type === 'noCache') {
      if (!config.cacheRules.noCachePatterns.includes(pattern)) {
        config.cacheRules.noCachePatterns.push(pattern);
      }
    } else {
      if (!config.cacheRules.cachePatterns.includes(pattern)) {
        config.cacheRules.cachePatterns.push(pattern);
      }
    }

    await this.saveConfig(config);
    return config;
  }

  /**
   * Remove a cache pattern
   * @param {string} pattern - URL pattern
   * @param {string} type - 'noCache' or 'cache'
   */
  async removeCachePattern(pattern, type = 'noCache') {
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
   * @param {string} botName - Bot name
   */
  async addAllowedBot(botName) {
    const config = this.getConfig();

    if (!config.botRules.allowedBots.includes(botName)) {
      config.botRules.allowedBots.push(botName);
    }

    // Remove from blocked if present
    config.botRules.blockedBots = config.botRules.blockedBots.filter((b) => b !== botName);

    await this.saveConfig(config);
    return config;
  }

  /**
   * Add a blocked bot
   * @param {string} botName - Bot name
   */
  async addBlockedBot(botName) {
    const config = this.getConfig();

    if (!config.botRules.blockedBots.includes(botName)) {
      config.botRules.blockedBots.push(botName);
    }

    // Remove from allowed if present
    config.botRules.allowedBots = config.botRules.allowedBots.filter((b) => b !== botName);

    await this.saveConfig(config);
    return config;
  }

  /**
   * Remove a bot from allowed/blocked lists
   * @param {string} botName - Bot name
   */
  async removeBot(botName) {
    const config = this.getConfig();

    config.botRules.allowedBots = config.botRules.allowedBots.filter((b) => b !== botName);
    config.botRules.blockedBots = config.botRules.blockedBots.filter((b) => b !== botName);

    await this.saveConfig(config);
    return config;
  }

  /**
   * Reset to default configuration
   */
  async resetToDefaults() {
    await this.saveConfig(this.defaultConfig);
    return this.defaultConfig;
  }

  /**
   * Check if a bot should be rendered
   * @param {string} botName - Bot name
   */
  shouldRenderBot(botName) {
    const config = this.getConfig();

    // If renderAllBots is true, render for all bots
    if (config.botRules.renderAllBots) {
      // Unless explicitly blocked
      return !config.botRules.blockedBots.includes(botName);
    }

    // Only render for allowed bots
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
