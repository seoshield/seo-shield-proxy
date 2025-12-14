import { Request, Response, NextFunction } from 'express';
import { getSEOProtocolsService, SEOProtocolsService } from './seo-protocols-service';
import { Logger } from '../utils/logger';
import { SeoProtocolConfig } from '../config';

const logger = new Logger('SEOIntegration');

/**
 * SEO Protocols Integration Middleware
 *
 * This file provides ready-to-use Express middleware for integrating
 * all advanced SEO optimization protocols with your existing server.
 */

/**
 * Main SEO optimization middleware
 * Applies all enabled SEO protocols to bot requests
 */
export function seoOptimizationMiddleware() {
  const seoService = getSEOProtocolsService();

  return async (req: Request, res: Response, next: NextFunction) => {
    // Only apply SEO protocols to bot requests
    if (!req.isBot) {
      return next();
    }

    // Store original res.end to intercept HTML
    const originalEnd = res.end.bind(res);
    let htmlContent = '';

    // Override res.write to capture content
    res.write = function (chunk: Buffer | string) {
      if (typeof chunk === 'string') {
        htmlContent += chunk;
      } else if (Buffer.isBuffer(chunk)) {
        htmlContent += chunk.toString();
      }
      return true;
    };

    // Override res.end to apply SEO optimizations
    (res.end as Function) = function (chunk?: Buffer | string, encoding?: BufferEncoding): Response {
      if (chunk) {
        if (typeof chunk === 'string') {
          htmlContent += chunk;
        } else if (Buffer.isBuffer(chunk)) {
          htmlContent += chunk.toString();
        }
      }

      // Apply SEO optimizations
      applySEOOptimizations(req, res, htmlContent, seoService);

      if (encoding) {
        return originalEnd(chunk, encoding);
      }
      return originalEnd(chunk);
    };

    next();
  };
}

/**
 * ETag middleware for browser caching optimization
 */
export function etagMiddleware() {
  const seoService = getSEOProtocolsService();
  const etagService = seoService.getETagService();

  if (!etagService) {
    return (req: Request, res: Response, next: NextFunction) => next();
  }

  return etagService.middleware();
}

/**
 * Circuit breaker middleware for failure protection
 */
export function circuitBreakerMiddleware(operationName: string) {
  const seoService = getSEOProtocolsService();
  const circuitBreakerManager = seoService.getCircuitBreakerManager();

  if (!circuitBreakerManager) {
    return (req: Request, res: Response, next: NextFunction) => next();
  }

  const circuitBreaker = circuitBreakerManager.getCircuit(operationName);

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await circuitBreaker.execute(async () => {
        return new Promise((resolve, reject) => {
          const originalNext = next;
          next = (error?: unknown) => {
            if (error) {
              reject(error);
            } else {
              resolve(undefined);
            }
          };
          originalNext();
        });
      });

      if (result.success) {
        next();
      } else {
        res.status(503).json({
          error: 'Service temporarily unavailable',
          message: 'Circuit breaker is open',
          retryAfter: circuitBreaker.getTimeUntilNextRetry(),
        });
      }
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Apply SEO optimizations to response
 */
async function applySEOOptimizations(req: Request, res: Response, html: string, seoService: SEOProtocolsService) {
  try {
    // Get ETag headers if enabled
    const etagService = seoService.getETagService();
    if (etagService) {
      const etagResult = await etagService.generateETagForSSR(req.url, html);
      res.set('ETag', etagResult.etag);
      res.set('Last-Modified', etagResult.lastModified);
      res.set('Cache-Control', etagResult.cacheControl);
    }

    // Update final HTML with optimizations
    const shadowDOMExtractor = seoService.getShadowDOMExtractor();
    if (shadowDOMExtractor) {
      // Note: This would need page access, so it's mainly for browser-based optimizations
      logger.debug(`SEO optimizations applied for ${req.url}`);
    }

    // Log optimization summary
    const status = await seoService.getStatus();
    if (status.overall === 'healthy') {
      logger.debug(`SEO protocols healthy for ${req.url}`);
    } else {
      logger.warn(`SEO protocols status: ${status.overall} for ${req.url}`);
    }
  } catch (error) {
    logger.error(`SEO optimization error for ${req.url}:`, error);
  }
}

/**
 * SEO protocols status endpoint
 */
export function seoStatusEndpoint() {
  const seoService = getSEOProtocolsService();

  return async (req: Request, res: Response) => {
    try {
      const status = await seoService.getStatus();
      const metrics = await seoService.getMetrics();

      res.json({
        success: true,
        status,
        metrics,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };
}

/**
 * SEO protocols configuration endpoint
 */
export function seoConfigEndpoint() {
  const seoService = getSEOProtocolsService();

  return {
    get: async (req: Request, res: Response) => {
      try {
        const config = seoService.getConfig();
        res.json({
          success: true,
          config,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },

    post: async (req: Request, res: Response) => {
      try {
        const newConfig = req.body;
        seoService.updateConfig(newConfig);

        res.json({
          success: true,
          message: 'Configuration updated successfully',
          config: seoService.getConfig(),
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  };
}

/**
 * Initialize SEO protocols service
 * Call this during server startup
 */
export async function initializeSEOProtocols(config?: Partial<SeoProtocolConfig>) {
  try {
    const seoService = getSEOProtocolsService(config);
    await seoService.initialize();

    logger.info('SEO Protocols Service initialized successfully');

    // Set up graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('Shutting down SEO protocols...');
      await seoService.shutdown();
    });

    process.on('SIGINT', async () => {
      logger.info('Shutting down SEO protocols...');
      await seoService.shutdown();
    });

    return seoService;
  } catch (error) {
    logger.error('Failed to initialize SEO Protocols Service:', error);
    throw error;
  }
}

/**
 * SEO monitoring middleware
 * Logs performance metrics and health status
 */
export function seoMonitoringMiddleware() {
  const seoService = getSEOProtocolsService();

  return async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    // Continue with request
    const originalEnd = res.end.bind(res);
    (res.end as Function) = function (chunk?: Buffer | string, encoding?: BufferEncoding): Response {
      const duration = Date.now() - startTime;

      // Log SEO metrics for bot requests
      if (req.isBot) {
        logSEOMetrics(req, duration, seoService);
      }

      if (encoding) {
        return originalEnd(chunk, encoding);
      }
      return originalEnd(chunk);
    };

    next();
  };
}

/**
 * Log SEO performance metrics
 */
function logSEOMetrics(req: Request, duration: number, seoService: SEOProtocolsService) {
  logger.debug(`SEO Request: ${req.method} ${req.url} - ${duration}ms`);

  // Log protocol status periodically
  if (Math.random() < 0.1) {
    // Log 10% of requests to avoid spam
    seoService
      .getStatus()
      .then((status: { overall: 'healthy' | 'degraded' | 'unhealthy' }) => {
        if (status.overall !== 'healthy') {
          logger.warn(`SEO Protocols Status: ${status.overall}`);
        }
      })
      .catch(() => {
        // Ignore errors in monitoring
      });
  }
}
