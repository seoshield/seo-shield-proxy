import { SimpleCache } from '../cache/simple-cache';
import config from '../config';
import { ICacheAdapter, CacheStats, CacheEntry } from './cache-interface';
import { Logger } from '../utils/logger';

const logger = new Logger('MemoryCache');

/**
 * In-memory cache adapter using SimpleCache
 * Fast but volatile (data lost on restart)
 */
export class MemoryCache implements ICacheAdapter {
  private cache: SimpleCache;
  private ready = false;

  constructor() {
    this.cache = new SimpleCache(config.CACHE_TTL * 1000); // Convert to milliseconds
    this.ready = true;
    logger.info(
      `Initialized with SimpleCache TTL: ${config.CACHE_TTL}s, max keys: 1000, SWR enabled`
    );
  }

  get(key: string): string | undefined {
    return this.cache.get(key);
  }

  getWithTTL(key: string): CacheEntry | undefined {
    // SimpleCache doesn't expose TTL directly, so we need to implement this
    const value = this.cache.get(key);
    if (!value) {
      return undefined;
    }

    // For SimpleCache, we'll assume fresh entries since TTL is handled internally
    return {
      value,
      ttl: config.CACHE_TTL, // Return default TTL as approximation
      isStale: false,
    };
  }

  set(key: string, value: string): boolean {
    return this.cache.set(key, value);
  }

  delete(key: string): number {
    return this.cache.delete(key);
  }

  flush(): void {
    this.cache.flush();
    logger.info('Cache flushed');
  }

  getStats(): CacheStats {
    return this.cache.getStats();
  }

  keys(): string[] {
    return this.cache.getKeysByPattern('.*'); // Get all keys with regex pattern
  }

  getAllEntries(): Array<{ url: string; size: number; ttl: number }> {
    const allEntries = this.cache.getAll();
    return Object.entries(allEntries).map(([key, value]) => ({
      url: key,
      size: value.length,
      ttl: config.CACHE_TTL, // Approximate TTL since SimpleCache doesn't expose it
    }));
  }

  isReady(): boolean {
    return this.ready;
  }

  async close(): Promise<void> {
    this.cache.flush();
    this.ready = false;
    logger.info('Memory cache closed');
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
