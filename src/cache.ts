import { CacheFactory } from './cache/cache-factory.js';
import { ICacheAdapter} from './cache/cache-interface.js';

// Re-export types for backward compatibility
export type { CacheStats, CacheEntry } from './cache/cache-interface.js';

/**
 * Cache instance - initialized asynchronously
 * Uses CacheFactory to create either Redis or Memory cache based on CACHE_TYPE
 */
let cacheInstance: ICacheAdapter | null = null;
let initPromise: Promise<ICacheAdapter> | null = null;

/**
 * Initialize cache instance
 */
async function initCache(): Promise<ICacheAdapter> {
  if (cacheInstance) {
    return cacheInstance;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = CacheFactory.createCache();
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

// Initialize cache immediately
initCache().catch((error) => {
  console.error('❌ Failed to initialize cache:', error);
  process.exit(1);
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
        return () => undefined;
      }
      if (prop === 'set' || prop === 'delete') {
        return () => false;
      }
      if (prop === 'flush') {
        return () => {};
      }
      if (prop === 'getStats') {
        return () => ({ keys: 0, hits: 0, misses: 0, ksize: 0, vsize: 0 });
      }
      if (prop === 'keys') {
        return () => [];
      }
      if (prop === 'getAllEntries') {
        return () => [];
      }
      if (prop === 'isReady') {
        return () => false;
      }
      if (prop === 'close') {
        return async () => {};
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
