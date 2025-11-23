import NodeCache from 'node-cache';
import config from './config.js';

/**
 * In-memory cache for rendered HTML
 * TTL is configured via CACHE_TTL environment variable
 */
class Cache {
  constructor() {
    this.cache = new NodeCache({
      stdTTL: config.CACHE_TTL,
      checkperiod: Math.floor(config.CACHE_TTL * 0.2), // Check for expired keys every 20% of TTL
      useClones: false, // Don't clone values for better performance
      deleteOnExpire: true, // Automatically delete expired keys
      maxKeys: 1000, // Limit number of keys to prevent memory issues
    });

    // Track cache events
    this.cache.on('expired', (key) => {
      console.log(`🗑️  Cache expired: ${key}`);
    });

    this.cache.on('del', (key) => {
      console.log(`🗑️  Cache deleted: ${key}`);
    });

    console.log(`💾 Cache initialized with TTL: ${config.CACHE_TTL}s, max keys: 1000`);
  }

  /**
   * Get a value from cache
   * @param {string} key - Cache key (usually the URL path)
   * @returns {string|undefined} - Cached HTML or undefined if not found
   */
  get(key) {
    const value = this.cache.get(key);
    if (value) {
      console.log(`✅ Cache HIT: ${key}`);
    } else {
      console.log(`❌ Cache MISS: ${key}`);
    }
    return value;
  }

  /**
   * Set a value in cache
   * @param {string} key - Cache key (usually the URL path)
   * @param {string} value - HTML content to cache
   * @returns {boolean} - Success status
   */
  set(key, value) {
    // Validate inputs
    if (!key || typeof key !== 'string') {
      console.error('⚠️  Invalid cache key:', key);
      return false;
    }

    if (!value || typeof value !== 'string') {
      console.error('⚠️  Invalid cache value for key:', key);
      return false;
    }

    // Don't cache empty or very small responses (likely errors)
    if (value.length < 100) {
      console.warn(`⚠️  Skipping cache for small response (${value.length} bytes): ${key}`);
      return false;
    }

    // Don't cache very large responses (potential DoS)
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
      console.error(`❌ Cache SET error for ${key}:`, error.message);
      return false;
    }
  }

  /**
   * Delete a value from cache
   * @param {string} key - Cache key to delete
   * @returns {number} - Number of deleted entries
   */
  delete(key) {
    return this.cache.del(key);
  }

  /**
   * Clear all cache
   */
  flush() {
    this.cache.flushAll();
    console.log('🗑️  Cache flushed');
  }

  /**
   * Get cache statistics
   * @returns {object} - Cache stats
   */
  getStats() {
    return this.cache.getStats();
  }
}

// Export singleton instance
const cacheInstance = new Cache();
export default cacheInstance;
