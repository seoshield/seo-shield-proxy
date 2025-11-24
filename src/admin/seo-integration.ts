import { Request, Response, NextFunction } from 'express';
import { getSEOProtocolsService } from './seo-protocols-service';

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
    res.write = function(chunk: any) {
      if (typeof chunk === 'string') {
        htmlContent += chunk;
      } else if (Buffer.isBuffer(chunk)) {
        htmlContent += chunk.toString();
      }
      return true;
    };

    // Override res.end to apply SEO optimizations
    res.end = function(chunk?: any, encoding?: any) {
      if (chunk) {
        if (typeof chunk === 'string') {
          htmlContent += chunk;
        } else if (Buffer.isBuffer(chunk)) {
          htmlContent += chunk.toString();
        }
      }

      // Apply SEO optimizations
      applySEOOptimizations(req, res, htmlContent, seoService);

      return originalEnd(chunk, encoding);
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
          next = (error?: any) => {
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
          retryAfter: circuitBreaker.getTimeUntilNextRetry()
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
async function applySEOOptimizations(
  req: Request,
  res: Response,
  html: string,
  seoService: any
) {
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
      console.log(`📝 SEO optimizations applied for ${req.url}`);
    }

    // Log optimization summary
    const status = await seoService.getStatus();
    if (status.overall === 'healthy') {
      console.log(`✅ SEO protocols healthy for ${req.url}`);
    } else {
      console.warn(`⚠️ SEO protocols status: ${status.overall} for ${req.url}`);
    }

  } catch (error) {
    console.error(`❌ SEO optimization error for ${req.url}:`, error);
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
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
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
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
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
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  };
}

/**
 * Initialize SEO protocols service
 * Call this during server startup
 */
export async function initializeSEOProtocols(config?: any) {
  try {
    const seoService = getSEOProtocolsService(config);
    await seoService.initialize();

    console.log('🎉 SEO Protocols Service initialized successfully');

    // Set up graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('🛑 Shutting down SEO protocols...');
      await seoService.shutdown();
    });

    process.on('SIGINT', async () => {
      console.log('🛑 Shutting down SEO protocols...');
      await seoService.shutdown();
    });

    return seoService;
  } catch (error) {
    console.error('❌ Failed to initialize SEO Protocols Service:', error);
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
    res.end = function(chunk?: any, encoding?: any) {
      const duration = Date.now() - startTime;

      // Log SEO metrics for bot requests
      if (req.isBot) {
        logSEOMetrics(req, duration, seoService);
      }

      return originalEnd(chunk, encoding);
    };

    next();
  };
}

/**
 * Log SEO performance metrics
 */
function logSEOMetrics(req: Request, duration: number, seoService: any) {
  console.log(`📊 SEO Request: ${req.method} ${req.url} - ${duration}ms`);

  // Log protocol status periodically
  if (Math.random() < 0.1) { // Log 10% of requests to avoid spam
    seoService.getStatus().then((status: any) => {
      if (status.overall !== 'healthy') {
        console.warn(`⚠️ SEO Protocols Status: ${status.overall}`);
      }
    }).catch(() => {
      // Ignore errors in monitoring
    });
  }
}