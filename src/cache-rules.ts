import { Config } from './config.js';

export interface CacheDecision {
  shouldRender: boolean;
  shouldCache: boolean;
  reason: string;
}

export interface RulesSummary {
  noCachePatterns: string[];
  cachePatterns: string[];
  cacheByDefault: boolean;
  metaTagName: string;
}

/**
 * Cache Rules Manager
 */
class CacheRules {
  private noCachePatterns: RegExp[];
  private cachePatterns: RegExp[];
  private cacheByDefault: boolean;
  private metaTagName: string;

  constructor(config: Config | { CACHE_BY_DEFAULT: string | boolean; [key: string]: unknown }) {
    this.noCachePatterns = this.parsePatterns((config as Config).NO_CACHE_PATTERNS || '');
    this.cachePatterns = this.parsePatterns((config as Config).CACHE_PATTERNS || '');

    // Handle both boolean and string values for CACHE_BY_DEFAULT
    const cacheByDefault = config.CACHE_BY_DEFAULT;
    this.cacheByDefault = cacheByDefault === 'false' ? false : Boolean(cacheByDefault);

    this.metaTagName = (config as Config).CACHE_META_TAG || 'x-seo-shield-cache';

    if (!/^[a-zA-Z0-9-_]+$/.test(this.metaTagName)) {
      console.error(`⚠️  Invalid meta tag name: ${this.metaTagName}, using default`);
      this.metaTagName = 'x-seo-shield-cache';
    }

    console.log('📋 Cache Rules initialized:');
    console.log(`   NO_CACHE patterns: ${this.noCachePatterns.length || 'none'}`);
    console.log(`   CACHE patterns: ${this.cachePatterns.length || 'none'}`);
    console.log(`   Cache by default: ${this.cacheByDefault}`);
    console.log(`   Meta tag name: ${this.metaTagName}`);
  }

  private parsePatterns(patterns: string): RegExp[] {
    if (!patterns || typeof patterns !== 'string' || patterns.trim() === '') {
      return [];
    }

    return patterns
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
      .map((p) => {
        try {
          if (p.startsWith('/') && p.endsWith('/') && p.length > 2) {
            const regexPattern = p.slice(1, -1);
            const regex = new RegExp(regexPattern);
            regex.test('/test');
            return regex;
          }
          const escaped = p
            .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '.*');
          return new RegExp(`^${escaped}$`);
        } catch (error) {
          console.error(`⚠️  Invalid pattern '${p}':`, (error as Error).message);
          return null;
        }
      })
      .filter((r): r is RegExp => r !== null);
  }

  private matchesAny(url: string, patterns: RegExp[]): boolean {
    return patterns.some((pattern) => pattern.test(url));
  }

  shouldCacheUrl(url: string): CacheDecision {
    if (this.matchesAny(url, this.noCachePatterns)) {
      return {
        shouldRender: false,
        shouldCache: false,
        reason: 'NO_CACHE pattern match - proxy only',
      };
    }

    if (this.cachePatterns.length > 0) {
      if (this.matchesAny(url, this.cachePatterns)) {
        return {
          shouldRender: true,
          shouldCache: true,
          reason: 'CACHE pattern match',
        };
      } else {
        return {
          shouldRender: true,
          shouldCache: this.cacheByDefault,
          reason: this.cacheByDefault
            ? 'No pattern match - using default (cache)'
            : 'No CACHE pattern match - will check meta tag',
        };
      }
    }

    return {
      shouldRender: true,
      shouldCache: this.cacheByDefault,
      reason: `Default behavior (cache: ${this.cacheByDefault})`,
    };
  }

  shouldCacheHtml(html: string): boolean {
    const metaRegex = new RegExp(
      `<meta\\s+name=["']${this.metaTagName}["']\\s*content=["'](true|false)["']\\s*/?>`,
      'i'
    );

    const match = html.match(metaRegex);

    if (match && match[1]) {
      const shouldCache = match[1].toLowerCase() === 'true';
      console.log(
        `🏷️  Meta tag detected: ${this.metaTagName}="${match[1]}" → ${shouldCache ? 'CACHE' : 'NO CACHE'}`
      );
      return shouldCache;
    }

    return true;
  }

  getCacheDecision(url: string, html: string | null = null): CacheDecision {
    const urlDecision = this.shouldCacheUrl(url);

    if (!urlDecision.shouldRender) {
      return {
        shouldRender: false,
        shouldCache: false,
        reason: urlDecision.reason,
      };
    }

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

  getRulesSummary(): RulesSummary {
    return {
      noCachePatterns: this.noCachePatterns.map((r) => r.source),
      cachePatterns: this.cachePatterns.map((r) => r.source),
      cacheByDefault: this.cacheByDefault,
      metaTagName: this.metaTagName,
    };
  }
}

export default CacheRules;
