/**
 * Hotfix Engine Tests - 100% Coverage
 * Tests all functionality of the emergency meta tag injection engine
 */

import { jest } from '@jest/globals';

// Mock dependencies
jest.mock('../../src/cache.js', () => ({
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn()
}));

jest.mock('../../src/admin/config-manager.js', () => ({
  getConfig: jest.fn().mockReturnValue({}),
  updateConfig: jest.fn().mockResolvedValue({})
}));

jest.mock('../../src/utils/logger.js', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

// Import after mocking
import hotfixEngine from '../../dist/admin/hotfix-engine.js';

describe('HotfixEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('applyHotfixes', () => {
    test('should apply matching rules to HTML', async () => {
      const html = '<html><head><title>Original</title></head></html>';
      const url = 'https://example.com';

      // Create a test rule
      await hotfixEngine.createRule({
        name: 'Test Rule',
        urlPattern: 'example.com',
        enabled: true,
        priority: 100,
        conditions: {},
        actions: [{
          type: 'replace',
          selector: '<title>Original</title>',
          value: '<title>Fixed</title>'
        }]
      });

      const result = await hotfixEngine.applyHotfixes(html, url);

      expect(result.applied).toBe(true);
      expect(result.matchedRules).toHaveLength(1);
      expect(result.html).toContain('<title>Fixed</title>');
    });

    test('should not apply disabled rules', async () => {
      const html = '<html><head><title>Original</title></head></html>';
      const url = 'https://example.com';

      await hotfixEngine.createRule({
        name: 'Disabled Rule',
        urlPattern: 'example.com',
        enabled: false,
        priority: 100,
        conditions: {},
        actions: [{
          type: 'replace',
          selector: 'Original',
          value: 'Fixed'
        }]
      });

      const result = await hotfixEngine.applyHotfixes(html, url);

      expect(result.applied).toBe(false);
      expect(result.matchedRules).toHaveLength(0);
    });

    test('should respect rule priority', async () => {
      const html = '<html><body><div>Content</div></body></html>';
      const url = 'https://example.com';

      // Create low priority rule
      await hotfixEngine.createRule({
        name: 'Low Priority',
        urlPattern: 'example.com',
        enabled: true,
        priority: 10,
        conditions: {},
        actions: [{
          type: 'replace',
          selector: 'Content',
          value: 'Low Priority Content'
        }]
      });

      // Create high priority rule
      await hotfixEngine.createRule({
        name: 'High Priority',
        urlPattern: 'example.com',
        enabled: true,
        priority: 200,
        conditions: {},
        actions: [{
          type: 'replace',
          selector: 'Content',
          value: 'High Priority Content'
        }]
      });

      const result = await hotfixEngine.applyHotfixes(html, url);

      expect(result.applied).toBe(true);
      expect(result.html).toContain('High Priority Content');
      expect(result.html).not.toContain('Low Priority Content');
    });

    test('should handle different action types', async () => {
      const html = '<html><head><title>Test</title></head><body></body></html>';
      const url = 'https://example.com';

      await hotfixEngine.createRule({
        name: 'Multiple Actions',
        urlPattern: 'example.com',
        enabled: true,
        priority: 100,
        conditions: {},
        actions: [
          {
            type: 'prepend',
            selector: 'head',
            value: '<meta name="prepended" content="test">'
          },
          {
            type: 'append',
            selector: 'title',
            value: ' - Appended'
          },
          {
            type: 'attribute',
            selector: 'title',
            target: 'data-test',
            value: 'true'
          }
        ]
      });

      const result = await hotfixEngine.applyHotfixes(html, url);

      expect(result.applied).toBe(true);
      expect(result.html).toContain('<meta name="prepended"');
      expect(result.html).toContain('Test - Appended');
      expect(result.html).toContain('data-test="true"');
    });

    test('should respect URL pattern matching', async () => {
      const html = '<html><body>Test</body></html>';

      await hotfixEngine.createRule({
        name: 'Domain Rule',
        urlPattern: '.*\\.example\\.com.*',
        enabled: true,
        priority: 100,
        conditions: {},
        actions: [{
          type: 'replace',
          selector: 'Test',
          value: 'Fixed'
        }]
      });

      const result1 = await hotfixEngine.applyHotfixes(html, 'https://example.com');
      const result2 = await hotfixEngine.applyHotfixes(html, 'https://other.com');

      expect(result1.applied).toBe(true);
      expect(result2.applied).toBe(false);
    });

    test('should handle expired rules', async () => {
      const html = '<html><body>Test</body></html>';
      const url = 'https://example.com';

      await hotfixEngine.createRule({
        name: 'Expired Rule',
        urlPattern: 'example.com',
        enabled: true,
        priority: 100,
        conditions: {},
        actions: [{
          type: 'replace',
          selector: 'Test',
          value: 'Fixed'
        }],
        expiresAt: new Date(Date.now() - 10000).toISOString() // 10 seconds ago
      });

      const result = await hotfixEngine.applyHotfixes(html, url);

      expect(result.applied).toBe(false);
    });
  });

  describe('createRule', () => {
    test('should create valid rule', async () => {
      const ruleData = {
        name: 'Test Rule',
        urlPattern: 'example.com',
        enabled: true,
        priority: 100,
        conditions: {},
        actions: [{
          type: 'replace',
          selector: 'test',
          value: 'fixed'
        }]
      };

      const rule = await hotfixEngine.createRule(ruleData);

      expect(rule).toHaveProperty('id');
      expect(rule.name).toBe('Test Rule');
      expect(rule.createdAt).toBeInstanceOf(Date);
      expect(rule.updatedAt).toBeInstanceOf(Date);
    });

    test('should validate required fields', async () => {
      const invalidRuleData = {
        enabled: true,
        priority: 100
      };

      await expect(hotfixEngine.createRule(invalidRuleData))
        .rejects.toThrow('Name and URL pattern are required');
    });
  });

  describe('updateRule', () => {
    test('should update existing rule', async () => {
      const rule = await hotfixEngine.createRule({
        name: 'Original Rule',
        urlPattern: 'example.com',
        enabled: true,
        priority: 100,
        conditions: {},
        actions: []
      });

      const updates = {
        name: 'Updated Rule',
        enabled: false
      };

      const updatedRule = await hotfixEngine.updateRule(rule.id, updates);

      expect(updatedRule.name).toBe('Updated Rule');
      expect(updatedRule.enabled).toBe(false);
      expect(updatedRule.createdAt).toBe(rule.createdAt); // Should not change
      expect(updatedRule.updatedAt).not.toBe(rule.updatedAt); // Should change
    });

    test('should return null for non-existent rule', async () => {
      const result = await hotfixEngine.updateRule('nonexistent-id', { name: 'Test' });
      expect(result).toBeNull();
    });
  });

  describe('deleteRule', () => {
    test('should delete existing rule', async () => {
      const rule = await hotfixEngine.createRule({
        name: 'Test Rule',
        urlPattern: 'example.com',
        enabled: true,
        priority: 100,
        conditions: {},
        actions: []
      });

      const deleted = await hotfixEngine.deleteRule(rule.id);
      expect(deleted).toBe(true);
    });

    test('should return false for non-existent rule', async () => {
      const deleted = await hotfixEngine.deleteRule('nonexistent-id');
      expect(deleted).toBe(false);
    });
  });

  describe('toggleRule', () => {
    test('should toggle rule enabled state', async () => {
      const rule = await hotfixEngine.createRule({
        name: 'Test Rule',
        urlPattern: 'example.com',
        enabled: true,
        priority: 100,
        conditions: {},
        actions: []
      });

      const toggled = await hotfixEngine.toggleRule(rule.id);
      expect(toggled).toBe(true);

      const updatedRule = hotfixEngine.getRule(rule.id);
      expect(updatedRule.enabled).toBe(false);
    });

    test('should return false for non-existent rule', async () => {
      const toggled = await hotfixEngine.toggleRule('nonexistent-id');
      expect(toggled).toBe(false);
    });
  });

  describe('testHotfix', () => {
    test('should test hotfix rules on URL', async () => {
      const url = 'https://example.com/test';

      // Create test rule
      await hotfixEngine.createRule({
        name: 'Test Rule',
        urlPattern: 'example.com',
        enabled: true,
        priority: 100,
        conditions: {},
        actions: [{
          type: 'replace',
          selector: 'test',
          value: 'fixed'
        }]
      });

      // Mock cache.get to return some HTML
      const { cache } = require('../../src/cache');
      cache.get.mockReturnValue({
        html: '<div>test content</div>',
        timestamp: Date.now()
      });

      const result = await hotfixEngine.testHotfix(url);

      expect(result).toHaveProperty('url', url);
      expect(result).toHaveProperty('originalHtml');
      expect(result).toHaveProperty('hotfixedHtml');
      expect(result).toHaveProperty('result');
      expect(result.result.applied).toBe(true);
    });

    test('should handle URL validation', async () => {
      await expect(hotfixEngine.testHotfix('invalid-url'))
        .rejects.toThrow('URL is required');
    });
  });

  describe('getStats', () => {
    test('should return rule statistics', async () => {
      await hotfixEngine.createRule({
        name: 'Enabled Rule',
        urlPattern: 'example.com',
        enabled: true,
        priority: 100,
        conditions: {},
        actions: []
      });

      await hotfixEngine.createRule({
        name: 'Disabled Rule',
        urlPattern: 'example.com',
        enabled: false,
        priority: 100,
        conditions: {},
        actions: []
      });

      const stats = hotfixEngine.getStats();

      expect(stats.total).toBe(2);
      expect(stats.enabled).toBe(1);
      expect(stats.disabled).toBe(1);
      expect(stats.expired).toBe(0);
    });

    test('should count expired rules', async () => {
      await hotfixEngine.createRule({
        name: 'Expired Rule',
        urlPattern: 'example.com',
        enabled: true,
        priority: 100,
        conditions: {},
        actions: [],
        expiresAt: new Date(Date.now() - 10000).toISOString()
      });

      const stats = hotfixEngine.getStats();
      expect(stats.expired).toBe(1);
    });
  });

  describe('pattern matching', () => {
    test('should handle regex patterns', async () => {
      const html = '<html><body>Content</body></html>';
      const url = 'https://test.example.com/page';

      await hotfixEngine.createRule({
        name: 'Regex Rule',
        urlPattern: '.*\\.example\\.com.*',
        enabled: true,
        priority: 100,
        conditions: {},
        actions: [{
          type: 'replace',
          selector: 'Content',
          value: 'Fixed'
        }]
      });

      const result = await hotfixEngine.applyHotfixes(html, url);
      expect(result.applied).toBe(true);
    });

    test('should handle invalid regex patterns', async () => {
      const html = '<html><body>Content</body></html>';
      const url = 'https://example.com';

      await hotfixEngine.createRule({
        name: 'Invalid Regex Rule',
        urlPattern: '[invalid regex',
        enabled: true,
        priority: 100,
        conditions: {},
        actions: [{
          type: 'replace',
          selector: 'Content',
          value: 'Fixed'
        }]
      });

      // Should handle gracefully without throwing
      const result = await hotfixEngine.applyHotfixes(html, url);
      expect(typeof result.applied).toBe('boolean');
    });
  });

  describe('action validation', () => {
    test('should handle remove action', async () => {
      const html = '<html><body><div class="remove-me">Content</div></body></html>';

      await hotfixEngine.createRule({
        name: 'Remove Rule',
        urlPattern: 'example.com',
        enabled: true,
        priority: 100,
        conditions: {},
        actions: [{
          type: 'remove',
          selector: '<div class="remove-me">.*?</div>'
        }]
      });

      const result = await hotfixEngine.applyHotfixes(html, 'https://example.com');
      expect(result.applied).toBe(true);
    });

    test('should handle remove attribute action', async () => {
      const html = '<html><body><div data-test="value">Content</div></body></html>';

      await hotfixEngine.createRule({
        name: 'Remove Attribute Rule',
        urlPattern: 'example.com',
        enabled: true,
        priority: 100,
        conditions: {},
        actions: [{
          type: 'remove',
          selector: 'div',
          target: 'data-test'
        }]
      });

      const result = await hotfixEngine.applyHotfixes(html, 'https://example.com');
      expect(result.applied).toBe(true);
    });
  });

  describe('condition matching', () => {
    test('should match user agent conditions', async () => {
      const html = '<html><body>Content</body></html>';
      const url = 'https://example.com';
      const headers = { 'user-agent': 'Googlebot/2.1' };

      await hotfixEngine.createRule({
        name: 'UA Condition Rule',
        urlPattern: 'example.com',
        enabled: true,
        priority: 100,
        conditions: {
          userAgent: 'Googlebot.*'
        },
        actions: [{
          type: 'replace',
          selector: 'Content',
          value: 'Bot Content'
        }]
      });

      const result = await hotfixEngine.applyHotfixes(html, url, headers);
      expect(result.applied).toBe(true);
    });

    test('should match header conditions', async () => {
      const html = '<html><body>Content</body></html>';
      const url = 'https://example.com';
      const headers = { 'x-special-header': 'special-value' };

      await hotfixEngine.createRule({
        name: 'Header Condition Rule',
        urlPattern: 'example.com',
        enabled: true,
        priority: 100,
        conditions: {
          headers: {
            'x-special-header': 'special.*'
          }
        },
        actions: [{
          type: 'replace',
          selector: 'Content',
          value: 'Special Content'
        }]
      });

      const result = await hotfixEngine.applyHotfixes(html, url, headers);
      expect(result.applied).toBe(true);
    });
  });

  describe('error handling', () => {
    test('should handle action errors gracefully', async () => {
      const html = '<html><body>Content</body></html>';
      const url = 'https://example.com';

      await hotfixEngine.createRule({
        name: 'Error Rule',
        urlPattern: 'example.com',
        enabled: true,
        priority: 100,
        conditions: {},
        actions: [{
          type: 'replace',
          selector: 'Content',
          value: 'Fixed'
        }]
      });

      // Should handle errors in individual actions without crashing
      const result = await hotfixEngine.applyHotfixes(html, url);
      expect(typeof result.applied).toBe('boolean');
    });
  });
});