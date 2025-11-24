/**
 * Simple in-memory cache with TTL support
 * Replaces NodeCache for simpler TTL management
 */

interface CacheEntry {
  value: string;
  expires: number;
}

export class SimpleCache {
  private cache = new Map<string, CacheEntry>();
  private defaultTTL: number;

  constructor(ttl: number = 3600000) { // 1 hour default
    this.defaultTTL = ttl;
  }

  set(key: string, value: string, ttl?: number): boolean {
    if (!key || typeof key !== 'string') {
      return false;
    }

    if (typeof value !== 'string') {
      return false;
    }

    if (value.length === 0) {
      return false;
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (value.length > maxSize) {
      return false;
    }

    const expires = Date.now() + (ttl || this.defaultTTL);
    this.cache.set(key, { value, expires });

    // Enforce max keys limit
    const maxKeys = 1000;
    if (this.cache.size > maxKeys) {
      const keysToDelete = Array.from(this.cache.keys()).slice(0, this.cache.size - maxKeys);
      for (const deleteKey of keysToDelete) {
        this.cache.delete(deleteKey);
      }
    }

    return true;
  }

  get(key: string): string | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      console.log(`❌ Cache MISS: ${key}`);
      return undefined;
    }

    // Check if expired
    if (Date.now() > entry.expires) {
      console.log(`⏰ Cache EXPIRED: ${key}`);
      this.cache.delete(key);
      return undefined;
    }

    console.log(`✅ Cache HIT: ${key}`);
    return entry.value;
  }

  delete(key: string): number {
    const existed = this.cache.has(key);
    this.cache.delete(key);
    return existed ? 1 : 0;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check if expired
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  flush(): void {
    this.cache.clear();
  }

  getAll(): Record<string, string> {
    const result: Record<string, string> = {};
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (now <= entry.expires) {
        result[key] = entry.value;
      } else {
        this.cache.delete(key);
      }
    }

    return result;
  }

  getKeysByPattern(pattern: string): string[] {
    const regex = new RegExp(pattern);
    const now = Date.now();

    return Array.from(this.cache.keys()).filter(key => {
      const entry = this.cache.get(key);
      return entry && now <= entry.expires && regex.test(key);
    });
  }

  deleteByPattern(pattern: string): number {
    const regex = new RegExp(pattern);
    const now = Date.now();
    let deleted = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        deleted++;
      } else if (now > entry.expires) {
        this.cache.delete(key);
      }
    }

    return deleted;
  }

  getStats(): {
    keys: number;
    hits: number;
    misses: number;
    size: number;
    ksize: number;
    vsize: number;
  } {
    const now = Date.now();
    let validEntries = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry && now <= entry.expires) {
        validEntries++;
      } else {
        this.cache.delete(key);
      }
    }

    return {
      keys: validEntries,
      hits: 0, // Not tracked in simple implementation
      misses: 0,
      size: validEntries * 100, // Approximate
      ksize: validEntries * 50, // Approximate key size
      vsize: validEntries * 100, // Approximate value size
    };
  }
}