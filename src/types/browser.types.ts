/**
 * Browser Types
 * Types for Puppeteer browser management, SSR rendering, and queue handling.
 */

/**
 * SSR event data for real-time monitoring
 */
export interface SSREventData {
  url?: string;
  timestamp?: number;
  duration?: number;
  success?: boolean;
  htmlLength?: number;
  statusCode?: number;
  error?: string;
  queueSize?: number;
  processing?: number;
  renderId?: string;
  score?: number;
  passed?: boolean;
  issues?: Array<{ type: string; message: string }>;
}

/**
 * Health check issue from content validation
 */
export interface HealthCheckIssue {
  type: 'error' | 'warning';
  selector: string;
  message: string;
}

/**
 * Render result containing HTML and optional HTTP status code
 */
export interface RenderResult {
  html: string;
  statusCode?: number;
}

/**
 * Queue metrics for monitoring browser render queue
 */
export interface QueueMetrics {
  queued: number;
  processing: number;
  completed: number;
  errors: number;
  maxConcurrency: number;
}

/**
 * Browser launch options
 */
export interface BrowserLaunchOptions {
  headless?: boolean | 'new';
  args?: string[];
  executablePath?: string;
  timeout?: number;
  ignoreHTTPSErrors?: boolean;
  devtools?: boolean;
}

/**
 * Page navigation options
 */
export interface NavigationOptions {
  timeout?: number;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
}

/**
 * Screenshot options
 */
export interface ScreenshotOptions {
  fullPage?: boolean;
  type?: 'png' | 'jpeg' | 'webp';
  quality?: number;
  encoding?: 'binary' | 'base64';
  clip?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Viewport configuration
 */
export interface ViewportConfig {
  width: number;
  height: number;
  deviceScaleFactor?: number;
  isMobile?: boolean;
  hasTouch?: boolean;
  isLandscape?: boolean;
}

/**
 * Resource blocking configuration
 */
export interface ResourceBlockConfig {
  blockImages?: boolean;
  blockFonts?: boolean;
  blockStylesheets?: boolean;
  blockMedia?: boolean;
  blockScripts?: boolean;
  allowedDomains?: string[];
  blockedDomains?: string[];
}

/**
 * Request interception result
 */
export interface InterceptionResult {
  action: 'allow' | 'block' | 'modify';
  modifiedHeaders?: Record<string, string>;
  redirectUrl?: string;
}

/**
 * Page evaluation result with metrics
 */
export interface EvaluationResult<T = unknown> {
  result: T;
  executionTime: number;
  consoleMessages?: string[];
  errors?: string[];
}

/**
 * Render job for queue processing
 */
export interface RenderJob {
  id: string;
  url: string;
  priority?: number;
  timeout?: number;
  options?: {
    waitUntil?: NavigationOptions['waitUntil'];
    viewport?: ViewportConfig;
    userAgent?: string;
    extraHTTPHeaders?: Record<string, string>;
  };
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: RenderResult;
  error?: string;
}

/**
 * Cluster status for monitoring
 */
export interface ClusterStatus {
  isRunning: boolean;
  workersCount: number;
  activeWorkers: number;
  idleWorkers: number;
  queueLength: number;
  jobsCompleted: number;
  jobsFailed: number;
  avgJobTime: number;
  uptime: number;
}
