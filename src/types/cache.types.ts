/**
 * Cache Types
 * Types for cache management, strategies, and rules.
 */

/**
 * Cache type - memory or redis
 */
export type CacheType = 'memory' | 'redis';

/**
 * Cache entry metadata
 */
export interface CacheEntryMetadata {
  createdAt: number;
  expiresAt: number;
  hitCount: number;
  lastAccessedAt: number;
  size: number;
  contentHash?: string;
  etag?: string;
  statusCode?: number;
  contentType?: string;
}

/**
 * Cache entry with value and metadata
 */
export interface CacheEntry<T = string> {
  key: string;
  value: T;
  metadata: CacheEntryMetadata;
}

/**
 * Cache configuration options
 */
export interface CacheConfig {
  type: CacheType;
  maxSize?: number;
  maxItems?: number;
  defaultTTL?: number;
  checkPeriod?: number;
  evictionPolicy?: 'lru' | 'lfu' | 'ttl';
}

/**
 * Redis-specific cache configuration
 */
export interface RedisCacheConfig extends CacheConfig {
  type: 'redis';
  url: string;
  password?: string;
  db?: number;
  keyPrefix?: string;
  connectTimeout?: number;
  maxRetriesPerRequest?: number;
}

/**
 * Cache decision from rules engine
 */
export interface CacheDecision {
  shouldCache: boolean;
  ttl: number;
  reason: string;
  rule?: string;
}

/**
 * Cache rules summary
 */
export interface CacheRulesSummary {
  totalRules: number;
  activeRules: number;
  bypassRules: number;
  customTTLRules: number;
}

/**
 * Cache rule definition
 */
export interface CacheRule {
  id: string;
  name: string;
  pattern: string;
  type: 'url' | 'path' | 'query' | 'header';
  action: 'cache' | 'bypass' | 'revalidate';
  ttl?: number;
  priority: number;
  enabled: boolean;
  conditions?: CacheRuleCondition[];
}

/**
 * Cache rule condition
 */
export interface CacheRuleCondition {
  field: string;
  operator: 'equals' | 'contains' | 'matches' | 'starts_with' | 'ends_with';
  value: string;
  negate?: boolean;
}

/**
 * Cache operation result
 */
export interface CacheOperationResult {
  success: boolean;
  key: string;
  operation: 'get' | 'set' | 'delete' | 'clear';
  duration: number;
  error?: string;
}

/**
 * Cache statistics
 */
export interface CacheStatistics {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  maxSize: number;
  itemCount: number;
  evictions: number;
  avgGetTime: number;
  avgSetTime: number;
  memoryUsage?: number;
}

/**
 * Cache warming job
 */
export interface CacheWarmingJob {
  id: string;
  urls: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  processed: number;
  total: number;
  errors: Array<{ url: string; error: string }>;
  startedAt?: Date;
  completedAt?: Date;
}

/**
 * Cache invalidation request
 */
export interface CacheInvalidationRequest {
  pattern?: string;
  keys?: string[];
  tags?: string[];
  all?: boolean;
}

/**
 * Cache invalidation result
 */
export interface CacheInvalidationResult {
  invalidated: number;
  failed: number;
  duration: number;
  errors?: string[];
}

/**
 * Stale-while-revalidate options
 */
export interface SWROptions {
  maxAge: number;
  staleWhileRevalidate: number;
  staleIfError?: number;
}

/**
 * Cache headers for HTTP responses
 */
export interface CacheHeaders {
  'Cache-Control'?: string;
  'ETag'?: string;
  'Last-Modified'?: string;
  'Expires'?: string;
  'Vary'?: string;
  'Age'?: string;
}
