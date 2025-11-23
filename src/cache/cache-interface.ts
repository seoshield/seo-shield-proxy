/**
 * Cache statistics interface
 */
export interface CacheStats {
  keys: number;
  hits: number;
  misses: number;
  ksize: number;
  vsize: number;
}

/**
 * Cache entry with TTL information
 */
export interface CacheEntry {
  value: string;
  ttl: number;
  isStale: boolean;
}

/**
 * Abstract cache adapter interface
 * Implementations: MemoryCache (node-cache), RedisCache (redis)
 */
export interface ICacheAdapter {
  /**
   * Get cache entry value
   */
  get(key: string): string | undefined;

  /**
   * Get cache entry with TTL information (for SWR strategy)
   */
  getWithTTL(key: string): CacheEntry | undefined;

  /**
   * Set cache entry
   */
  set(key: string, value: string): boolean;

  /**
   * Delete cache entry
   */
  delete(key: string): number;

  /**
   * Flush all cache entries
   */
  flush(): void;

  /**
   * Get cache statistics
   */
  getStats(): CacheStats;

  /**
   * Get all cache keys
   */
  keys(): string[];

  /**
   * Get all cache entries with metadata (for admin panel)
   */
  getAllEntries(): Array<{ url: string; size: number; ttl: number }>;

  /**
   * Check if cache is ready/connected
   */
  isReady(): boolean;

  /**
   * Close cache connection (for cleanup)
   */
  close(): Promise<void>;
}
