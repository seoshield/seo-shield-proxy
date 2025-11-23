import NodeCache from 'node-cache';
import config from '../config.js';
import { ICacheAdapter, CacheStats, CacheEntry } from './cache-interface.js';

/**
 * In-memory cache adapter using node-cache
 * Fast but volatile (data lost on restart)
 */
export class MemoryCache implements ICacheAdapter {
  private cache: NodeCache;
  private ready = false;

  constructor() {
    this.cache = new NodeCache({
      stdTTL: config.CACHE_TTL,
      checkperiod: Math.floor(config.CACHE_TTL * 0.2),
      useClones: false,
      deleteOnExpire: false, // Keep stale entries for SWR strategy
      maxKeys: 1000,
    });

    this.cache.on('expired', (key: string) => {
      console.log(`⏰ Cache expired (keeping for SWR): ${key}`);
    });

    this.cache.on('del', (key: string) => {
      console.log(`🗑️  Cache deleted: ${key}`);
    });

    this.ready = true;
    console.log(`💾 Memory cache initialized with TTL: ${config.CACHE_TTL}s, max keys: 1000, SWR enabled`);
  }

  get(key: string): string | undefined {
    const value = this.cache.get<string>(key);
    if (value) {
      console.log(`✅ Cache HIT: ${key}`);
    } else {
      console.log(`❌ Cache MISS: ${key}`);
    }
    return value;
  }

  getWithTTL(key: string): CacheEntry | undefined {
    const value = this.cache.get<string>(key);
    if (!value) {
      console.log(`❌ Cache MISS: ${key}`);
      return undefined;
    }

    const ttl = this.cache.getTtl(key);
    const now = Date.now();
    const remainingTTL = ttl ? Math.max(0, ttl - now) / 1000 : 0;
    const isStale = remainingTTL <= 0;

    if (isStale) {
      console.log(`⏰ Cache STALE: ${key} (expired ${Math.abs(remainingTTL).toFixed(0)}s ago)`);
    } else {
      console.log(`✅ Cache HIT: ${key} (TTL: ${remainingTTL.toFixed(0)}s)`);
    }

    return {
      value,
      ttl: remainingTTL,
      isStale,
    };
  }

  set(key: string, value: string): boolean {
    if (!key || typeof key !== 'string') {
      console.error('⚠️  Invalid cache key:', key);
      return false;
    }

    if (typeof value !== 'string') {
      console.error('⚠️  Invalid cache value type for key:', key);
      return false;
    }

    if (value.length === 0) {
      console.warn(`⚠️  Skipping cache for empty response: ${key}`);
      return false;
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (value.length > maxSize) {
      console.warn(`⚠️  Response too large to cache (${(value.length / 1024 / 1024).toFixed(2)} MB): ${key}`);
      return false;
    }

    try {
      const success = this.cache.set(key, value);
      if (success) {
        console.log(`💾 Cache SET: ${key} (${(value.length / 1024).toFixed(2)} KB)`);
      } else {
        console.warn(`⚠️  Cache SET failed (possibly max keys reached): ${key}`);
      }
      return success;
    } catch (error) {
      console.error(`❌ Cache SET error for ${key}:`, (error as Error).message);
      return false;
    }
  }

  delete(key: string): number {
    return this.cache.del(key);
  }

  flush(): void {
    this.cache.flushAll();
    console.log('🗑️  Cache flushed');
  }

  getStats(): CacheStats {
    return this.cache.getStats();
  }

  keys(): string[] {
    return this.cache.keys();
  }

  getAllEntries(): Array<{ url: string; size: number; ttl: number }> {
    const cacheKeys = this.cache.keys();
    return cacheKeys.map((key) => {
      const value = this.cache.get<string>(key);
      const ttl = this.cache.getTtl(key);

      return {
        url: key,
        size: value ? value.length : 0,
        ttl: ttl ? Math.floor((ttl - Date.now()) / 1000) : 0,
      };
    });
  }

  isReady(): boolean {
    return this.ready;
  }

  async close(): Promise<void> {
    this.cache.flushAll();
    this.cache.close();
    this.ready = false;
    console.log('🔒 Memory cache closed');
  }

  // Async versions for compatibility with Redis
  async getAsync(key: string): Promise<string | undefined> {
    return this.get(key);
  }

  async setAsync(key: string, value: string): Promise<boolean> {
    return this.set(key, value);
  }

  async deleteAsync(key: string): Promise<number> {
    return this.delete(key);
  }

  async flushAsync(): Promise<void> {
    this.flush();
  }

  async getWithTTLAsync(key: string): Promise<CacheEntry | undefined> {
    return this.getWithTTL(key);
  }

  async getStatsAsync(): Promise<CacheStats> {
    return this.getStats();
  }

  async keysAsync(): Promise<string[]> {
    return this.keys();
  }

  async getAllEntriesAsync(): Promise<Array<{ url: string; size: number; ttl: number }>> {
    return this.getAllEntries();
  }
}
