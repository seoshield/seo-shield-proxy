/**
 * Server Types
 * Types for server configuration, traffic handling, and runtime.
 */

/**
 * Server environment
 */
export type Environment = 'development' | 'production' | 'test';

/**
 * Server configuration
 */
export interface ServerConfig {
  port: number;
  host: string;
  environment: Environment;
  targetUrl: string;
  proxyTimeout: number;
  trustProxy: boolean;
  corsOrigins: string[];
}

/**
 * Traffic event data for logging and monitoring
 */
export interface TrafficEventData {
  timestamp: number;
  method: string;
  path: string;
  fullUrl: string;
  ip: string;
  userAgent: string;
  isBot: boolean;
  botType?: string;
  botConfidence?: number;
  action: 'ssr' | 'proxy' | 'static' | 'bypass' | 'error';
  statusCode: number;
  responseTime: number;
  cacheHit?: boolean;
  renderId?: string;
  referer?: string;
}

/**
 * Cached content structure
 */
export interface CachedContent {
  html: string;
  timestamp: number;
  statusCode?: number;
  etag?: string;
  headers?: Record<string, string>;
}

/**
 * Health check response
 */
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  timestamp: string;
  components: {
    proxy: ComponentHealthCheck;
    cache: ComponentHealthCheck;
    database: ComponentHealthCheck;
    browser: ComponentHealthCheck;
  };
}

/**
 * Component health check
 */
export interface ComponentHealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  latency?: number;
  lastCheck?: string;
}

/**
 * Graceful shutdown options
 */
export interface ShutdownOptions {
  timeout: number;
  forceAfter?: number;
  signals?: string[];
  onShutdown?: () => Promise<void>;
}

/**
 * Request timing information
 */
export interface RequestTiming {
  start: number;
  botDetection?: number;
  cacheCheck?: number;
  render?: number;
  proxy?: number;
  total: number;
}

/**
 * Error response structure
 */
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
    stack?: string;
  };
  statusCode: number;
  timestamp: string;
  requestId?: string;
}

/**
 * Static asset configuration
 */
export interface StaticAssetConfig {
  paths: string[];
  extensions: string[];
  maxAge: number;
  etag: boolean;
  lastModified: boolean;
}

/**
 * Proxy target configuration
 */
export interface ProxyTargetConfig {
  url: string;
  changeOrigin: boolean;
  secure: boolean;
  ws: boolean;
  timeout: number;
  followRedirects: boolean;
  preserveHeaderKeyCase: boolean;
}

/**
 * SSR configuration
 */
export interface SSRConfig {
  enabled: boolean;
  timeout: number;
  maxConcurrent: number;
  cacheTTL: number;
  waitFor: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
  retryOnError: boolean;
  maxRetries: number;
  fallbackToProxy: boolean;
}

/**
 * Request logging options
 */
export interface RequestLoggingOptions {
  enabled: boolean;
  level: 'debug' | 'info' | 'warn' | 'error';
  includeHeaders: boolean;
  includeBody: boolean;
  maxBodyLength: number;
  excludePaths: string[];
  excludeMethods: string[];
}

/**
 * Server metrics
 */
export interface ServerMetrics {
  requestsTotal: number;
  requestsPerSecond: number;
  avgResponseTime: number;
  errorRate: number;
  activeConnections: number;
  bytesTransferred: number;
  uptime: number;
}

/**
 * Runtime feature flags
 */
export interface FeatureFlags {
  ssrEnabled: boolean;
  cacheEnabled: boolean;
  botDetectionEnabled: boolean;
  metricsEnabled: boolean;
  debugMode: boolean;
  maintenanceMode: boolean;
}
