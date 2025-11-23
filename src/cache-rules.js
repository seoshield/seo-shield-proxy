/**
 * Cache Rules Manager
 * Handles flexible caching logic based on URL patterns and meta tags
 */

class CacheRules {
  constructor(config) {
    // Parse NO_CACHE_PATTERNS - These URLs should NEVER be cached or rendered
    this.noCachePatterns = this.parsePatterns(config.NO_CACHE_PATTERNS);

    // Parse CACHE_PATTERNS - Only these URLs should be cached
    this.cachePatterns = this.parsePatterns(config.CACHE_PATTERNS);

    // Default behavior when URL doesn't match any pattern
    // true = cache everything by default
    // false = cache nothing by default (only explicit patterns)
    this.cacheByDefault = config.CACHE_BY_DEFAULT !== 'false';

    // Meta tag name to check in rendered HTML
    this.metaTagName = config.CACHE_META_TAG || 'x-seo-shield-cache';

    console.log('📋 Cache Rules initialized:');
    console.log(`   NO_CACHE patterns: ${this.noCachePatterns.length || 'none'}`);
    console.log(`   CACHE patterns: ${this.cachePatterns.length || 'none'}`);
    console.log(`   Cache by default: ${this.cacheByDefault}`);
    console.log(`   Meta tag name: ${this.metaTagName}`);
  }

  /**
   * Parse comma-separated patterns into regex array
   * @param {string} patterns - Comma-separated patterns
   * @returns {Array<RegExp>} - Array of regex patterns
   */
  parsePatterns(patterns) {
    if (!patterns || patterns.trim() === '') {
      return [];
    }

    return patterns
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
      .map((p) => {
        try {
          // If pattern starts and ends with /, treat as regex
          if (p.startsWith('/') && p.endsWith('/') && p.length > 2) {
            return new RegExp(p.slice(1, -1));
          }
          // Otherwise, escape special chars and use as literal match with wildcards
          // Convert * to .* for wildcard matching
          const escaped = p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
          return new RegExp(`^${escaped}$`);
        } catch (error) {
          console.error(`⚠️  Invalid pattern: ${p}`, error.message);
          return null;
        }
      })
      .filter((r) => r !== null);
  }

  /**
   * Check if URL matches any pattern in the array
   * @param {string} url - URL to check
   * @param {Array<RegExp>} patterns - Array of regex patterns
   * @returns {boolean} - True if matches
   */
  matchesAny(url, patterns) {
    return patterns.some((pattern) => pattern.test(url));
  }

  /**
   * Determine if a URL should be cached based on patterns
   * This does NOT check meta tags (that happens after rendering)
   * @param {string} url - Request URL path
   * @returns {object} - { shouldCache: boolean, reason: string, shouldRender: boolean }
   */
  shouldCacheUrl(url) {
    // PRIORITY 1: NO_CACHE patterns - Never cache, never render
    if (this.matchesAny(url, this.noCachePatterns)) {
      return {
        shouldRender: false,
        shouldCache: false,
        reason: 'NO_CACHE pattern match - proxy only',
      };
    }

    // PRIORITY 2: CACHE patterns - Explicitly cacheable
    if (this.cachePatterns.length > 0) {
      if (this.matchesAny(url, this.cachePatterns)) {
        return {
          shouldRender: true,
          shouldCache: true,
          reason: 'CACHE pattern match',
        };
      } else {
        // CACHE patterns defined but URL doesn't match any
        // Always render to allow meta tag check
        return {
          shouldRender: true,
          shouldCache: this.cacheByDefault,
          reason: this.cacheByDefault
            ? 'No pattern match - using default (cache)'
            : 'No CACHE pattern match - will check meta tag',
        };
      }
    }

    // PRIORITY 3: Default behavior (no patterns defined)
    return {
      shouldRender: true,
      shouldCache: this.cacheByDefault,
      reason: `Default behavior (cache: ${this.cacheByDefault})`,
    };
  }

  /**
   * Check rendered HTML for meta tag that controls caching
   * Meta tag example: <meta name="x-seo-shield-cache" content="false">
   * @param {string} html - Rendered HTML content
   * @returns {boolean} - True if should cache, False if meta tag says no
   */
  shouldCacheHtml(html) {
    // Look for meta tag in the HTML
    // Allow zero or more spaces between attributes
    const metaRegex = new RegExp(
      `<meta\\s+name=["']${this.metaTagName}["']\\s*content=["'](true|false)["']\\s*/?>`,
      'i'
    );

    const match = html.match(metaRegex);

    if (match) {
      const shouldCache = match[1].toLowerCase() === 'true';
      console.log(
        `🏷️  Meta tag detected: ${this.metaTagName}="${match[1]}" → ${shouldCache ? 'CACHE' : 'NO CACHE'}`
      );
      return shouldCache;
    }

    // No meta tag found - default to true (cache)
    return true;
  }

  /**
   * Main decision method - combines URL patterns and meta tag logic
   * Call this AFTER rendering to make final cache decision
   * @param {string} url - Request URL
   * @param {string} html - Rendered HTML (optional, if already rendered)
   * @returns {object} - Complete caching decision
   */
  getCacheDecision(url, html = null) {
    const urlDecision = this.shouldCacheUrl(url);

    // If URL rules say don't even render, respect that
    if (!urlDecision.shouldRender) {
      return {
        shouldRender: false,
        shouldCache: false,
        reason: urlDecision.reason,
      };
    }

    // If we have HTML, check for meta tag override
    if (html) {
      const metaAllowsCache = this.shouldCacheHtml(html);
      if (!metaAllowsCache) {
        return {
          shouldRender: true,
          shouldCache: false,
          reason: 'Meta tag override - no cache',
        };
      }
    }

    return urlDecision;
  }

  /**
   * Get cache statistics and current rules
   * @returns {object} - Rules summary
   */
  getRulesSummary() {
    return {
      noCachePatterns: this.noCachePatterns.map((r) => r.source),
      cachePatterns: this.cachePatterns.map((r) => r.source),
      cacheByDefault: this.cacheByDefault,
      metaTagName: this.metaTagName,
    };
  }
}

export default CacheRules;
