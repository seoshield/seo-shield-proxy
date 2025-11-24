import dotenv from 'dotenv';
import { CriticalSelector } from './admin/content-health-check';

// Load environment variables from .env file
dotenv.config();

/**
 * Application configuration interface
 */
export interface Config {
  PORT: number;
  TARGET_URL: string;
  CACHE_TTL: number;
  CACHE_TYPE: 'memory' | 'redis';
  REDIS_URL: string;
  PUPPETEER_TIMEOUT: number;
  MAX_CONCURRENT_RENDERS: number;
  NODE_ENV: string;
  NO_CACHE_PATTERNS: string;
  CACHE_PATTERNS: string;
  CACHE_BY_DEFAULT: boolean;
  CACHE_META_TAG: string;
  ADMIN_PASSWORD: string;
  USER_AGENT: string;
}

/**
 * SEO Protocol configuration
 */
export interface SeoProtocolConfig {
  // Content Health Check protocol
  contentHealthCheck: {
    enabled: boolean;
    criticalSelectors: CriticalSelector[];
    minBodyLength: number;
    minTitleLength: number;
    metaDescriptionRequired: boolean;
    h1Required: boolean;
    failOnMissingCritical: boolean;
  };

  // Virtual Scroll & Lazy Load protocol
  virtualScroll: {
    enabled: boolean;
    scrollSteps: number;
    scrollInterval: number;
    maxScrollHeight: number;
    waitAfterScroll: number;
    scrollSelectors: string[];
    infiniteScrollSelectors: string[];
    lazyImageSelectors: string[];
    triggerIntersectionObserver: boolean;
    maxScrollTime: number;
    scrollSettleTime: number;
  };

  // ETag and 304 strategy
  etagStrategy: {
    enabled: boolean;
    hashAlgorithm: 'md5' | 'sha256';
    enable304Responses: boolean;
    checkContentChanges: boolean;
    ignoredElements: string[];
    significantChanges: boolean;
  };

  // Cluster Mode configuration
  clusterMode: {
    enabled: boolean;
    useRedisQueue: boolean;
    maxWorkers: number;
    jobTimeout: number;
    retryAttempts: number;
    retryDelay: number;
    browser: {
      headless: boolean;
      args: string[];
    };
  };

  // Shadow DOM penetration
  shadowDom: {
    enabled: boolean;
    deepSerialization: boolean;
    includeShadowContent: boolean;
    flattenShadowTrees: boolean;
    customElements: string[];
    preserveShadowBoundaries: boolean;
    extractCSSVariables: boolean;
    extractComputedStyles: boolean;
  };

  // Circuit Breaker configuration
  circuitBreaker: {
    enabled: boolean;
    errorThreshold: number;
    resetTimeout: number;
    monitoringPeriod: number;
    fallbackToStale: boolean;
    halfOpenMaxCalls: number;
    failureThreshold: number;
    successThreshold: number;
    timeoutThreshold: number;
  };
}

/**
 * Snapshot result interface
 */
export interface SnapshotResult {
  id: string;
  url: string;
  timestamp: Date;
  screenshot: string;
  html: string;
  title: string;
  description: string;
  size: number;
  ttl: number;
  performance: {
    renderTime: number;
    resourceCount: number;
    errorCount: number;
  };
}

/**
 * Diff result interface
 */
export interface DiffResult {
  id: string;
  beforeId: string;
  afterId: string;
  timestamp: Date;
  diffScore: number;
  diffImage: string;
  beforeSnapshot: SnapshotResult;
  afterSnapshot: SnapshotResult;
  seoComparison: {
    titleChanged: boolean;
    metaChanged: boolean;
    h1Changed: boolean;
    contentChanged: boolean;
  };
  impact: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
}

/**
 * Render error interface
 */
export interface RenderError {
  id: string;
  timestamp: Date;
  error: string;
  url: string;
  context: {
    userAgent: string;
    referer: string;
    ip: string;
  };
  stack?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolved: boolean;
  category: 'timeout' | 'network' | 'javascript' | 'resource' | 'other';
}

/**
 * Error pattern interface
 */
export interface ErrorPattern {
  id: string;
  name: string;
  pattern: string;
  type: 'error' | 'console' | 'network';
  frequency: number;
  lastSeen: Date;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  autoResolve: boolean;
}

/**
 * Render job interface
 */
export interface RenderJob {
  url: string;
  options: {
    userAgent?: string;
    viewport?: { width: number; height: number };
    timeout?: number;
    waitUntil?: string;
  };
  priority: 'low' | 'medium' | 'high';
  timestamp: Date;
  id: string;
}

/**
 * Render job result interface
 */
export interface RenderJobResult {
  success: boolean;
  screenshot?: string;
  html?: string;
  error?: string;
  performance: {
    renderTime: number;
    resourceCount: number;
    errorCount: number;
  };
  metadata: {
    title: string;
    description: string;
    size: number;
  };
}

/**
 * Snapshot options interface
 */
export interface SnapshotOptions {
  fullPage?: boolean;
  quality?: number;
  format?: 'png' | 'jpeg' | 'webp';
  clip?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  omitBackground?: boolean;
}

/**
 * Runtime configuration interface for admin features
 */
export interface RuntimeConfig {
  // SEO Protocol configuration
  seoProtocols?: SeoProtocolConfig;

