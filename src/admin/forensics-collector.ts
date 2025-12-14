/**
 * Render Error Forensics Collector
 * Captures detailed information about failed renders for debugging
 */

import cache from '../cache';
import { Logger } from '../utils/logger';
import type { Page } from 'puppeteer';

// Type for render context passed to forensics collector
interface RenderContext {
  userAgent?: string;
  viewport?: { width: number; height: number };
  headers?: Record<string, string>;
  waitStrategy?: string;
  timeout?: number;
  startTime?: number;
}

interface ConsoleLog {
  timestamp: number;
  level: 'log' | 'warn' | 'error' | 'info' | 'debug';
  text: string;
  url?: string;
  line?: number;
  column?: number;
}

interface NetworkRequest {
  timestamp: number;
  url: string;
  method: string;
  status: number;
  statusText: string;
  resourceType: string;
  size: number;
  time: number;
  failure?: {
    errorText: string;
    errorType: string;
  };
}

interface RenderError {
  id: string;
  url: string;
  timestamp: Date;
  error: {
    message: string;
    type: 'timeout' | 'crash' | 'javascript' | 'network' | 'unknown';
    stack?: string;
  };
  context: {
    userAgent: string;
    viewport: {
      width: number;
      height: number;
    };
    proxyHeaders: Record<string, string>;
    waitStrategy: string;
    timeout: number;
  };
  console: ConsoleLog[];
  network: NetworkRequest[];
  screenshot?: string; // Base64 image of the error state
  html?: string; // Partial HTML captured before failure
  renderTime: number;
  memoryUsage?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
}

interface ErrorPattern {
  id: string;
  name: string;
  pattern: string; // Regex pattern to match errors
  type: 'url' | 'error' | 'console' | 'network';
  frequency: number;
  lastSeen: Date;
  description?: string;
}

interface ForensicsStats {
  totalErrors: number;
  todayErrors: number;
  errorsByType: Record<string, number>;
  topErrorUrls: Array<{ url: string; count: number }>;
  detectedPatterns: ErrorPattern[];
}

class ForensicsCollector {
  private logger = new Logger('ForensicsCollector');
  private errors: Map<string, RenderError> = new Map();
  private patterns: Map<string, ErrorPattern> = new Map();

