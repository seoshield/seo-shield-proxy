/**
 * Shared Types - Frontend and Backend
 * These types are used by both the admin dashboard and the server.
 */

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}

/**
 * Paginated response for list endpoints
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Base entity with common fields
 */
export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Common status type
 */
export type Status = 'active' | 'inactive' | 'pending' | 'error';

/**
 * Health status type
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Bot information for dashboard display
 */
export interface BotInfo {
  name: string;
  category: 'search-engine' | 'social' | 'monitoring' | 'ai' | 'other';
  isAllowed: boolean;
  confidence?: number;
}

/**
 * Traffic event data for real-time monitoring
 */
export interface TrafficEvent {
  timestamp: number;
  method: string;
  path: string;
  ip: string;
  userAgent: string;
  isBot: boolean;
  action: 'ssr' | 'proxy' | 'static' | 'bypass' | 'error';
  botType?: string;
  botConfidence?: number;
  responseTime?: number;
  statusCode?: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  maxSize: number;
  itemCount: number;
}

/**
 * SSR render statistics
 */
export interface RenderStats {
  totalRenders: number;
  successfulRenders: number;
  failedRenders: number;
  activeRenders: number;
  avgRenderTime: number;
  successRate: number;
}

/**
 * System metrics for dashboard
 */
export interface SystemMetrics {
  uptime: number;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  cpuUsage?: number;
  requestsPerSecond: number;
  activeConnections: number;
}

/**
 * Configuration update request
 */
export interface ConfigUpdateRequest {
  key: string;
  value: unknown;
}

/**
 * WebSocket event types
 */
export type WebSocketEventType =
  | 'traffic'
  | 'ssr_event'
  | 'cache_update'
  | 'alert'
  | 'metrics';

/**
 * WebSocket message structure
 */
export interface WebSocketMessage<T = unknown> {
  type: WebSocketEventType;
  data: T;
  timestamp: number;
}
