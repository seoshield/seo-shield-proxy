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
    });

    // Log cache statistics periodically
    this.cache.on('expired', (key) => {
      console.log(`🗑️  Cache expired: ${key}`);
    });

    console.log(`💾 Cache initialized with TTL: ${config.CACHE_TTL}s`);
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
    const success = this.cache.set(key, value);
    if (success) {
      console.log(`💾 Cache SET: ${key} (${(value.length / 1024).toFixed(2)} KB)`);
    }
    return success;
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