  /**
   * Capture forensic data for a failed render
   */
  async captureForensics(
    url: string,
    error: Error,
    context: RenderContext,
    page?: Page
  ): Promise<RenderError> {
    const errorId = `forensics_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const forensicsError: RenderError = {
      id: errorId,
      url,
      timestamp: new Date(),
      error: this.categorizeError(error),
      context: {
        userAgent: context.userAgent || 'unknown',
        viewport: context.viewport || { width: 1200, height: 800 },
        proxyHeaders: context.headers || {},
        waitStrategy: context.waitStrategy || 'unknown',
        timeout: context.timeout || 30000,
      },
      console: [],
      network: [],
      renderTime: 0,
    };

    if (page) {
      try {
        // Capture console logs
        forensicsError.console = await this.captureConsoleLogs(page);

        // Capture network activity
        forensicsError.network = await this.captureNetworkActivity(page);

        // Capture screenshot of error state
        forensicsError.screenshot = await this.captureErrorScreenshot(page);

        // Capture partial HTML
        forensicsError.html = await page.content();

        // Get memory usage
        const metrics = await page.metrics();
        forensicsError.memoryUsage = {
          usedJSHeapSize: metrics.JSHeapUsedSize || 0,
          totalJSHeapSize: metrics.JSHeapTotalSize || 0,
          jsHeapSizeLimit: (metrics as Record<string, number>).JSHeapSizeLimit || 0,
        };
      } catch (captureError) {
        this.logger.warn('Failed to capture some forensic data:', captureError);
      }
    }

    // Calculate render time
    forensicsError.renderTime = Date.now() - (context.startTime || Date.now());

    // Store the error
    this.errors.set(errorId, forensicsError);

    // Cache the error data
    await this.cacheError(forensicsError);

    // Analyze for patterns
    await this.analyzePatterns(forensicsError);

    this.logger.info(`Captured forensic data for ${url}: ${forensicsError.error.type}`);
    return forensicsError;
  }

  /**
   * Categorize the error type
   */
  private categorizeError(error: Error): RenderError['error'] {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    if (message.includes('timeout') || name.includes('timeouterror')) {
      return {
        message: error.message,
        type: 'timeout',
        stack: error.stack,
      };
    }

    if (message.includes('javascript') || message.includes('script') || name.includes('error')) {
      return {
        message: error.message,
        type: 'javascript',
        stack: error.stack,
      };
    }

    if (
      message.includes('network') ||
      message.includes('connection') ||
      message.includes('fetch')
    ) {
      return {
        message: error.message,
        type: 'network',
        stack: error.stack,
      };
    }

    if (name.includes('crash') || message.includes('crashed')) {
      return {
        message: error.message,
        type: 'crash',
        stack: error.stack,
      };
    }

    return {
      message: error.message,
      type: 'unknown',
      stack: error.stack,
    };
  }

  /**
   * Capture console logs from the page
   */
  private async captureConsoleLogs(page: Page): Promise<ConsoleLog[]> {
    const logs: ConsoleLog[] = [];

    try {
      const pageLogs = await page.evaluate(() => {
        // Browser context - accessing injected console logs
        return (window as Window & { __seoShieldConsoleLogs?: Array<{ timestamp?: number; level?: string; text?: string; url?: string; line?: number; column?: number }> }).__seoShieldConsoleLogs || [];
      });

      for (const log of pageLogs) {
        logs.push({
          timestamp: log.timestamp || Date.now(),
          level: (log.level as ConsoleLog['level']) || 'log',
          text: log.text || '',
          url: log.url,
          line: log.line,
          column: log.column,
        });
      }
    } catch (error) {
      this.logger.warn('Failed to capture console logs:', error);
    }

    return logs;
  }

  /**
   * Capture network activity
   */
  private async captureNetworkActivity(page: Page): Promise<NetworkRequest[]> {
    const requests: NetworkRequest[] = [];

    try {
      // Get network logs from Puppeteer
      const performanceEntries = await page.evaluate(() => {
        return performance
          .getEntriesByType('navigation')
          .concat(performance.getEntriesByType('resource')) as Array<PerformanceResourceTiming>;
      });

      for (const entry of performanceEntries) {
        const request: NetworkRequest = {
          timestamp: entry.startTime || Date.now(),
          url: entry.name || '',
          method: 'GET', // Performance API doesn't provide method
          status: 200, // Default status
          statusText: 'OK',
          resourceType: entry.initiatorType || 'other',
          size: entry.transferSize || 0,
          time: entry.duration || 0,
        };

        requests.push(request);
      }

      // Try to get failed requests from Puppeteer
      try {
        interface FailedRequestEntry {
          timestamp?: number;
          url?: string;
          method?: string;
          status?: number;
          statusText?: string;
          resourceType?: string;
          time?: number;
          errorText?: string;
          errorType?: string;
        }
        const failedRequests = await page.evaluate(() => {
          // Browser context - accessing injected failed requests
          return (window as Window & { __seoShieldFailedRequests?: FailedRequestEntry[] }).__seoShieldFailedRequests || [];
        }) as FailedRequestEntry[];

        for (const failed of failedRequests) {
          requests.push({
            timestamp: failed.timestamp || Date.now(),
            url: failed.url || '',
            method: failed.method || 'GET',
            status: failed.status || 0,
            statusText: failed.statusText || 'Failed',
            resourceType: failed.resourceType || 'other',
            size: 0,
            time: failed.time || 0,
            failure: {
              errorText: failed.errorText || 'Unknown error',
              errorType: failed.errorType || 'NetworkError',
            },
          });
        }
      } catch (error) {
        this.logger.debug('Failed to capture failed requests:', error);
      }
    } catch (error) {
      this.logger.warn('Failed to capture network activity:', error);
    }

    return requests;
  }

  /**
   * Capture screenshot of error state
   */
  private async captureErrorScreenshot(page: Page): Promise<string> {
    try {
      const screenshot = await page.screenshot({
        fullPage: true,
        encoding: 'base64',
      });
      return `data:image/png;base64,${screenshot}`;
    } catch (error) {
      this.logger.warn('Failed to capture error screenshot:', error);
      return '';
    }
  }

  /**
   * Cache error data
   */
  private async cacheError(error: RenderError): Promise<void> {
    try {
      cache.set(`forensics:${error.id}`, JSON.stringify(error), 86400 * 7); // 7 days TTL
    } catch (cacheError) {
      this.logger.error('Failed to cache forensic error:', cacheError);
    }
  }

  /**
   * Analyze error patterns
   */
  private async analyzePatterns(error: RenderError): Promise<void> {
    // Check for common error patterns
    const patterns = [
      {
        id: 'timeout-pattern',
        name: 'Frequent Timeouts',
        pattern: /timeout/i,
        type: 'error' as const,
      },
      {
        id: 'network-error-pattern',
        name: 'Network Failures',
        pattern: /network|connection|fetch/i,
        type: 'error' as const,
      },
      {
        id: 'javascript-error-pattern',
        name: 'JavaScript Errors',
        pattern: /javascript|script|uncaught/i,
        type: 'error' as const,
      },
      {
        id: 'console-error-pattern',
        name: 'Console Errors',
        pattern: /error/i,
        type: 'console' as const,
      },
    ];

    for (const pattern of patterns) {
      if (
        (pattern.type === 'error' && pattern.pattern.test(error.error.message)) ||
        (pattern.type === 'console' && error.console.some((log) => pattern.pattern.test(log.text)))
      ) {
        const existingPattern = this.patterns.get(pattern.id);
        if (existingPattern) {
          existingPattern.frequency++;
          existingPattern.lastSeen = new Date();
        } else {
          this.patterns.set(pattern.id, {
            ...pattern,
            pattern: pattern.pattern.source || pattern.pattern.toString(),
            frequency: 1,
            lastSeen: new Date(),
            description: `Detected pattern: ${pattern.name}`,
          });
        }
      }
    }
  }

  /**
   * Get all errors with pagination
   */
  async getErrors(
    page: number = 1,
    limit: number = 50
  ): Promise<{
    errors: RenderError[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      // Get all errors from cache
      const allEntries = cache.getAllEntries();
      const errors: RenderError[] = [];

      for (const entry of allEntries) {
        if (entry.url && entry.url.startsWith('forensics:')) {
          const value = cache.get(entry.url);
          if (value) {
            try {
              const error = JSON.parse(value) as RenderError;
              errors.push(error);
            } catch (parseError) {
              this.logger.warn(`Failed to parse forensics data for key ${entry.url}:`, parseError);
            }
          }
        }
      }

      // Sort by timestamp (newest first)
      errors.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      const total = errors.length;
      const totalPages = Math.ceil(total / limit);
      const start = (page - 1) * limit;
      const end = start + limit;

      return {
        errors: errors.slice(start, end),
        total,
        page,
        totalPages,
      };
    } catch (error) {
      this.logger.error('Failed to get errors:', error);
      return {
        errors: [],
        total: 0,
        page: 1,
        totalPages: 0,
      };
    }
  }

  /**
   * Get a specific error by ID
   */
  async getError(id: string): Promise<RenderError | null> {
    try {
      const cached = cache.get(`forensics:${id}`);
      if (!cached) return null;

      try {
        return JSON.parse(cached) as RenderError;
      } catch (parseError) {
        this.logger.warn(`Failed to parse forensics data for ID ${id}:`, parseError);
        return null;
      }
    } catch (error) {
      this.logger.warn(`Failed to get error ${id}:`, error);
      return null;
    }
  }

  /**
   * Get error statistics
   */
  async getStats(): Promise<ForensicsStats> {
    try {
      const { errors } = await this.getErrors(1, 1000); // Get up to 1000 errors for analysis
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const stats: ForensicsStats = {
        totalErrors: errors.length,
        todayErrors: errors.filter((e) => new Date(e.timestamp) >= today).length,
        errorsByType: {},
        topErrorUrls: [],
        detectedPatterns: Array.from(this.patterns.values()),
      };

      // Count errors by type
      for (const error of errors) {
        stats.errorsByType[error.error.type] = (stats.errorsByType[error.error.type] || 0) + 1;
      }

      // Find top error URLs
      const urlCounts: Record<string, number> = {};
      for (const error of errors) {
        urlCounts[error.url] = (urlCounts[error.url] || 0) + 1;
      }

      stats.topErrorUrls = Object.entries(urlCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([url, count]) => ({ url, count }));

      return stats;
    } catch (error) {
      this.logger.error('Failed to get stats:', error);
      return {
        totalErrors: 0,
        todayErrors: 0,
        errorsByType: {},
        topErrorUrls: [],
        detectedPatterns: [],
      };
    }
  }

  /**
   * Clear old errors
   */
  async clearOldErrors(daysToKeep: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      let deleted = 0;
      const allEntries = cache.getAllEntries();

      for (const entry of allEntries) {
        if (entry.url && entry.url.startsWith('forensics:')) {
          const value = cache.get(entry.url);
          if (value) {
            try {
              const error = JSON.parse(value) as RenderError;
              if (new Date(error.timestamp) < cutoffDate) {
                cache.delete(entry.url);
                deleted++;
              }
            } catch (parseError) {
              this.logger.warn(`Failed to parse forensics data for key ${entry.url}:`, parseError);
            }
          }
        }
      }

      this.logger.info(`Cleared ${deleted} old forensic errors`);
      return deleted;
    } catch (error) {
      this.logger.error('Failed to clear old errors:', error);
      return 0;
    }
  }

  /**
   * Get errors for a specific URL
   */
  async getErrorsByUrl(url: string, limit: number = 20): Promise<RenderError[]> {
    try {
      const { errors } = await this.getErrors(1, 1000);
      return errors.filter((error) => error.url === url).slice(0, limit);
    } catch (error) {
      this.logger.error('Failed to get errors by URL:', error);
      return [];
    }
  }

  /**
   * Delete an error
   */
  async deleteError(id: string): Promise<boolean> {
    try {
      const deleted = cache.delete(`forensics:${id}`);
      return deleted > 0;
    } catch (error) {
      this.logger.error(`Failed to delete error ${id}:`, error);
      return false;
    }
  }
}

export default new ForensicsCollector();
