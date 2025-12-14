import { createClient, RedisClientType } from 'redis';
import { ICacheAdapter, CacheStats, CacheEntry } from './cache-interface';
import { Logger } from '../utils/logger';

const logger = new Logger('RedisCache');

/**
 * Redis cache adapter
 * Persistent and scalable cache (survives restarts, shared across pods)
 */
export class RedisCache implements ICacheAdapter {
  private client: RedisClientType;
  private ready = false;
  private stats = {
    hits: 0,
    misses: 0,
  };

  constructor(redisUrl: string) {
    logger.info(`Connecting to Redis: ${redisUrl}`);

    this.client = createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 5000,
        reconnectStrategy: (retries: number) => {
          if (retries > 3) return new Error('Max retries reached');
          return Math.min(retries * 100, 3000);
        },
      },
    });

    this.client.on('connect', () => {
      logger.info('Redis connecting...');
    });

    this.client.on('ready', () => {
      this.ready = true;
      logger.info('Redis cache connected');
    });

    this.client.on('error', (error: Error) => {
      logger.error('Redis connection error:', error.message);
      this.ready = false;
    });

    this.client.on('end', () => {
      logger.warn('Redis connection ended');
      this.ready = false;
    });

    this.client.on('reconnecting', () => {
      logger.info('Redis reconnecting...');
    });

    // Connect immediately
    this.client.connect().catch((error) => {
      logger.error('Failed to connect to Redis:', error);
    });
  }

  get(key: string): string | undefined {
    if (!this.ready) {
      logger.warn('Redis not ready, returning undefined');
      return undefined;
    }

    try {
      // Synchronous get not available in ioredis, this method should be async
      // For compatibility with interface, we'll return undefined and log warning
      logger.warn('RedisCache.get() is synchronous but Redis is async. Use getWithTTL() instead.');
      return undefined;
    } catch (error) {
      logger.error(`Redis GET error for ${key}:`, (error as Error).message);
      this.stats.misses++;
      return undefined;
    }
  }

  getWithTTL(_key: string): CacheEntry | undefined {
    if (!this.ready) {
      logger.warn('Redis not ready, returning undefined');
      return undefined;
    }

    // Redis operations are async, but interface requires sync
    // We'll use a workaround with deasync or return cached promise result
    // For now, return undefined and recommend using getWithTTLAsync
    logger.warn('RedisCache.getWithTTL() requires async. Use async methods instead.');
    return undefined;
  }

  /**
   * Async version of getWithTTL (recommended for Redis)
   */
  async getWithTTLAsync(key: string): Promise<CacheEntry | undefined> {
    if (!this.ready) {
      logger.warn('Redis not ready');
      return undefined;
    }

    try {
      // Get value and TTL in parallel
      const [value, ttl] = await Promise.all([this.client.get(key), this.client.ttl(key)]);

      if (!value) {
        logger.debug(`Cache MISS: ${key}`);
        this.stats.misses++;
        return undefined;
      }

      this.stats.hits++;

      // TTL in Redis: -1 (no expiry), -2 (key doesn't exist), >0 (remaining seconds)
      const remainingTTL = ttl > 0 ? ttl : 0;
      const isStale = ttl <= 0;

      if (isStale) {
        logger.debug(`Cache STALE: ${key} (expired)`);
      } else {
        logger.debug(`Cache HIT: ${key} (TTL: ${remainingTTL}s)`);
      }

      return {
        value: value as string,
        ttl: remainingTTL * 1000, // Convert to ms
        isStale,
      };
    } catch (error) {
      logger.error(`Redis GET error for ${key}:`, (error as Error).message);
      this.stats.misses++;
      return undefined;
    }
  }

  /**
   * Async version of get (recommended for Redis)
   */
  async getAsync(key: string): Promise<string | undefined> {
    if (!this.ready) {
      logger.warn('Redis not ready');
      return undefined;
    }

    try {
      const value = await this.client.get(key);
      if (value) {
        logger.debug(`Cache HIT: ${key}`);
        this.stats.hits++;
      } else {
        logger.debug(`Cache MISS: ${key}`);
        this.stats.misses++;
      }
      return (value as string | null) ?? undefined;
    } catch (error) {
      logger.error(`Redis GET error for ${key}:`, (error as Error).message);
      this.stats.misses++;
      return undefined;
    }
  }

  set(key: string, value: string): boolean {
    if (!this.ready) {
      logger.warn('Redis not ready');
      return false;
    }

    if (!key || typeof key !== 'string') {
      logger.error('Invalid cache key:', key);
      return false;
    }

    if (typeof value !== 'string') {
      logger.error('Invalid cache value type for key:', key);
      return false;
    }

    if (value.length === 0) {
      logger.warn(`Skipping cache for empty response: ${key}`);
      return false;
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (value.length > maxSize) {
      logger.warn(
        `Response too large to cache (${(value.length / 1024 / 1024).toFixed(2)} MB): ${key}`
      );
      return false;
    }

    // Fire and forget (async operation, return true immediately)
    this.setAsync(key, value);
    return true;
  }

  /**
   * Async version of set (recommended for Redis)
   */
  async setAsync(key: string, value: string, ttl?: number): Promise<boolean> {
    if (!this.ready) {
      logger.warn('Redis not ready');
      return false;
    }

    try {
      const cacheTtl = ttl || 3600; // Default 1 hour
      // Set with TTL (EX = seconds)
      await this.client.setEx(key, cacheTtl, value);
      logger.debug(`Cache SET: ${key} (${(value.length / 1024).toFixed(2)} KB, TTL: ${cacheTtl}s)`);
      return true;
    } catch (error) {
      logger.error(`Redis SET error for ${key}:`, (error as Error).message);
      return false;
    }
  }

  delete(key: string): number {
    if (!this.ready) {
      return 0;
    }

    // Fire and forget
    this.deleteAsync(key);
    return 1;
  }

  /**
   * Async version of delete (recommended for Redis)
   */
  async deleteAsync(key: string): Promise<number> {
    if (!this.ready) {
      return 0;
    }

    try {
      const result = await this.client.del(key);
      if (result > 0) {
        logger.debug(`Cache deleted: ${key}`);
      }
      return result;
    } catch (error) {
      logger.error(`Redis DEL error for ${key}:`, (error as Error).message);
      return 0;
    }
  }

  flush(): void {
    if (!this.ready) {
      return;
    }

    // Fire and forget
    this.flushAsync();
  }

  /**
   * Async version of flush (recommended for Redis)
   */
  async flushAsync(): Promise<void> {
    if (!this.ready) {
      return;
    }

    try {
      await this.client.flushDb();
      logger.info('Cache flushed');
    } catch (error) {
      logger.error('Redis FLUSH error:', (error as Error).message);
    }
  }

  getStats(): CacheStats {
    // Redis doesn't track these stats natively, we approximate
    return {
      keys: 0, // Would need DBSIZE call (async)
      hits: this.stats.hits,
      misses: this.stats.misses,
      ksize: 0,
      vsize: 0,
    };
  }

  /**
   * Async version of getStats (recommended for Redis)
   */
  async getStatsAsync(): Promise<CacheStats> {
    if (!this.ready) {
      return {
        keys: 0,
        hits: this.stats.hits,
        misses: this.stats.misses,
        ksize: 0,
        vsize: 0,
      };
    }

    try {
      const dbSize = await this.client.dbSize();
      const info = await this.client.info('stats');

      // Parse Redis INFO stats
      const hitsMatch = info.match(/keyspace_hits:(\d+)/);
      const missesMatch = info.match(/keyspace_misses:(\d+)/);

      return {
        keys: dbSize,
        hits: hitsMatch && hitsMatch[1] ? parseInt(hitsMatch[1], 10) : this.stats.hits,
        misses: missesMatch && missesMatch[1] ? parseInt(missesMatch[1], 10) : this.stats.misses,
        ksize: dbSize,
        vsize: 0, // Not available in Redis
      };
    } catch (error) {
      logger.error('Redis STATS error:', (error as Error).message);
      return {
        keys: 0,
        hits: this.stats.hits,
        misses: this.stats.misses,
        ksize: 0,
        vsize: 0,
      };
    }
  }

  keys(): string[] {
    // Redis keys() is async, so we return empty array for sync interface
    // Use keysAsync() for actual implementation
    logger.warn('RedisCache.keys() is synchronous but Redis is async. Returning empty array.');
    return [];
  }

  /**
   * Async version of keys (recommended for Redis)
   */
  async keysAsync(): Promise<string[]> {
    if (!this.ready) {
      return [];
    }

    try {
      return await this.client.keys('*');
    } catch (error) {
      logger.error('Redis KEYS error:', (error as Error).message);
      return [];
    }
  }

  getAllEntries(): Array<{ url: string; size: number; ttl: number }> {
    // Redis is async, so we return empty array for sync interface
    // Use getAllEntriesAsync() for actual implementation
    logger.warn(
      'RedisCache.getAllEntries() is synchronous but Redis is async. Returning empty array.'
    );
    return [];
  }

  /**
   * Async version of getAllEntries (recommended for Redis)
   */
  async getAllEntriesAsync(): Promise<Array<{ url: string; size: number; ttl: number }>> {
    if (!this.ready) {
      return [];
    }

    try {
      const keys = await this.client.keys('*');
      const entries = await Promise.all(
        keys.map(async (key) => {
          const [value, ttl] = await Promise.all([this.client.get(key), this.client.ttl(key)]);

          return {
            url: key,
            size: value ? (value as string).length : 0,
            ttl: ttl > 0 ? ttl : 0,
          };
        })
      );

      return entries;
    } catch (error) {
      logger.error('Redis GET ALL ENTRIES error:', (error as Error).message);
      return [];
    }
  }

  isReady(): boolean {
    return this.ready;
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.ready = false;
      logger.info('Redis cache closed');
    }
  }
}
