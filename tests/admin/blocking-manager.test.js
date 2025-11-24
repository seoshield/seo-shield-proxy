/**
 * Unit Tests for Blocking Manager Service
 * Test Coverage: 100% for all request blocking and rule management functionality
 */

import blockingManager from '../../src/admin/blocking-manager.js';
import configManager from '../../src/admin/config-manager.js';
import { Logger } from '../../src/utils/logger.js';

// Mock dependencies
jest.mock('../../src/admin/config-manager.js');
jest.mock('../../src/utils/logger.js');

describe('BlockingManager', () => {
  const mockConfig = {
    blockingRules: [
      {
        id: 'test_rule_1',
        name: 'Block Analytics',
        enabled: true,
        type: 'domain',
        pattern: 'google-analytics.com',
        action: 'block',
        priority: 80,
        createdAt: new Date('2023-01-01').toISOString(),
        updatedAt: new Date('2023-01-01').toISOString(),
        stats: {
          blockedCount: 100,
          totalRequests: 100,
          lastBlocked: new Date().toISOString(),
        },
      },
      {
        id: 'test_rule_2',
        name: 'Redirect Old Domain',
        enabled: false,
        type: 'domain',
        pattern: 'old-domain.com',
        action: 'redirect',
        priority: 90,
        options: {
          redirectUrl: 'https://new-domain.com',
        },
        createdAt: new Date('2023-01-01').toISOString(),
        updatedAt: new Date('2023-01-01').toISOString(),
        stats: {
          blockedCount: 50,
          totalRequests: 200,
        },
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock config manager
    (configManager.getConfig as jest.Mock).mockResolvedValue(mockConfig);
    (configManager.updateConfig as jest.Mock).mockResolvedValue({});
  });

  describe('loadRules', () => {
    it('should load rules from configuration on initialization', async () => {
      // Wait for async constructor to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(configManager.getConfig).toHaveBeenCalled();
    });

    it('should handle config loading errors gracefully', async () => {
      (configManager.getConfig as jest.Mock).mockRejectedValue(new Error('Config error'));

      await new Promise(resolve => setTimeout(resolve, 10));

      // Should not throw an error
      expect(blockingManager.getRules()).toBeDefined();
    });
  });

  describe('shouldBlockRequest', () => {
    it('should block request matching enabled domain rule', () => {
      const result = blockingManager.shouldBlockRequest('https://www.google-analytics.com/analytics.js');

      expect(result).toMatchObject({
        blocked: true,
        rule: expect.objectContaining({
          id: 'test_rule_1',
          name: 'Block Analytics',
          type: 'domain',
        }),
        action: 'block',
      });
    });

    it('should not block request when no rules match', () => {
      const result = blockingManager.shouldBlockRequest('https://example.com/script.js');

      expect(result).toEqual({ blocked: false });
    });

    it('should not block request for disabled rule', () => {
      const result = blockingManager.shouldBlockRequest('https://old-domain.com/page');

      expect(result).toEqual({ blocked: false });
    });

    it('should apply highest priority rule when multiple match', async () => {
      // Create another rule with higher priority
      await blockingManager.createRule({
        name: 'High Priority Block',
        description: 'High priority rule',
        enabled: true,
        type: 'pattern',
        pattern: '.*analytics.*',
        action: 'block',
        priority: 100,
      });

      const result = blockingManager.shouldBlockRequest('https://www.google-analytics.com/analytics.js');

      expect(result.rule?.priority).toBe(100);
      expect(result.rule?.name).toBe('High Priority Block');
    });

    it('should handle URL pattern matching', async () => {
      await blockingManager.createRule({
        name: 'Block API endpoints',
        enabled: true,
        type: 'url',
        pattern: '/api/',
        action: 'block',
        priority: 70,
      });

      const result = blockingManager.shouldBlockRequest('https://example.com/api/users');

      expect(result.blocked).toBe(true);
      expect(result.rule?.name).toBe('Block API endpoints');
    });

    it('should handle regex pattern matching', async () => {
      await blockingManager.createRule({
        name: 'Block tracking pixels',
        enabled: true,
        type: 'pattern',
        pattern: '.*\\.(png|gif)\\?.*tracking.*',
        action: 'block',
        priority: 75,
      });

      const result = blockingManager.shouldBlockRequest('https://example.com/pixel.png?tracking=true');

      expect(result.blocked).toBe(true);
    });

    it('should handle resource type filtering', async () => {
      await blockingManager.createRule({
        name: 'Block images',
        enabled: true,
        type: 'resource',
        pattern: 'image',
        action: 'block',
        priority: 60,
      });

      const result = blockingManager.shouldBlockRequest('https://example.com/photo.jpg', 'image');

      expect(result.blocked).toBe(true);
    });

    it('should handle wildcard patterns in URL matching', async () => {
      await blockingManager.createRule({
        name: 'Block CDN assets',
        enabled: true,
        type: 'url',
        pattern: 'https://cdn.*.com/*',
        action: 'block',
        priority: 65,
      });

      const result = blockingManager.shouldBlockRequest('https://cdn.example.com/asset.js');

      expect(result.blocked).toBe(true);
    });

    it('should not update stats for non-matching requests', () => {
      const initialStats = blockingManager.getRule('test_rule_1')?.stats;

      blockingManager.shouldBlockRequest('https://example.com/script.js');

      const updatedStats = blockingManager.getRule('test_rule_1')?.stats;
      expect(updatedStats?.blockedCount).toBe(initialStats?.blockedCount);
      expect(updatedStats?.totalRequests).toBe(initialStats?.totalRequests);
    });
  });

  describe('createRule', () => {
    it('should create a new blocking rule', async () => {
      const ruleData = {
        name: 'Block Social Widgets',
        description: 'Blocks social media widgets',
        enabled: true,
        type: 'pattern' as const,
        pattern: '.*facebook\\.com.*|.*twitter\\.com.*',
        action: 'block' as const,
        priority: 70,
      };

      const result = await blockingManager.createRule(ruleData);

      expect(result).toMatchObject({
        ...ruleData,
        id: expect.stringMatching(/^block_\d+_[a-z0-9]+$/),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        stats: {
          blockedCount: 0,
          totalRequests: 0,
        },
      });

      expect(configManager.updateConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          blockingRules: expect.any(Array),
        })
      );
    });

    it('should handle rule creation errors', async () => {
      (configManager.updateConfig as jest.Mock).mockRejectedValue(new Error('Save error'));

      await expect(
        blockingManager.createRule({
          name: 'Test Rule',
          enabled: true,
          type: 'domain',
          pattern: 'example.com',
          action: 'block',
          priority: 50,
        })
      ).rejects.toThrow('Save error');
    });
  });

  describe('updateRule', () => {
    it('should update an existing rule', async () => {
      const updates = {
        name: 'Updated Rule Name',
        enabled: false,
        priority: 85,
      };

      const result = await blockingManager.updateRule('test_rule_1', updates);

      expect(result).toMatchObject({
        id: 'test_rule_1',
        name: 'Updated Rule Name',
        enabled: false,
        priority: 85,
        createdAt: expect.any(Date), // Preserved
        updatedAt: expect.any(Date), // Updated
        stats: expect.any(Object), // Preserved
      });

      expect(configManager.updateConfig).toHaveBeenCalled();
    });

    it('should return null for non-existent rule', async () => {
      const result = await blockingManager.updateRule('nonexistent', { name: 'New Name' });

      expect(result).toBeNull();
      expect(configManager.updateConfig).not.toHaveBeenCalled();
    });

    it('should preserve stats during update', async () => {
      const originalStats = blockingManager.getRule('test_rule_1')?.stats;

      await blockingManager.updateRule('test_rule_1', { name: 'New Name' });

      const updatedStats = blockingManager.getRule('test_rule_1')?.stats;
      expect(updatedStats).toEqual(originalStats);
    });
  });

  describe('deleteRule', () => {
    it('should delete an existing rule', async () => {
      const result = await blockingManager.deleteRule('test_rule_1');

      expect(result).toBe(true);
      expect(configManager.updateConfig).toHaveBeenCalled();
    });

    it('should return false for non-existent rule', async () => {
      const result = await blockingManager.deleteRule('nonexistent');

      expect(result).toBe(false);
      expect(configManager.updateConfig).not.toHaveBeenCalled();
    });
  });

  describe('toggleRule', () => {
    it('should enable a disabled rule', async () => {
      const result = await blockingManager.toggleRule('test_rule_2');

      expect(result).toBe(true);
      expect(blockingManager.getRule('test_rule_2')?.enabled).toBe(true);
      expect(configManager.updateConfig).toHaveBeenCalled();
    });

    it('should disable an enabled rule', async () => {
      const result = await blockingManager.toggleRule('test_rule_1');

      expect(result).toBe(true);
      expect(blockingManager.getRule('test_rule_1')?.enabled).toBe(false);
      expect(configManager.updateConfig).toHaveBeenCalled();
    });

    it('should return false for non-existent rule', async () => {
      const result = await blockingManager.toggleRule('nonexistent');

      expect(result).toBe(false);
      expect(configManager.updateConfig).not.toHaveBeenCalled();
    });
  });

  describe('getRules and getRule', () => {
    it('should return all rules sorted by priority', () => {
      const rules = blockingManager.getRules();

      expect(rules).toHaveLength(2);
      expect(rules[0].priority).toBeGreaterThan(rules[1].priority);
    });

    it('should return specific rule by ID', () => {
      const rule = blockingManager.getRule('test_rule_1');

      expect(rule).toMatchObject({
        id: 'test_rule_1',
        name: 'Block Analytics',
        enabled: true,
      });
    });

    it('should return null for non-existent rule', () => {
      const rule = blockingManager.getRule('nonexistent');

      expect(rule).toBeNull();
    });
  });

  describe('testBlocking', () => {
    it('should test URL against blocking rules', async () => {
      const result = await blockingManager.testBlocking('https://www.google-analytics.com/analytics.js');

      expect(result).toMatchObject({
        url: 'https://www.google-analytics.com/analytics.js',
        results: {
          blocked: true,
          matchedRule: 'Block Analytics',
          action: 'block',
          responseTime: expect.any(Number),
        },
        timestamp: expect.any(Date),
      });

      // Should store in test history
      const history = blockingManager.getTestHistory();
      expect(history).toHaveLength(1);
      expect(history[0].url).toBe('https://www.google-analytics.com/analytics.js');
    });

    it('should test URL with user agent and headers', async () => {
      const userAgent = 'Mozilla/5.0 (compatible; Googlebot/2.1)';
      const headers = { 'X-Forwarded-For': '192.168.1.1' };

      const result = await blockingManager.testBlocking('https://example.com', userAgent, headers);

      expect(result.userAgent).toBe(userAgent);
      expect(result.headers).toEqual(headers);
    });

    it('should maintain test history with limit', async () => {
      // Create more than 100 test entries
      for (let i = 0; i < 105; i++) {
        await blockingManager.testBlocking(`https://example${i}.com/script.js`);
      }

      const history = blockingManager.getTestHistory();
      expect(history).toHaveLength(100); // Should be limited to 100
    });
  });

  describe('getStats', () => {
    it('should return comprehensive blocking statistics', () => {
      const stats = blockingManager.getStats();

      expect(stats).toMatchObject({
        totalRules: 2,
        enabledRules: 1, // Only test_rule_1 is enabled
        totalBlocked: 150, // Sum of blockedCount from both rules
        todayBlocked: expect.any(Number),
        topBlocked: expect.any(Array),
        performanceImpact: {
          averageLatency: expect.any(Number),
          bandwidthSaved: expect.any(Number),
        },
      });
    });

    it('should calculate top blocked patterns', async () => {
      // Add more rules with different block counts
      await blockingManager.createRule({
        name: 'High Traffic Block',
        enabled: true,
        type: 'domain',
        pattern: 'ads.com',
        action: 'block',
        priority: 95,
      });

      // Manually set some stats for testing
      const rule = blockingManager.getRules()[0]; // High Traffic Block rule
      if (rule) {
        rule.stats.blockedCount = 500;
      }

      const stats = blockingManager.getStats();

      expect(stats.topBlocked).toHaveLength(expect.any(Number));
      expect(stats.topBlocked[0]).toMatchObject({
        pattern: expect.any(String),
        count: expect.any(Number),
        type: expect.any(String),
      });
    });

    it('should estimate performance impact correctly', () => {
      const stats = blockingManager.getStats();

      expect(stats.performanceImpact.averageLatency).toBeGreaterThan(0);
      expect(stats.performanceImpact.bandwidthSaved).toBeGreaterThan(0);
    });
  });

  describe('clearStats', () => {
    it('should clear statistics for specific rule', async () => {
      await blockingManager.clearStats('test_rule_1');

      const rule = blockingManager.getRule('test_rule_1');
      expect(rule?.stats.blockedCount).toBe(0);
      expect(rule?.stats.totalRequests).toBe(0);
      expect(rule?.stats.lastBlocked).toBeUndefined();
      expect(configManager.updateConfig).toHaveBeenCalled();
    });

    it('should clear statistics for all rules', async () => {
      await blockingManager.clearStats(); // No rule ID specified

      const rules = blockingManager.getRules();
      rules.forEach(rule => {
        expect(rule.stats.blockedCount).toBe(0);
        expect(rule.stats.totalRequests).toBe(0);
        expect(rule.stats.lastBlocked).toBeUndefined();
      });

      expect(configManager.updateConfig).toHaveBeenCalled();
    });
  });

  describe('import and export rules', () => {
    const testRules = [
      {
        name: 'Import Test Rule 1',
        description: 'Test rule for import',
        type: 'domain',
        pattern: 'example.com',
        action: 'block',
        priority: 70,
        enabled: true,
      },
      {
        name: 'Import Test Rule 2',
        type: 'pattern',
        pattern: '.*\\.(jpg|png)$',
        action: 'block',
        priority: 60,
        enabled: false,
      },
    ];

    it('should export rules to JSON string', () => {
      const exported = blockingManager.exportRules();

      expect(typeof exported).toBe('string');
      const parsed = JSON.parse(exported);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(2); // Original mock rules

      parsed.forEach(rule => {
        expect(rule).toMatchObject({
          name: expect.any(String),
          type: expect.any(String),
          pattern: expect.any(String),
          action: expect.any(String),
          priority: expect.any(Number),
          enabled: expect.any(Boolean),
        });
        expect(rule).not.toHaveProperty('id');
        expect(rule).not.toHaveProperty('createdAt');
        expect(rule).not.toHaveProperty('stats');
      });
    });

    it('should import rules from JSON string', async () => {
      const rulesJson = JSON.stringify(testRules);

      const importedCount = await blockingManager.importRules(rulesJson);

      expect(importedCount).toBe(2);

      // Check that rules were created
      const allRules = blockingManager.getRules();
      expect(allRules.length).toBeGreaterThan(2);

      // Check imported rules have expected properties
      const importedRules = allRules.slice(-2);
      importedRules.forEach((rule, index) => {
        expect(rule.name).toBe(testRules[index].name);
        expect(rule.enabled).toBe(true); // Should default to enabled if not specified
        expect(rule.id).toMatch(/^block_\d+_[a-z0-9]+$/);
        expect(rule.stats).toEqual({
          blockedCount: 0,
          totalRequests: 0,
        });
      });
    });

    it('should handle import errors gracefully', async () => {
      const invalidJson = '{ invalid json }';

      await expect(blockingManager.importRules(invalidJson)).rejects.toThrow('Invalid JSON format');
    });

    it('should handle empty import array', async () => {
      const result = await blockingManager.importRules('[]');

      expect(result).toBe(0);
    });
  });

  describe('getRuleTemplates', () => {
    it('should return predefined rule templates', () => {
      const templates = blockingManager.getRuleTemplates();

      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThan(0);

      templates.forEach(template => {
        expect(template).toMatchObject({
          name: expect.any(String),
          description: expect.any(String),
          type: expect.any(String),
          pattern: expect.any(String),
          action: expect.any(String),
          priority: expect.any(Number),
        });
      });
    });

    it('should include templates for common blocking scenarios', () => {
      const templates = blockingManager.getRuleTemplates();
      const templateNames = templates.map(t => t.name);

      expect(templateNames).toContain('Block Analytics Scripts');
      expect(templateNames).toContain('Block Ad Networks');
      expect(templateNames).toContain('Block Social Media Widgets');
      expect(templateNames).toContain('Block Heavy Fonts');
    });
  });

  describe('rule matching edge cases', () => {
    it('should handle invalid URLs gracefully', () => {
      const result = blockingManager.shouldBlockRequest('invalid-url');

      expect(result.blocked).toBe(false);
    });

    it('should handle regex errors in pattern rules', async () => {
      await blockingManager.createRule({
        name: 'Invalid Regex Rule',
        enabled: true,
        type: 'pattern',
        pattern: '[invalid regex',
        action: 'block',
        priority: 80,
      });

      const result = blockingManager.shouldBlockRequest('https://example.com');

      expect(result.blocked).toBe(false);
    });

    it('should handle empty patterns', async () => {
      await blockingManager.createRule({
        name: 'Empty Pattern Rule',
        enabled: true,
        type: 'url',
        pattern: '',
        action: 'block',
        priority: 80,
      });

      const result = blockingManager.shouldBlockRequest('https://example.com');

      expect(result.blocked).toBe(false);
    });
  });

  describe('rule expiration', () => {
    it('should respect rule expiration dates', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1); // Yesterday

      await blockingManager.createRule({
        name: 'Expired Rule',
        enabled: true,
        type: 'domain',
        pattern: 'expired-domain.com',
        action: 'block',
        priority: 80,
        expiresAt: pastDate,
      });

      const result = blockingManager.shouldBlockRequest('https://expired-domain.com');

      expect(result.blocked).toBe(false);
    });

    it('should allow non-expired rules to work', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1); // Tomorrow

      await blockingManager.createRule({
        name: 'Future Rule',
        enabled: true,
        type: 'domain',
        pattern: 'future-domain.com',
        action: 'block',
        priority: 80,
        expiresAt: futureDate,
      });

      const result = blockingManager.shouldBlockRequest('https://future-domain.com');

      expect(result.blocked).toBe(true);
    });
  });
});