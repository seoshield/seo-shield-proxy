import { ICacheAdapter, CacheEntry, CacheStats } from './cache-interface.js';
import { MemoryCache } from './memory-cache.js';
import { RedisCache } from './redis-cache.js';
import config from '../config.js';

/**
 * Async wrapper for Redis cache to match synchronous interface
 * Uses promise caching for performance
 */
class AsyncCacheWrapper implements ICacheAdapter {
  private cache: RedisCache;
  private promiseCache = new Map<string, Promise<CacheEntry | undefined>>();

  constructor(cache: RedisCache) {
    this.cache = cache;
  }

  get(_key: string): string | undefined {
    // Not ideal for async operations, but maintains interface compatibility
    console.warn('⚠️  Synchronous get() on Redis is not recommended. Use getWithTTL() instead.');
    return undefined;
  }

  getWithTTL(key: string): CacheEntry | undefined {
    // Check promise cache first
    const cached = this.promiseCache.get(key);
    if (cached) {
      // Return cached promise result if available
      let result: CacheEntry | undefined;
      cached.then((r) => (result = r));
      if (result !== undefined) {
        return result;
      }
    }

    // Start async fetch (fire and forget)
    const promise = this.cache.getWithTTLAsync(key);
    this.promiseCache.set(key, promise);

    // Clean up promise cache after 100ms
    setTimeout(() => this.promiseCache.delete(key), 100);

    // Return undefined for first call (async limitation)
    return undefined;
  }

  set(key: string, value: string): boolean {
    return this.cache.set(key, value);
  }

  delete(key: string): number {
    return this.cache.delete(key);
  }

  flush(): void {
    this.cache.flush();
    this.promiseCache.clear();
  }

  getStats(): CacheStats {
    return this.cache.getStats();
  }

  keys(): string[] {
    return this.cache.keys();
  }

  getAllEntries(): Array<{ url: string; size: number; ttl: number }> {
    return this.cache.getAllEntries();
  }

  isReady(): boolean {
    return this.cache.isReady();
  }

  async close(): Promise<void> {
    this.promiseCache.clear();
    await this.cache.close();
  }

  // Expose async methods
  async getWithTTLAsync(key: string): Promise<CacheEntry | undefined> {
    return this.cache.getWithTTLAsync(key);
  }

  async getAsync(key: string): Promise<string | undefined> {
    return this.cache.getAsync(key);
  }

  async setAsync(key: string, value: string): Promise<boolean> {
    return this.cache.setAsync(key, value);
  }

  async deleteAsync(key: string): Promise<number> {
    return this.cache.deleteAsync(key);
  }

  async flushAsync(): Promise<void> {
    await this.cache.flushAsync();
    this.promiseCache.clear();
  }

  async getStatsAsync(): Promise<CacheStats> {
    return this.cache.getStatsAsync();
  }

  async keysAsync(): Promise<string[]> {
    return this.cache.keysAsync();
  }

  async getAllEntriesAsync(): Promise<Array<{ url: string; size: number; ttl: number }>> {
    return this.cache.getAllEntriesAsync();
  }
}

/**
 * Cache factory with automatic fallback
 * Tries Redis first, falls back to Memory cache if Redis unavailable
 */
export class CacheFactory {
  static async createCache(): Promise<ICacheAdapter> {
    const cacheType = config.CACHE_TYPE || 'memory';
    const redisUrl = config.REDIS_URL || 'redis://localhost:6379';

    console.log(`🏭 Cache factory: Creating ${cacheType} cache...`);

    if (cacheType === 'redis') {
      try {
        const redisCache = new RedisCache(redisUrl);

        // Wait for Redis to be ready (with timeout)
        const ready = await Promise.race([
          new Promise<boolean>((resolve) => {
            const checkReady = setInterval(() => {
              if (redisCache.isReady()) {
                clearInterval(checkReady);
                resolve(true);
              }
            }, 100);
          }),
          new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5000)),
        ]);

        if (ready) {
          console.log('✅ Redis cache ready');
          return new AsyncCacheWrapper(redisCache);
        } else {
          console.warn('⚠️  Redis connection timeout, falling back to memory cache');
          await redisCache.close();
          return new MemoryCache();
        }
      } catch (error) {
        console.error('❌ Redis cache creation failed:', (error as Error).message);
        console.log('🔄 Falling back to memory cache');
        return new MemoryCache();
      }
    }

    // Default: memory cache
    return new MemoryCache();
  }
}
