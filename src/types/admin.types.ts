/**
 * Admin API Types
 * Types for admin dashboard API endpoints and data structures.
 */

import type { BaseEntity, HealthStatus, CacheStats, RenderStats } from './shared.types';
import type { BotStats } from './bot-detection.types';

/**
 * Dashboard overview data
 */
export interface DashboardOverview {
  cache: CacheStats;
  renders: RenderStats;
  bots: BotStats;
  health: SystemHealth;
  recentActivity: RecentActivity[];
}

/**
 * System health status
 */
export interface SystemHealth {
  overall: HealthStatus;
  components: {
    proxy: ComponentHealth;
    cache: ComponentHealth;
    database: ComponentHealth;
    browser: ComponentHealth;
    websocket: ComponentHealth;
  };
  uptime: number;
  version: string;
}

/**
 * Individual component health
 */
export interface ComponentHealth {
  status: HealthStatus;
  message?: string;
  lastCheck: Date;
  metrics?: Record<string, number>;
}

/**
 * Recent activity item
 */
export interface RecentActivity {
  id: string;
  type: 'render' | 'cache' | 'bot' | 'error' | 'config';
  message: string;
  timestamp: Date;
  data?: Record<string, unknown>;
}

/**
 * Cache warmer configuration
 */
export interface CacheWarmerConfig {
  enabled: boolean;
  sitemapUrls: string[];
  maxConcurrent: number;
  intervalMinutes: number;
  priorities: Record<string, number>;
  excludePatterns: string[];
}

/**
 * Cache warmer status
 */
export interface CacheWarmerStatus {
  isRunning: boolean;
  lastRun?: Date;
  nextRun?: Date;
  urlsProcessed: number;
  urlsTotal: number;
  errors: Array<{ url: string; error: string }>;
  progress: number;
}

/**
 * Hotfix configuration
 */
export interface HotfixConfig extends BaseEntity {
  name: string;
  description?: string;
  enabled: boolean;
  urlPattern: string;
  type: 'inject' | 'replace' | 'remove' | 'modify';
  selector?: string;
  content?: string;
  priority: number;
  expiresAt?: Date;
}

/**
 * Blocking rule for admin
 */
export interface BlockingRule extends BaseEntity {
  name: string;
  description?: string;
  enabled: boolean;
  type: 'domain' | 'url' | 'pattern' | 'resource';
  pattern: string;
  action: 'block' | 'redirect' | 'modify';
  options?: {
    redirectUrl?: string;
    modifyHeaders?: Record<string, string>;
    responseCode?: number;
    responseText?: string;
  };
  priority: number;
  stats: {
    blockedCount: number;
    lastBlocked?: Date;
    totalRequests: number;
  };
  expiresAt?: Date;
}

/**
 * Snapshot comparison result
 */
export interface SnapshotComparison {
  id: string;
  url: string;
  timestamp: Date;
  before: SnapshotData;
  after: SnapshotData;
  differences: SnapshotDifference[];
  seoImpact: {
    high: string[];
    medium: string[];
    low: string[];
  };
}

/**
 * Snapshot data
 */
export interface SnapshotData {
  screenshot: string;
  html: string;
  title: string;
  metaDescription?: string;
  h1?: string;
  canonical?: string;
  statusCode: number;
  loadTime: number;
}

/**
 * Snapshot difference
 */
export interface SnapshotDifference {
  type: 'added' | 'removed' | 'changed';
  path: string;
  before?: string;
  after?: string;
  severity: 'low' | 'medium' | 'high';
}

/**
 * Forensics error report
 */
export interface ForensicsReport extends BaseEntity {
  url: string;
  error: {
    message: string;
    type: 'timeout' | 'crash' | 'javascript' | 'network' | 'unknown';
    stack?: string;
  };
  context: {
    userAgent: string;
    viewport: { width: number; height: number };
    headers: Record<string, string>;
    timeout: number;
  };
  console: Array<{
    level: string;
    text: string;
    timestamp: number;
  }>;
  network: Array<{
    url: string;
    method: string;
    status: number;
    time: number;
  }>;
  screenshot?: string;
  renderTime: number;
}

/**
 * User agent simulation request
 */
export interface UASimulationRequest {
  url: string;
  userAgent: string;
  viewport?: { width: number; height: number };
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
  timeout?: number;
}

/**
 * User agent simulation result
 */
export interface UASimulationResult {
  id: string;
  url: string;
  userAgent: string;
  timestamp: Date;
  screenshot: string;
  html: string;
  statusCode: number;
  renderTime: number;
  seoMetrics: {
    title: string;
    description: string;
    h1Count: number;
    wordCount: number;
    imageCount: number;
  };
}

/**
 * SEO protocols configuration
 */
export interface SEOProtocolsConfig {
  contentHealthCheck: {
    enabled: boolean;
    criticalSelectors: string[];
    minTitleLength: number;
    maxTitleLength: number;
    minDescriptionLength: number;
    maxDescriptionLength: number;
  };
  virtualScroll: {
    enabled: boolean;
    scrollDelay: number;
    maxScrolls: number;
  };
  etagStrategy: {
    enabled: boolean;
    algorithm: 'md5' | 'sha1' | 'sha256';
    cacheMaxAge: number;
  };
  clusterMode: {
    enabled: boolean;
    maxWorkers: number;
    useRedisQueue: boolean;
  };
  shadowDom: {
    enabled: boolean;
    extractContent: boolean;
  };
  circuitBreaker: {
    enabled: boolean;
    errorThreshold: number;
    resetTimeout: number;
  };
}

/**
 * SEO protocols status
 */
export interface SEOProtocolsStatus {
  enabled: boolean;
  protocols: Record<string, { enabled: boolean; status: string }>;
  overall: HealthStatus;
}

/**
 * Admin audit log entry
 */
export interface AuditLogEntry extends BaseEntity {
  action: string;
  user: string;
  ip: string;
  resource: string;
  details?: Record<string, unknown>;
  result: 'success' | 'failure';
  errorMessage?: string;
}
