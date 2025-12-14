/**
 * Database Types
 * Types for MongoDB documents, queries, and database configuration.
 */

/**
 * MongoDB connection configuration
 */
export interface MongoConfig {
  url: string;
  dbName: string;
  options?: {
    maxPoolSize?: number;
    minPoolSize?: number;
    retryWrites?: boolean;
    retryReads?: boolean;
    connectTimeoutMS?: number;
    socketTimeoutMS?: number;
  };
}

/**
 * Generic query options for database operations
 */
export interface QueryOptions {
  page?: number;
  limit?: number;
  sort?: Record<string, 1 | -1>;
  filter?: Record<string, unknown>;
  projection?: Record<string, 0 | 1>;
}

/**
 * Query result with pagination
 */
export interface QueryResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Traffic log document
 */
export interface TrafficLogDocument {
  _id?: string;
  url: string;
  method: string;
  statusCode: number;
  isBot: boolean;
  botName?: string;
  botCategory?: string;
  responseTime: number;
  ip: string;
  userAgent: string;
  referer?: string;
  headers?: Record<string, string>;
  timestamp: Date;
  renderId?: string;
  cacheHit?: boolean;
}

/**
 * SSR render log document
 */
export interface RenderLogDocument {
  _id?: string;
  url: string;
  renderId: string;
  success: boolean;
  renderTime: number;
  htmlLength?: number;
  statusCode: number;
  error?: string;
  userAgent: string;
  timestamp: Date;
  healthCheck?: {
    score: number;
    passed: boolean;
    issues: Array<{ type: string; message: string }>;
  };
}

/**
 * Cache entry document
 */
export interface CacheEntryDocument {
  _id?: string;
  key: string;
  url: string;
  content: string;
  contentHash: string;
  renderTime: number;
  createdAt: Date;
  expiresAt: Date;
  hitCount: number;
  lastAccessedAt: Date;
  metadata?: {
    statusCode?: number;
    contentType?: string;
    etag?: string;
  };
}

/**
 * Bot rule document
 */
export interface BotRuleDocument {
  _id?: string;
  name: string;
  description?: string;
  pattern: string;
  type: 'user-agent' | 'ip' | 'behavior' | 'pattern';
  action: 'allow' | 'block' | 'render' | 'challenge';
  priority: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  stats?: {
    matchCount: number;
    lastMatched?: Date;
  };
}

/**
 * Analytics aggregation document
 */
export interface AnalyticsDocument {
  _id?: string;
  date: Date;
  period: 'hourly' | 'daily' | 'weekly' | 'monthly';
  metrics: {
    totalRequests: number;
    botRequests: number;
    humanRequests: number;
    ssrRenders: number;
    cacheHits: number;
    cacheMisses: number;
    avgResponseTime: number;
    errorCount: number;
  };
  breakdown?: {
    byBot: Record<string, number>;
    byPath: Record<string, number>;
    byStatusCode: Record<string, number>;
  };
}

/**
 * Config document for persistent settings
 */
export interface ConfigDocument {
  _id?: string;
  key: string;
  value: unknown;
  updatedAt: Date;
  updatedBy?: string;
  version: number;
}

/**
 * Session document
 */
export interface SessionDocument {
  _id?: string;
  sessionId: string;
  ip: string;
  userAgent: string;
  startTime: Date;
  lastActivity: Date;
  requestCount: number;
  isBot: boolean;
  botName?: string;
  pages: string[];
  data?: Record<string, unknown>;
}

/**
 * Database health status
 */
export interface DatabaseHealth {
  connected: boolean;
  latency: number;
  collections: string[];
  stats?: {
    collections: number;
    documents: number;
    storageSize: number;
    indexes: number;
  };
}
