import { CacheFactory } from './cache/cache-factory';
import { ICacheAdapter } from './cache/cache-interface';
import { MemoryCache } from './cache/memory-cache';
import { Logger } from './utils/logger';

const logger = new Logger('Cache');

// Re-export types for backward compatibility
export type { CacheStats, CacheEntry } from './cache/cache-interface';

/**
 * Cache instance - initialized asynchronously
 * Uses CacheFactory to create either Redis or Memory cache based on CACHE_TYPE
 */
let cacheInstance: ICacheAdapter | null = null;
let initPromise: Promise<ICacheAdapter> | null = null;

/**
 * Initialize cache instance with fallback to memory cache
 */
async function initCache(): Promise<ICacheAdapter> {
  if (cacheInstance) {
    return cacheInstance;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      return await CacheFactory.createCache();
    } catch (error) {
      logger.error('Cache initialization failed, falling back to memory cache:', error);
      return new MemoryCache();
    }
  })();

  cacheInstance = await initPromise;
  initPromise = null;

  return cacheInstance;
}

/**
 * Get cache instance (auto-initializes if needed)
 * For synchronous access, use the default export (may be null during startup)
 */
export async function getCache(): Promise<ICacheAdapter> {
  return initCache();
}

// Initialize cache immediately with graceful fallback
initCache().catch((error) => {
  logger.error('Critical cache initialization failure:', error);
  // Create a basic memory cache as last resort
  cacheInstance = new MemoryCache();
  logger.warn('Using emergency memory cache fallback');
});

/**
 * Proxy cache instance for backward compatibility
 * Provides synchronous interface while cache is initializing
 */
const cacheProxy = new Proxy({} as ICacheAdapter, {
  get(_target, prop: string) {
    if (!cacheInstance) {
      // Cache not ready yet, return safe defaults
      if (prop === 'get' || prop === 'getWithTTL') {
        return (): undefined => undefined;
      }
      if (prop === 'set' || prop === 'delete') {
        return (): boolean => false;
      }
      if (prop === 'flush') {
        return (): void => {};
      }
      if (prop === 'getStats') {
        return (): { keys: number; hits: number; misses: number; ksize: number; vsize: number } => ({ keys: 0, hits: 0, misses: 0, ksize: 0, vsize: 0 });
      }
      if (prop === 'keys') {
        return (): string[] => [];
      }
      if (prop === 'getAllEntries') {
        return (): { url: string; ttl: number }[] => [];
      }
      if (prop === 'isReady') {
        return (): boolean => false;
      }
      if (prop === 'close') {
        return async (): Promise<void> => {};
      }
      return undefined;
    }

    const value = cacheInstance[prop as keyof ICacheAdapter];
    if (typeof value === 'function') {
      return value.bind(cacheInstance);
    }
    return value;
  },
});

// Default export for backward compatibility
export default cacheProxy;

// Graceful shutdown
process.on('SIGINT', async () => {
  if (cacheInstance) {
    await cacheInstance.close();
  }
});

process.on('SIGTERM', async () => {
  if (cacheInstance) {
    await cacheInstance.close();
  }
});
