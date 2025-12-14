import { ICacheAdapter, CacheEntry, CacheStats } from './cache-interface';
import { MemoryCache } from './memory-cache';
import { RedisCache } from './redis-cache';
import config from '../config';
import { Logger } from '../utils/logger';

const logger = new Logger('CacheFactory');

/**
 * Async wrapper for Redis cache to match synchronous interface
 * Uses local value cache for synchronous reads with background refresh
 */
class AsyncCacheWrapper implements ICacheAdapter {
  private cache: RedisCache;
  private valueCache = new Map<string, { entry: CacheEntry; timestamp: number }>();
  private pendingFetches = new Set<string>();
  private readonly VALUE_CACHE_TTL = 5000; // 5 seconds local cache

  constructor(cache: RedisCache) {
    this.cache = cache;
  }

  get(key: string): string | undefined {
    // Check local cache first
    const local = this.valueCache.get(key);
    if (local && Date.now() - local.timestamp < this.VALUE_CACHE_TTL) {
      return local.entry.value;
    }
    // Trigger background fetch
    this.backgroundFetch(key);
    return local?.entry.value;
  }

  getWithTTL(key: string): CacheEntry | undefined {
    // Check local cache first
    const local = this.valueCache.get(key);
    if (local && Date.now() - local.timestamp < this.VALUE_CACHE_TTL) {
      return local.entry;
    }
    // Trigger background fetch
    this.backgroundFetch(key);
    return local?.entry;
  }

  private backgroundFetch(key: string): void {
    // Avoid duplicate fetches
    if (this.pendingFetches.has(key)) return;
    this.pendingFetches.add(key);

    this.cache
      .getWithTTLAsync(key)
      .then((entry) => {
        if (entry) {
          this.valueCache.set(key, { entry, timestamp: Date.now() });
        }
      })
      .catch(() => {
        // Silently fail - value cache will serve stale data
      })
      .finally(() => {
        this.pendingFetches.delete(key);
      });
  }

  set(key: string, value: string): boolean {
    return this.cache.set(key, value);
  }

  delete(key: string): number {
    return this.cache.delete(key);
  }

  flush(): void {
    this.cache.flush();
    this.valueCache.clear();
    this.pendingFetches.clear();
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
    this.valueCache.clear();
    this.pendingFetches.clear();
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
    this.valueCache.clear();
    this.pendingFetches.clear();
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

    logger.info(`Creating ${cacheType} cache...`);

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
          logger.info('Redis cache ready');
          return new AsyncCacheWrapper(redisCache);
        } else {
          logger.warn('Redis connection timeout, falling back to memory cache');
          await redisCache.close();
          return new MemoryCache();
        }
      } catch (error) {
        logger.error('Redis cache creation failed:', (error as Error).message);
        logger.info('Falling back to memory cache');
        return new MemoryCache();
      }
    }

    // Default: memory cache
    return new MemoryCache();
  }
}
