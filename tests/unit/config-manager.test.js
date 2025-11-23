/**
 * Unit Tests for Configuration Manager
 * Tests runtime configuration management, file I/O, and configuration updates
 */

import { jest } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock the config file path for testing
const TEST_CONFIG_DIR = path.join(__dirname, '../../test-configs');
const TEST_CONFIG_FILE = path.join(TEST_CONFIG_DIR, 'test-runtime-config.json');

describe('Config Manager', () => {
  let ConfigManager;
  let configManager;

  beforeAll(async () => {
    // Create test config directory
    try {
      await fs.mkdir(TEST_CONFIG_DIR, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  });

  afterAll(async () => {
    // Cleanup test directory
    try {
      await fs.rm(TEST_CONFIG_DIR, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    // Clean up any existing test config files
    try {
      await fs.unlink(TEST_CONFIG_FILE);
    } catch (error) {
      // File might not exist
    }

    try {
      await fs.unlink(`${TEST_CONFIG_FILE}.backup`);
    } catch (error) {
      // Backup might not exist
    }

    // Import a fresh instance for each test
    // Note: In real implementation, we'd need to handle the singleton pattern
    // For now, we'll use the default export and reset its state
    const module = await import('../../dist/admin/config-manager.js');
    configManager = module.default;
  });

  describe('getConfig()', () => {
    test('should return default configuration', () => {
      const config = configManager.getConfig();

      expect(config).toHaveProperty('adminPath');
      expect(config).toHaveProperty('adminAuth');
      expect(config).toHaveProperty('cacheRules');
      expect(config).toHaveProperty('botRules');
      expect(config).toHaveProperty('cacheTTL');
      expect(config).toHaveProperty('maxCacheSize');
    });

    test('should have correct default adminPath', () => {
      const config = configManager.getConfig();
      expect(config.adminPath).toBe('/admin');
    });

    test('should have admin auth enabled by default', () => {
      const config = configManager.getConfig();
      expect(config.adminAuth.enabled).toBe(true);
      expect(config.adminAuth.username).toBe('admin');
      expect(config.adminAuth.password).toBeTruthy();
    });

    test('should have default cache rules', () => {
      const config = configManager.getConfig();
      expect(config.cacheRules.cacheByDefault).toBe(true);
      expect(config.cacheRules.metaTagName).toBe('x-seo-shield-cache');
      expect(Array.isArray(config.cacheRules.noCachePatterns)).toBe(true);
      expect(Array.isArray(config.cacheRules.cachePatterns)).toBe(true);
    });

    test('should have default NO_CACHE patterns', () => {
      const config = configManager.getConfig();
      expect(config.cacheRules.noCachePatterns).toContain('/checkout');
      expect(config.cacheRules.noCachePatterns).toContain('/cart');
      expect(config.cacheRules.noCachePatterns).toContain('/admin/*');
      expect(config.cacheRules.noCachePatterns).toContain('/api/*');
    });

    test('should have default bot rules', () => {
      const config = configManager.getConfig();
      expect(config.botRules.renderAllBots).toBe(true);
      expect(Array.isArray(config.botRules.allowedBots)).toBe(true);
      expect(Array.isArray(config.botRules.blockedBots)).toBe(true);
    });

    test('should include common bots in allowedBots', () => {
      const config = configManager.getConfig();
      expect(config.botRules.allowedBots).toContain('Googlebot');
      expect(config.botRules.allowedBots).toContain('Bingbot');
      expect(config.botRules.allowedBots).toContain('Twitterbot');
      expect(config.botRules.allowedBots).toContain('Facebookbot');
    });

    test('should have default cache TTL', () => {
      const config = configManager.getConfig();
      expect(config.cacheTTL).toBe(3600);
    });

    test('should have default max cache size', () => {
      const config = configManager.getConfig();
      expect(config.maxCacheSize).toBe(1000);
    });
  });

  describe('updateConfig()', () => {
    test('should update adminPath', async () => {
      await configManager.updateConfig({ adminPath: '/dashboard' });
      const config = configManager.getConfig();
      expect(config.adminPath).toBe('/dashboard');
    });

    test('should update cacheTTL', async () => {
      await configManager.updateConfig({ cacheTTL: 7200 });
      const config = configManager.getConfig();
      expect(config.cacheTTL).toBe(7200);
    });

    test('should update maxCacheSize', async () => {
      await configManager.updateConfig({ maxCacheSize: 2000 });
      const config = configManager.getConfig();
      expect(config.maxCacheSize).toBe(2000);
    });

    test('should deep merge cache rules', async () => {
      await configManager.updateConfig({
        cacheRules: {
          cacheByDefault: false,
        },
      });
      const config = configManager.getConfig();
      expect(config.cacheRules.cacheByDefault).toBe(false);
      // Other cache rules should still exist
      expect(config.cacheRules.metaTagName).toBe('x-seo-shield-cache');
    });

    test('should deep merge bot rules', async () => {
      await configManager.updateConfig({
        botRules: {
          renderAllBots: false,
        },
      });
      const config = configManager.getConfig();
      expect(config.botRules.renderAllBots).toBe(false);
      // Other bot rules should still exist
      expect(Array.isArray(config.botRules.allowedBots)).toBe(true);
    });

    test('should deep merge admin auth', async () => {
      await configManager.updateConfig({
        adminAuth: {
          enabled: false,
        },
      });
      const config = configManager.getConfig();
      expect(config.adminAuth.enabled).toBe(false);
      // Other auth fields should still exist
      expect(config.adminAuth.username).toBeTruthy();
    });

    test('should update multiple fields at once', async () => {
      await configManager.updateConfig({
        adminPath: '/control-panel',
        cacheTTL: 1800,
        maxCacheSize: 500,
      });
      const config = configManager.getConfig();
      expect(config.adminPath).toBe('/control-panel');
      expect(config.cacheTTL).toBe(1800);
      expect(config.maxCacheSize).toBe(500);
    });

    test('should return updated configuration', async () => {
      const newConfig = await configManager.updateConfig({ adminPath: '/new-admin' });
      expect(newConfig.adminPath).toBe('/new-admin');
    });
  });

  describe('addCachePattern()', () => {
    test('should add NO_CACHE pattern', async () => {
      await configManager.addCachePattern('/profile', 'noCache');
      const config = configManager.getConfig();
      expect(config.cacheRules.noCachePatterns).toContain('/profile');
    });

    test('should add CACHE pattern', async () => {
      await configManager.addCachePattern('/blog/*', 'cache');
      const config = configManager.getConfig();
      expect(config.cacheRules.cachePatterns).toContain('/blog/*');
    });

    test('should not add duplicate NO_CACHE pattern', async () => {
      await configManager.addCachePattern('/checkout', 'noCache');
      const config = configManager.getConfig();
      const count = config.cacheRules.noCachePatterns.filter((p) => p === '/checkout').length;
      expect(count).toBe(1);
    });

    test('should not add duplicate CACHE pattern', async () => {
      await configManager.addCachePattern('/blog', 'cache');
      await configManager.addCachePattern('/blog', 'cache');
      const config = configManager.getConfig();
      const count = config.cacheRules.cachePatterns.filter((p) => p === '/blog').length;
      expect(count).toBe(1);
    });

    test('should default to noCache type', async () => {
      await configManager.addCachePattern('/test');
      const config = configManager.getConfig();
      expect(config.cacheRules.noCachePatterns).toContain('/test');
    });

    test('should return updated configuration', async () => {
      const newConfig = await configManager.addCachePattern('/test', 'noCache');
      expect(newConfig.cacheRules.noCachePatterns).toContain('/test');
    });
  });

  describe('removeCachePattern()', () => {
    test('should remove NO_CACHE pattern', async () => {
      await configManager.removeCachePattern('/checkout', 'noCache');
      const config = configManager.getConfig();
      expect(config.cacheRules.noCachePatterns).not.toContain('/checkout');
    });

    test('should remove CACHE pattern', async () => {
      await configManager.addCachePattern('/blog', 'cache');
      await configManager.removeCachePattern('/blog', 'cache');
      const config = configManager.getConfig();
      expect(config.cacheRules.cachePatterns).not.toContain('/blog');
    });

    test('should default to noCache type', async () => {
      await configManager.removeCachePattern('/cart');
      const config = configManager.getConfig();
      expect(config.cacheRules.noCachePatterns).not.toContain('/cart');
    });

    test('should handle removing non-existent pattern', async () => {
      await configManager.removeCachePattern('/non-existent', 'noCache');
      // Should not throw error
      const config = configManager.getConfig();
      expect(config).toBeDefined();
    });

    test('should return updated configuration', async () => {
      const newConfig = await configManager.removeCachePattern('/cart', 'noCache');
      expect(newConfig.cacheRules.noCachePatterns).not.toContain('/cart');
    });
  });

  describe('addAllowedBot()', () => {
    test('should add bot to allowed list', async () => {
      await configManager.addAllowedBot('MyCustomBot');
      const config = configManager.getConfig();
      expect(config.botRules.allowedBots).toContain('MyCustomBot');
    });

    test('should not add duplicate bot', async () => {
      await configManager.addAllowedBot('Googlebot');
      await configManager.addAllowedBot('Googlebot');
      const config = configManager.getConfig();
      const count = config.botRules.allowedBots.filter((b) => b === 'Googlebot').length;
      expect(count).toBe(1);
    });

    test('should remove bot from blocked list if present', async () => {
      await configManager.addBlockedBot('TestBot');
      await configManager.addAllowedBot('TestBot');
      const config = configManager.getConfig();
      expect(config.botRules.allowedBots).toContain('TestBot');
      expect(config.botRules.blockedBots).not.toContain('TestBot');
    });

    test('should return updated configuration', async () => {
      const newConfig = await configManager.addAllowedBot('NewBot');
      expect(newConfig.botRules.allowedBots).toContain('NewBot');
    });
  });

  describe('addBlockedBot()', () => {
    test('should add bot to blocked list', async () => {
      await configManager.addBlockedBot('BadBot');
      const config = configManager.getConfig();
      expect(config.botRules.blockedBots).toContain('BadBot');
    });

    test('should not add duplicate bot', async () => {
      await configManager.addBlockedBot('BadBot');
      await configManager.addBlockedBot('BadBot');
      const config = configManager.getConfig();
      const count = config.botRules.blockedBots.filter((b) => b === 'BadBot').length;
      expect(count).toBe(1);
    });

    test('should remove bot from allowed list if present', async () => {
      await configManager.addBlockedBot('Googlebot');
      const config = configManager.getConfig();
      expect(config.botRules.blockedBots).toContain('Googlebot');
      expect(config.botRules.allowedBots).not.toContain('Googlebot');
    });

    test('should return updated configuration', async () => {
      const newConfig = await configManager.addBlockedBot('SpamBot');
      expect(newConfig.botRules.blockedBots).toContain('SpamBot');
    });
  });

  describe('removeBot()', () => {
    test('should remove bot from allowed list', async () => {
      await configManager.removeBot('Googlebot');
      const config = configManager.getConfig();
      expect(config.botRules.allowedBots).not.toContain('Googlebot');
    });

    test('should remove bot from blocked list', async () => {
      await configManager.addBlockedBot('BadBot');
      await configManager.removeBot('BadBot');
      const config = configManager.getConfig();
      expect(config.botRules.blockedBots).not.toContain('BadBot');
    });

    test('should handle removing non-existent bot', async () => {
      await configManager.removeBot('NonExistentBot');
      // Should not throw error
      const config = configManager.getConfig();
      expect(config).toBeDefined();
    });

    test('should return updated configuration', async () => {
      const newConfig = await configManager.removeBot('Bingbot');
      expect(newConfig.botRules.allowedBots).not.toContain('Bingbot');
    });
  });

  describe('resetToDefaults()', () => {
    test('should reset all configuration to defaults', async () => {
      // Make some changes
      await configManager.updateConfig({ adminPath: '/custom' });
      await configManager.addCachePattern('/test', 'noCache');

      // Reset
      await configManager.resetToDefaults();

      const config = configManager.getConfig();
      expect(config.adminPath).toBe('/admin'); // Default value
      // Should have default patterns only
      expect(config.cacheRules.noCachePatterns).toContain('/checkout');
    });

    test('should return default configuration', async () => {
      const defaultConfig = await configManager.resetToDefaults();
      expect(defaultConfig.adminPath).toBe('/admin');
      expect(defaultConfig.cacheTTL).toBe(3600);
    });
  });

  describe('shouldRenderBot()', () => {
    test('should render bot when renderAllBots is true and bot not blocked', () => {
      const shouldRender = configManager.shouldRenderBot('Googlebot');
      expect(shouldRender).toBe(true);
    });

    test('should not render bot when renderAllBots is true and bot is blocked', async () => {
      await configManager.addBlockedBot('BadBot');
      const shouldRender = configManager.shouldRenderBot('BadBot');
      expect(shouldRender).toBe(false);
    });

    test('should render bot when renderAllBots is false and bot is allowed', async () => {
      await configManager.updateConfig({
        botRules: { renderAllBots: false },
      });
      const shouldRender = configManager.shouldRenderBot('Googlebot');
      expect(shouldRender).toBe(true);
    });

    test('should not render bot when renderAllBots is false and bot not in allowed list', async () => {
      await configManager.updateConfig({
        botRules: { renderAllBots: false },
      });
      const shouldRender = configManager.shouldRenderBot('UnknownBot');
      expect(shouldRender).toBe(false);
    });

    test('should handle empty bot name', async () => {
      const shouldRender = configManager.shouldRenderBot('');
      expect(typeof shouldRender).toBe('boolean');
    });
  });

  describe('Edge Cases', () => {
    test('should handle special characters in patterns', async () => {
      await configManager.addCachePattern('/test?query=value', 'noCache');
      const config = configManager.getConfig();
      expect(config.cacheRules.noCachePatterns).toContain('/test?query=value');
    });

    test('should handle regex-like patterns', async () => {
      await configManager.addCachePattern('/test.*', 'cache');
      const config = configManager.getConfig();
      expect(config.cacheRules.cachePatterns).toContain('/test.*');
    });

    test('should handle bot names with special characters', async () => {
      await configManager.addAllowedBot('My-Custom/Bot 1.0');
      const config = configManager.getConfig();
      expect(config.botRules.allowedBots).toContain('My-Custom/Bot 1.0');
    });

    test('should handle empty pattern string', async () => {
      await configManager.addCachePattern('', 'noCache');
      const config = configManager.getConfig();
      // Empty string should be added
      expect(config.cacheRules.noCachePatterns).toContain('');
    });

    test('should handle very long patterns', async () => {
      const longPattern = '/test/' + 'x'.repeat(1000);
      await configManager.addCachePattern(longPattern, 'noCache');
      const config = configManager.getConfig();
      expect(config.cacheRules.noCachePatterns).toContain(longPattern);
    });

    test('should handle updating with empty object', async () => {
      const originalConfig = configManager.getConfig();
      await configManager.updateConfig({});
      const newConfig = configManager.getConfig();
      expect(newConfig.adminPath).toBe(originalConfig.adminPath);
    });

    test('should handle null values in updates gracefully', async () => {
      await configManager.updateConfig({
        cacheRules: null,
      });
      const config = configManager.getConfig();
      // Should still have cache rules (merged with default)
      expect(config.cacheRules).toBeDefined();
    });
  });

  describe('Configuration Persistence', () => {
    test('should persist configuration across function calls', async () => {
      await configManager.addCachePattern('/test', 'noCache');
      const config1 = configManager.getConfig();
      const config2 = configManager.getConfig();
      expect(config1).toEqual(config2);
    });

    test('should maintain configuration after multiple updates', async () => {
      await configManager.updateConfig({ cacheTTL: 1800 });
      await configManager.updateConfig({ maxCacheSize: 500 });
      const config = configManager.getConfig();
      expect(config.cacheTTL).toBe(1800);
      expect(config.maxCacheSize).toBe(500);
    });

    test('should maintain arrays correctly after modifications', async () => {
      const originalLength = configManager.getConfig().cacheRules.noCachePatterns.length;
      await configManager.addCachePattern('/new1', 'noCache');
      await configManager.addCachePattern('/new2', 'noCache');
      await configManager.removeCachePattern('/new1', 'noCache');
      const config = configManager.getConfig();
      expect(config.cacheRules.noCachePatterns.length).toBe(originalLength + 1);
      expect(config.cacheRules.noCachePatterns).toContain('/new2');
      expect(config.cacheRules.noCachePatterns).not.toContain('/new1');
    });
  });
});