  // Cache warmer configuration
  sitemapUrl?: string;
  warmupSchedule?: string;
  maxConcurrentWarmups?: number;

  // Snapshot service configuration
  snapshotStorage?: string;
  diffThreshold?: number;

  // Hotfix engine configuration
  hotfixRules?: Array<{
    id: string;
    name: string;
    urlPattern: string;
    isActive: boolean;
    injectionType: 'meta' | 'script' | 'style' | 'custom';
    content: string;
    position: 'head' | 'body_start' | 'body_end';
    priority: number;
    createdAt: Date;
    updatedAt: Date;
    expiresAt?: Date;
    description?: string;
    userAgents?: string[];
    headers?: Record<string, string>;
    actions?: Array<{
      type: 'replace' | 'prepend' | 'append' | 'remove' | 'attribute';
      selector: string;
      value?: string;
      attribute?: string;
    }>;
  }>;

  // Blocking manager configuration
  blockingRules?: Array<{
    id: string;
    name: string;
    pattern: string;
    isActive: boolean;
    blockType: 'domain' | 'url' | 'userAgent' | 'ip' | 'header';
    reason: string;
    createdAt: Date;
    hitCount: number;
  }>;

  // User agent for SSR
  userAgent?: string;

  // Admin authentication
  adminAuth?: {
    enabled: boolean;
    username: string;
    password: string;
  };

  // General admin settings
  [key: string]: any;
}

/**
 * Application configuration
 * All values are loaded from environment variables with sensible defaults
 */
const config: Config = {
  // Server port - default to 8080
  PORT: parseInt(process.env['PORT'] || '8080', 10) || 8080,

  // Target URL for the SPA (required)
  TARGET_URL: process.env['TARGET_URL'] || '',

  // Cache TTL in seconds - default to 1 hour
  CACHE_TTL: parseInt(process.env['CACHE_TTL'] || '3600', 10) || 3600,

  // Cache type - memory or redis (temporarily forced to memory)
  CACHE_TYPE: 'memory' as 'memory' | 'redis', // (process.env['CACHE_TYPE'] === 'redis' ? 'redis' : 'memory') as 'memory' | 'redis',

  // Redis connection URL
  REDIS_URL: process.env['REDIS_URL'] || 'redis://localhost:6379',

  // Puppeteer timeout in milliseconds - default to 30 seconds
  PUPPETEER_TIMEOUT: parseInt(process.env['PUPPETEER_TIMEOUT'] || '30000', 10) || 30000,

  // Maximum concurrent renders - default to 5
  MAX_CONCURRENT_RENDERS: parseInt(process.env['MAX_CONCURRENT_RENDERS'] || '5', 10) || 5,

  // Node environment
  NODE_ENV: process.env['NODE_ENV'] || 'production',

  // URLs that should NEVER be cached or rendered
  NO_CACHE_PATTERNS: process.env['NO_CACHE_PATTERNS'] || '',

  // URLs that SHOULD be cached
  CACHE_PATTERNS: process.env['CACHE_PATTERNS'] || '',

  // Default caching behavior
  CACHE_BY_DEFAULT: process.env['CACHE_BY_DEFAULT'] !== 'false',

  // Meta tag name for cache control
  CACHE_META_TAG: process.env['CACHE_META_TAG'] || 'x-seo-shield-cache',

  // Admin panel password
  ADMIN_PASSWORD: process.env['ADMIN_PASSWORD'] || 'admin123',

  // User agent for SSR
  USER_AGENT: process.env['USER_AGENT'] || 'Mozilla/5.0 (compatible; SEOShieldProxy/1.0; +https://github.com/seoshield/seo-shield-proxy)',
};

// Validate required configuration
if (!config.TARGET_URL) {
  console.error('❌ ERROR: TARGET_URL environment variable is required');
  if (process.env.NODE_ENV !== 'test') {
    process.exit(1);
  }
}

// Validate TARGET_URL format
try {
  new URL(config.TARGET_URL);
} catch (error) {
  console.error('❌ ERROR: TARGET_URL must be a valid URL (e.g., https://example.com)');
  if (process.env.NODE_ENV !== 'test') {
    process.exit(1);
  }
}

// Log configuration
console.log('⚙️  Configuration loaded:');
console.log(`   PORT: ${config.PORT}`);
console.log(`   TARGET_URL: ${config.TARGET_URL}`);
console.log(`   CACHE_TYPE: ${config.CACHE_TYPE}`);
if (config.CACHE_TYPE === 'redis') {
  console.log(`   REDIS_URL: ${config.REDIS_URL}`);
}
console.log(`   CACHE_TTL: ${config.CACHE_TTL}s`);
console.log(`   PUPPETEER_TIMEOUT: ${config.PUPPETEER_TIMEOUT}ms`);
console.log(`   MAX_CONCURRENT_RENDERS: ${config.MAX_CONCURRENT_RENDERS}`);
console.log(`   NODE_ENV: ${config.NODE_ENV}`);
console.log(`   CACHE_BY_DEFAULT: ${config.CACHE_BY_DEFAULT}`);
if (config.NO_CACHE_PATTERNS) {
  console.log(`   NO_CACHE_PATTERNS: ${config.NO_CACHE_PATTERNS}`);
}
if (config.CACHE_PATTERNS) {
  console.log(`   CACHE_PATTERNS: ${config.CACHE_PATTERNS}`);
}

export default config;
