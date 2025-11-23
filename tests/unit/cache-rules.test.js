/**
 * Unit Tests for src/cache-rules.js
 * Tests URL pattern matching, meta tag detection, and caching decisions
 */

import { jest } from '@jest/globals';
import CacheRules from '../../src/cache-rules.js';

describe('CacheRules Module', () => {
  describe('Pattern Parsing', () => {
    test('should parse literal paths', () => {
      const rules = new CacheRules({
        NO_CACHE_PATTERNS: '/checkout,/cart,/login',
        CACHE_PATTERNS: '',
        CACHE_BY_DEFAULT: 'true',
        CACHE_META_TAG: 'x-cache',
      });

      const summary = rules.getRulesSummary();
      expect(summary.noCachePatterns).toHaveLength(3);
    });

    test('should parse wildcard patterns', () => {
      const rules = new CacheRules({
        NO_CACHE_PATTERNS: '/admin/*,/api/*',
        CACHE_PATTERNS: '',
        CACHE_BY_DEFAULT: 'true',
        CACHE_META_TAG: 'x-cache',
      });

      const decision = rules.shouldCacheUrl('/admin/users');
      expect(decision.shouldRender).toBe(false);
    });

    test('should parse regex patterns', () => {
      const rules = new CacheRules({
        NO_CACHE_PATTERNS: '/\\/blog\\/[0-9]+\\/edit/',
        CACHE_PATTERNS: '',
        CACHE_BY_DEFAULT: 'true',
        CACHE_META_TAG: 'x-cache',
      });

      const decision = rules.shouldCacheUrl('/blog/123/edit');
      expect(decision.shouldRender).toBe(false);
    });

    test('should handle empty patterns', () => {
      const rules = new CacheRules({
        NO_CACHE_PATTERNS: '',
        CACHE_PATTERNS: '',
        CACHE_BY_DEFAULT: 'true',
        CACHE_META_TAG: 'x-cache',
      });

      const summary = rules.getRulesSummary();
      expect(summary.noCachePatterns).toHaveLength(0);
      expect(summary.cachePatterns).toHaveLength(0);
    });

    test('should ignore whitespace in patterns', () => {
      const rules = new CacheRules({
        NO_CACHE_PATTERNS: ' /checkout , /cart , /admin/* ',
        CACHE_PATTERNS: '',
        CACHE_BY_DEFAULT: 'true',
        CACHE_META_TAG: 'x-cache',
      });

      expect(rules.shouldCacheUrl('/checkout').shouldRender).toBe(false);
      expect(rules.shouldCacheUrl('/cart').shouldRender).toBe(false);
      expect(rules.shouldCacheUrl('/admin/test').shouldRender).toBe(false);
    });

    test('should handle invalid regex gracefully', () => {
      const rules = new CacheRules({
        NO_CACHE_PATTERNS: '/[invalid(/',
        CACHE_PATTERNS: '',
        CACHE_BY_DEFAULT: 'true',
        CACHE_META_TAG: 'x-cache',
      });

      // Invalid pattern should be ignored
      const summary = rules.getRulesSummary();
      expect(summary.noCachePatterns.length).toBeLessThan(2);
    });
  });

  describe('NO_CACHE_PATTERNS Priority', () => {
    let rules;

    beforeEach(() => {
      rules = new CacheRules({
        NO_CACHE_PATTERNS: '/checkout,/cart,/admin/*,/api/*',
        CACHE_PATTERNS: '',
        CACHE_BY_DEFAULT: 'true',
        CACHE_META_TAG: 'x-cache',
      });
    });

    test('should not render NO_CACHE pattern URLs', () => {
      expect(rules.shouldCacheUrl('/checkout').shouldRender).toBe(false);
      expect(rules.shouldCacheUrl('/cart').shouldRender).toBe(false);
      expect(rules.shouldCacheUrl('/admin/users').shouldRender).toBe(false);
      expect(rules.shouldCacheUrl('/api/data').shouldRender).toBe(false);
    });

    test('should not cache NO_CACHE pattern URLs', () => {
      expect(rules.shouldCacheUrl('/checkout').shouldCache).toBe(false);
      expect(rules.shouldCacheUrl('/cart').shouldCache).toBe(false);
    });

    test('should provide correct reason for NO_CACHE patterns', () => {
      const decision = rules.shouldCacheUrl('/checkout');
      expect(decision.reason).toContain('NO_CACHE pattern');
    });

    test('should match wildcard patterns correctly', () => {
      expect(rules.shouldCacheUrl('/admin/users').shouldRender).toBe(false);
      expect(rules.shouldCacheUrl('/admin/settings/profile').shouldRender).toBe(false);
      expect(rules.shouldCacheUrl('/api/v1/users').shouldRender).toBe(false);
    });

    test('should not match partial paths', () => {
      // /admin/* should NOT match /administrator
      expect(rules.shouldCacheUrl('/administrator').shouldRender).toBe(true);
    });
  });

  describe('CACHE_PATTERNS Whitelist Mode', () => {
    let rules;

    beforeEach(() => {
      rules = new CacheRules({
        NO_CACHE_PATTERNS: '',
        CACHE_PATTERNS: '/blog/*,/products/*,/about',
        CACHE_BY_DEFAULT: 'false',
        CACHE_META_TAG: 'x-cache',
      });
    });

    test('should cache URLs matching CACHE_PATTERNS', () => {
      expect(rules.shouldCacheUrl('/blog/post-1').shouldCache).toBe(true);
      expect(rules.shouldCacheUrl('/products/item-123').shouldCache).toBe(true);
      expect(rules.shouldCacheUrl('/about').shouldCache).toBe(true);
    });

    test('should not cache URLs not matching CACHE_PATTERNS', () => {
      expect(rules.shouldCacheUrl('/contact').shouldCache).toBe(false);
      expect(rules.shouldCacheUrl('/dashboard').shouldCache).toBe(false);
    });

    test('should still render non-matching URLs when CACHE_BY_DEFAULT is false', () => {
      // Should render but not cache (to allow meta tag check)
      const decision = rules.shouldCacheUrl('/contact');
      expect(decision.shouldRender).toBe(true);
      expect(decision.shouldCache).toBe(false);
    });
  });

  describe('CACHE_BY_DEFAULT Behavior', () => {
    test('should cache everything by default when true', () => {
      const rules = new CacheRules({
        NO_CACHE_PATTERNS: '',
        CACHE_PATTERNS: '',
        CACHE_BY_DEFAULT: 'true',
        CACHE_META_TAG: 'x-cache',
      });

      expect(rules.shouldCacheUrl('/any-page').shouldCache).toBe(true);
      expect(rules.shouldCacheUrl('/random-path').shouldCache).toBe(true);
    });

    test('should not cache anything by default when false', () => {
      const rules = new CacheRules({
        NO_CACHE_PATTERNS: '',
        CACHE_PATTERNS: '',
        CACHE_BY_DEFAULT: 'false',
        CACHE_META_TAG: 'x-cache',
      });

      expect(rules.shouldCacheUrl('/any-page').shouldCache).toBe(false);
      expect(rules.shouldCacheUrl('/random-path').shouldCache).toBe(false);
    });
  });

  describe('Meta Tag Detection', () => {
    let rules;

    beforeEach(() => {
      rules = new CacheRules({
        NO_CACHE_PATTERNS: '',
        CACHE_PATTERNS: '',
        CACHE_BY_DEFAULT: 'true',
        CACHE_META_TAG: 'x-seo-shield-cache',
      });
    });

    test('should detect meta tag with false value', () => {
      const html = `
        <html>
          <head>
            <meta name="x-seo-shield-cache" content="false">
          </head>
        </html>
      `;

      expect(rules.shouldCacheHtml(html)).toBe(false);
    });

    test('should detect meta tag with true value', () => {
      const html = `
        <html>
          <head>
            <meta name="x-seo-shield-cache" content="true">
          </head>
        </html>
      `;

      expect(rules.shouldCacheHtml(html)).toBe(true);
    });

    test('should default to true when no meta tag present', () => {
      const html = '<html><head></head><body>No meta tag</body></html>';
      expect(rules.shouldCacheHtml(html)).toBe(true);
    });

    test('should be case-insensitive for content value', () => {
      const htmlTrue = '<meta name="x-seo-shield-cache" content="TRUE">';
      const htmlFalse = '<meta name="x-seo-shield-cache" content="FALSE">';

      expect(rules.shouldCacheHtml(htmlTrue)).toBe(true);
      expect(rules.shouldCacheHtml(htmlFalse)).toBe(false);
    });

    test('should handle self-closing meta tags', () => {
      const html = '<meta name="x-seo-shield-cache" content="false" />';
      expect(rules.shouldCacheHtml(html)).toBe(false);
    });

    test('should handle meta tag without spaces', () => {
      const html = '<meta name="x-seo-shield-cache"content="false">';
      expect(rules.shouldCacheHtml(html)).toBe(false);
    });

    test('should only match exact meta tag name', () => {
      const html = '<meta name="other-tag" content="false">';
      expect(rules.shouldCacheHtml(html)).toBe(true); // Not our tag, default to true
    });
  });

  describe('getCacheDecision() - Combined Logic', () => {
    test('should prioritize NO_CACHE_PATTERNS over meta tag', () => {
      const rules = new CacheRules({
        NO_CACHE_PATTERNS: '/admin/*',
        CACHE_PATTERNS: '',
        CACHE_BY_DEFAULT: 'true',
        CACHE_META_TAG: 'x-cache',
      });

      // Even if HTML says cache=true, NO_CACHE pattern wins
      const html = '<meta name="x-cache" content="true">';
      const decision = rules.getCacheDecision('/admin/page', html);

      expect(decision.shouldRender).toBe(false);
      expect(decision.shouldCache).toBe(false);
    });

    test('should apply meta tag override to URL decision', () => {
      const rules = new CacheRules({
        NO_CACHE_PATTERNS: '',
        CACHE_PATTERNS: '',
        CACHE_BY_DEFAULT: 'true',
        CACHE_META_TAG: 'x-cache',
      });

      // URL says cache, but meta tag says no
      const html = '<meta name="x-cache" content="false">';
      const decision = rules.getCacheDecision('/page', html);

      expect(decision.shouldRender).toBe(true);
      expect(decision.shouldCache).toBe(false);
      expect(decision.reason).toContain('Meta tag override');
    });

    test('should work without HTML (URL decision only)', () => {
      const rules = new CacheRules({
        NO_CACHE_PATTERNS: '',
        CACHE_PATTERNS: '',
        CACHE_BY_DEFAULT: 'true',
        CACHE_META_TAG: 'x-cache',
      });

      const decision = rules.getCacheDecision('/page', null);
      expect(decision.shouldCache).toBe(true);
    });

    test('should use URL decision when meta tag allows caching', () => {
      const rules = new CacheRules({
        NO_CACHE_PATTERNS: '',
        CACHE_PATTERNS: '/blog/*',
        CACHE_BY_DEFAULT: 'false',
        CACHE_META_TAG: 'x-cache',
      });

      const html = '<meta name="x-cache" content="true">';
      const decision = rules.getCacheDecision('/blog/post', html);

      expect(decision.shouldCache).toBe(true);
      expect(decision.reason).toContain('CACHE pattern match');
    });
  });

  describe('Priority Order', () => {
    test('should follow correct priority: NO_CACHE > Meta Tag > CACHE_PATTERNS > DEFAULT', () => {
      const rules = new CacheRules({
        NO_CACHE_PATTERNS: '/admin/*',
        CACHE_PATTERNS: '/blog/*',
        CACHE_BY_DEFAULT: 'false',
        CACHE_META_TAG: 'x-cache',
      });

      // 1. NO_CACHE wins (highest priority)
      expect(rules.shouldCacheUrl('/admin/page').shouldRender).toBe(false);

      // 2. CACHE_PATTERNS (when NO_CACHE doesn't match)
      expect(rules.shouldCacheUrl('/blog/post').shouldCache).toBe(true);

      // 3. DEFAULT (when nothing matches)
      expect(rules.shouldCacheUrl('/other').shouldCache).toBe(false);
    });
  });

  describe('getRulesSummary()', () => {
    test('should return complete summary', () => {
      const rules = new CacheRules({
        NO_CACHE_PATTERNS: '/admin/*,/api/*',
        CACHE_PATTERNS: '/blog/*',
        CACHE_BY_DEFAULT: 'true',
        CACHE_META_TAG: 'custom-tag',
      });

      const summary = rules.getRulesSummary();

      expect(summary).toHaveProperty('noCachePatterns');
      expect(summary).toHaveProperty('cachePatterns');
      expect(summary).toHaveProperty('cacheByDefault');
      expect(summary).toHaveProperty('metaTagName');
      expect(summary.metaTagName).toBe('custom-tag');
      expect(summary.cacheByDefault).toBe(true);
    });

    test('should return regex source strings', () => {
      const rules = new CacheRules({
        NO_CACHE_PATTERNS: '/admin/*',
        CACHE_PATTERNS: '',
        CACHE_BY_DEFAULT: 'true',
        CACHE_META_TAG: 'x-cache',
      });

      const summary = rules.getRulesSummary();
      expect(Array.isArray(summary.noCachePatterns)).toBe(true);
      expect(typeof summary.noCachePatterns[0]).toBe('string');
    });
  });

  describe('Complex Pattern Matching', () => {
    test('should match nested wildcards', () => {
      const rules = new CacheRules({
        NO_CACHE_PATTERNS: '/user/*/settings/*',
        CACHE_PATTERNS: '',
        CACHE_BY_DEFAULT: 'true',
        CACHE_META_TAG: 'x-cache',
      });

      expect(rules.shouldCacheUrl('/user/123/settings/profile').shouldRender).toBe(false);
      expect(rules.shouldCacheUrl('/user/abc/settings/privacy').shouldRender).toBe(false);
    });

    test('should match query parameters', () => {
      const rules = new CacheRules({
        NO_CACHE_PATTERNS: '/search*',
        CACHE_PATTERNS: '',
        CACHE_BY_DEFAULT: 'true',
        CACHE_META_TAG: 'x-cache',
      });

      expect(rules.shouldCacheUrl('/search?q=test').shouldRender).toBe(false);
    });

    test('should differentiate between similar paths', () => {
      const rules = new CacheRules({
        NO_CACHE_PATTERNS: '/admin',
        CACHE_PATTERNS: '',
        CACHE_BY_DEFAULT: 'true',
        CACHE_META_TAG: 'x-cache',
      });

      expect(rules.shouldCacheUrl('/admin').shouldRender).toBe(false);
      expect(rules.shouldCacheUrl('/admin/').shouldRender).toBe(true);
      expect(rules.shouldCacheUrl('/administrator').shouldRender).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty URL', () => {
      const rules = new CacheRules({
        NO_CACHE_PATTERNS: '',
        CACHE_PATTERNS: '',
        CACHE_BY_DEFAULT: 'true',
        CACHE_META_TAG: 'x-cache',
      });

      const decision = rules.shouldCacheUrl('');
      expect(decision).toHaveProperty('shouldRender');
      expect(decision).toHaveProperty('shouldCache');
    });

    test('should handle root path', () => {
      const rules = new CacheRules({
        NO_CACHE_PATTERNS: '',
        CACHE_PATTERNS: '/',
        CACHE_BY_DEFAULT: 'false',
        CACHE_META_TAG: 'x-cache',
      });

      expect(rules.shouldCacheUrl('/').shouldCache).toBe(true);
    });

    test('should handle malformed HTML in meta tag detection', () => {
      const rules = new CacheRules({
        NO_CACHE_PATTERNS: '',
        CACHE_PATTERNS: '',
        CACHE_BY_DEFAULT: 'true',
        CACHE_META_TAG: 'x-cache',
      });

      const html = '<meta name="x-cache" content=';
      expect(rules.shouldCacheHtml(html)).toBe(true); // Default when no valid tag
    });

    test('should handle multiple meta tags (use first match)', () => {
      const rules = new CacheRules({
        NO_CACHE_PATTERNS: '',
        CACHE_PATTERNS: '',
        CACHE_BY_DEFAULT: 'true',
        CACHE_META_TAG: 'x-cache',
      });

      const html = `
        <meta name="x-cache" content="false">
        <meta name="x-cache" content="true">
      `;

      expect(rules.shouldCacheHtml(html)).toBe(false); // First match wins
    });
  });

  describe('Configuration Variations', () => {
    test('should work with only NO_CACHE_PATTERNS', () => {
      const rules = new CacheRules({
        NO_CACHE_PATTERNS: '/admin/*',
        CACHE_PATTERNS: '',
        CACHE_BY_DEFAULT: 'true',
        CACHE_META_TAG: 'x-cache',
      });

      expect(rules.shouldCacheUrl('/admin/test').shouldCache).toBe(false);
      expect(rules.shouldCacheUrl('/public').shouldCache).toBe(true);
    });

    test('should work with only CACHE_PATTERNS', () => {
      const rules = new CacheRules({
        NO_CACHE_PATTERNS: '',
        CACHE_PATTERNS: '/blog/*',
        CACHE_BY_DEFAULT: 'false',
        CACHE_META_TAG: 'x-cache',
      });

      expect(rules.shouldCacheUrl('/blog/post').shouldCache).toBe(true);
      expect(rules.shouldCacheUrl('/other').shouldCache).toBe(false);
    });

    test('should work with both pattern types', () => {
      const rules = new CacheRules({
        NO_CACHE_PATTERNS: '/admin/*',
        CACHE_PATTERNS: '/blog/*,/products/*',
        CACHE_BY_DEFAULT: 'false',
        CACHE_META_TAG: 'x-cache',
      });

      expect(rules.shouldCacheUrl('/admin/test').shouldRender).toBe(false);
      expect(rules.shouldCacheUrl('/blog/post').shouldCache).toBe(true);
      expect(rules.shouldCacheUrl('/other').shouldCache).toBe(false);
    });
  });
});
