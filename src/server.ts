import express, { Request, Response, NextFunction } from 'express';
import { createServer, Server as HttpServer } from 'http';
import { createProxyMiddleware, RequestHandler } from 'http-proxy-middleware';
import { isbot } from 'isbot';
import config from './config';
import cache, { getCache } from './cache';
import browserManager from './browser';
import CacheRules from './cache-rules';
import adminRoutes from './admin/admin-routes';
import metricsCollector from './admin/metrics-collector';
import configManager from './admin/config-manager';
import hotfixEngine from './admin/hotfix-engine';
import { initializeWebSocket } from './admin/websocket';
import {
  generalRateLimiter,
  ssrRateLimiter,
  adminRateLimiter,
  apiRateLimiter
} from './middleware/rate-limiter';

const app = express();
const httpServer: HttpServer = createServer(app);

// Apply general rate limiting
app.use(generalRateLimiter);

// Trust proxy for proper IP detection
app.set('trust proxy', 1);

// Initialize cache rules
const cacheRules = new CacheRules(config);

/**
 * Generate debug recommendations for enterprise SEO optimization
 */
function generateDebugRecommendations(metrics: {
  renderTime: number;
  httpStatus: number;
  cacheAllowed: boolean;
  utilizationRate: number;
  memoryUsage: number;
  soft404Detected: boolean;
}): Array<{ category: string; priority: 'high' | 'medium' | 'low'; message: string; suggestion?: string }> {
  const recommendations = [];

  // SEO Issues
  if (metrics.soft404Detected) {
    recommendations.push({
      category: 'SEO',
      priority: 'high',
      message: 'Soft 404 detected - page returns 200 but content indicates 404',
      suggestion: 'Add proper 404 status codes or meta tags to improve SEO compliance'
    });
  }

  if (metrics.httpStatus >= 400) {
    recommendations.push({
      category: 'SEO',
      priority: 'high',
      message: `Error status code detected: ${metrics.httpStatus}`,
      suggestion: 'Check target application for errors that may affect search rankings'
    });
  }

  // Performance Issues
  if (metrics.renderTime > 10000) {
    recommendations.push({
      category: 'Performance',
      priority: 'high',
      message: `Slow render time: ${(metrics.renderTime / 1000).toFixed(1)}s`,
      suggestion: 'Optimize page load time or increase PUPPETEER_TIMEOUT'
    });
  } else if (metrics.renderTime > 5000) {
    recommendations.push({
      category: 'Performance',
      priority: 'medium',
      message: `Moderate render time: ${(metrics.renderTime / 1000).toFixed(1)}s`,
      suggestion: 'Consider optimizing page resources for better performance'
    });
  }

  // Caching Issues
  if (!metrics.cacheAllowed) {
    recommendations.push({
      category: 'Caching',
      priority: 'medium',
      message: 'Page not cached - may impact performance',
      suggestion: 'Review cache rules and add cache-control meta tags where appropriate'
    });
  }

  // System Resource Issues
  if (metrics.utilizationRate > 0.8) {
    recommendations.push({
      category: 'Resources',
      priority: 'high',
      message: `High queue utilization: ${(metrics.utilizationRate * 100).toFixed(1)}%`,
      suggestion: 'Consider increasing MAX_CONCURRENT_RENDERS or optimizing page complexity'
    });
  } else if (metrics.utilizationRate > 0.6) {
    recommendations.push({
      category: 'Resources',
      priority: 'medium',
      message: `Moderate queue utilization: ${(metrics.utilizationRate * 100).toFixed(1)}%`,
      suggestion: 'Monitor traffic patterns and consider scaling if needed'
    });
  }

  const memoryMB = metrics.memoryUsage / 1024 / 1024;
  if (memoryMB > 500) {
    recommendations.push({
      category: 'Resources',
      priority: 'medium',
      message: `High memory usage: ${memoryMB.toFixed(1)}MB`,
      suggestion: 'Monitor for memory leaks and consider implementing Redis for distributed caching'
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      category: 'Optimization',
      priority: 'low',
      message: 'System operating optimally',
      suggestion: 'Continue monitoring performance metrics'
    });
  }

  return recommendations;
}

// Mount admin panel with rate limiting
try {
  const runtimeConfig = configManager.getConfig();
  const adminPath = runtimeConfig?.adminPath || '/admin';
  console.log(`🔧 Admin panel mounted at: ${adminPath}`);

  // Serve admin dashboard HTML at the root admin path
  app.get(adminPath, adminRateLimiter, (_req: Request, res: Response) => {
    res.sendFile('index.html', { root: './public/admin' });
  });

  // Mount admin API routes
  app.use(adminPath, adminRateLimiter, adminRoutes);
} catch (error) {
  console.error('⚠️  Failed to mount admin panel:', (error as Error).message);
}

/**
 * Static asset extensions
 */
const STATIC_EXTENSIONS = [
  '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico',
  '.woff', '.woff2', '.ttf', '.eot', '.otf', '.json', '.xml', '.txt',
  '.pdf', '.mp4', '.webm', '.mp3', '.wav', '.js', '.jsx', '.ts', '.tsx',
];

function isStaticAsset(path: string): boolean {
  // Don't treat API endpoints or root paths as static assets
  if (path.startsWith('/api') || path.startsWith('/health') || path === '/' || path.endsWith('/')) {
    return false;
  }

  return STATIC_EXTENSIONS.some((ext) => path.toLowerCase().endsWith(ext));
}

/**
 * Proxy configuration
 */
const proxyMiddleware: RequestHandler = createProxyMiddleware({
  target: config.TARGET_URL,
  changeOrigin: true,
  ws: true,
  followRedirects: true,
  // @ts-ignore - proxy middleware types
  onProxyReq: (proxyReq: any, req: any) => {
    proxyReq.setHeader('X-Forwarded-Host', req.headers.host || '');
    proxyReq.setHeader('X-Forwarded-Proto', req.protocol);
  },
  // @ts-ignore - proxy middleware types
  onError: (err: any, _req: any, res: any) => {
    console.error('❌ Proxy error:', err.message);
    if (typeof res.status === 'function') {
      res.status(502).send('Bad Gateway: Unable to reach target application');
    }
  },
});

/**
 * SSR-specific rate limiting middleware
 */
app.use((req: Request, res: Response, next: NextFunction): void => {
  // Apply stricter rate limiting for potential SSR requests
  const userAgent = req.get('User-Agent') || '';
  const isLikelyBot = isbot(userAgent);
  const isRenderRequest = req.query['_render'] !== undefined;

  // Apply SSR rate limiting for bots or render requests
  if (isLikelyBot || isRenderRequest) {
    ssrRateLimiter(req, res, next);
    return;
  }

  next();
});

/**
 * Main middleware - Bot detection and SSR
 */
app.use(async (req: Request, res: Response, next: NextFunction) => {
  const userAgent = req.headers['user-agent'] || '';
  const requestPath = req.path;

  let fullUrl: string;
  try {
    const targetUrl = new URL(config.TARGET_URL);
    fullUrl = `${targetUrl.origin}${req.url}`;
  } catch (error) {
    console.error('❌ Invalid TARGET_URL configuration:', (error as Error).message);
    return res.status(500).send('Server configuration error');
  }

  const uaPreview = userAgent.length > 100 ? `${userAgent.substring(0, 97)}...` : userAgent;
  console.log(`📥 ${req.method} ${requestPath} - UA: ${uaPreview}`);

  // 1. Check if this is an admin route (these should not be treated as static assets)
  if (requestPath.startsWith('/admin') || requestPath.startsWith('/admin/')) {
    console.log(`🔧 Admin route detected: ${requestPath} - Letting Express handle it`);
    metricsCollector.recordRequest({
      path: requestPath,
      userAgent,
      isBot: false,
      action: 'proxy',
      cacheStatus: null,
    });
    return next(); // Let Express app handle admin routes
  }

  // 1.5. Check if this is a server endpoint that should not be proxied
  if (requestPath.startsWith('/health') || requestPath.startsWith('/cache/') || requestPath.startsWith('/api')) {
    console.log(`🔧 Server endpoint detected: ${requestPath} - Letting Express handle it`);
    metricsCollector.recordRequest({
      path: requestPath,
      userAgent,
      isBot: false,
      action: 'proxy',
      cacheStatus: null,
    });
    return next(); // Let Express app handle server endpoints
  }

  // 2. Static assets - proxy directly
  if (isStaticAsset(requestPath)) {
    console.log(`📦 Static asset detected: ${requestPath} - Proxying directly`);
    metricsCollector.recordRequest({
      path: requestPath,
      userAgent,
      isBot: false,
      action: 'static',
      cacheStatus: null,
    });
    return proxyMiddleware(req, res, next);
  }

  // 2. Check for render preview parameter
  const renderParam = req.query['_render'] as string;
  const isRenderPreview = renderParam === 'true' || renderParam === 'debug';
  const isDebugMode = renderParam === 'debug';

  // 3. Human users (without preview) - proxy directly
  const isBotRequest = isbot(userAgent);
  if (!isBotRequest && !isRenderPreview) {
    console.log(`👤 Human user detected - Proxying to ${config.TARGET_URL}`);
    metricsCollector.recordRequest({
      path: requestPath,
      userAgent,
      isBot: false,
      action: 'proxy',
      cacheStatus: null,
    });
    return proxyMiddleware(req, res, next);
  }

  // 4. Bot detected or render preview requested
  if (isRenderPreview) {
    console.log(`🔍 Render preview requested (debug: ${isDebugMode})`);
  } else {
    console.log(`🤖 Bot detected: ${userAgent.substring(0, 80)}`);
  }

  const urlDecision = cacheRules.shouldCacheUrl(req.url);
  console.log(`📋 Cache decision for ${requestPath}: ${urlDecision.reason}`);

  if (!urlDecision.shouldRender) {
    console.log(`⏩ Skipping SSR based on rules - Proxying to ${config.TARGET_URL}`);
    metricsCollector.recordRequest({
      path: requestPath,
      userAgent,
      isBot: true,
      action: 'bypass',
      cacheStatus: null,
      rule: urlDecision.reason,
    });
    return proxyMiddleware(req, res, next);
  }

  try {
    const startTime = Date.now();
    const cacheKey = req.url;
    let cacheEntry;

    // Check cache with TTL information (for SWR strategy)
    if (urlDecision.shouldCache) {
      cacheEntry = cache.getWithTTL(cacheKey);
    }

    // Enhanced SWR Strategy with Enterprise Features
    if (cacheEntry) {
      const isStale = cacheEntry.isStale;
      const stalenessRatio = cacheEntry.ttl > 0 ? Math.max(0, 1 - (cacheEntry.ttl / (config.CACHE_TTL * 1000))) : 1;

      if (isStale) {
        // Stale-While-Revalidate: Serve stale data immediately
        console.log(`🔄 SWR: Serving stale content for: ${requestPath} (staleness: ${(stalenessRatio * 100).toFixed(1)}%)`);
        metricsCollector.recordRequest({
          path: requestPath,
          userAgent,
          isBot: !isRenderPreview,
          action: 'ssr',
          cacheStatus: 'STALE',
          rule: urlDecision.reason,
        });

        // Background revalidation with deduplication and intelligent backoff
        (async () => {
          try {
            console.log(`🔄 Background revalidation started for: ${requestPath}`);

            // Check if another revalidation is already in progress
            const revalidationKey = `revalidating:${cacheKey}`;
            const isAlreadyRevalidating = cache.get(revalidationKey);

            if (isAlreadyRevalidating) {
              console.log(`⏩ Revalidation already in progress for: ${requestPath}, skipping duplicate`);
              return;
            }

            // Mark as revalidating to prevent duplicate requests
            cache.set(revalidationKey, 'true', 30); // 30-second lock

            const renderResult = await browserManager.render(fullUrl);
            const { html, statusCode: renderStatusCode } = renderResult;

            // Enhanced caching decision based on render status and staleness
            const shouldRecache =
              !renderStatusCode || renderStatusCode < 400 // Don't cache error responses
              && stalenessRatio < 0.8 // Only revalidate if not too stale (80% threshold)
              && html.length > 1000; // Don't cache very short responses (likely errors)

            if (shouldRecache) {
              const finalDecision = cacheRules.getCacheDecision(req.url, html);
              if (finalDecision.shouldCache) {
                // Adaptive TTL based on staleness and content
                let adaptiveTTL = config.CACHE_TTL;

                // Reduce TTL for highly stale content
                if (stalenessRatio > 0.5) {
                  adaptiveTTL = Math.max(300, adaptiveTTL / 2); // Minimum 5 minutes
                }

                // Increase TTL for fresh content
                if (stalenessRatio < 0.2) {
                  adaptiveTTL = Math.min(config.CACHE_TTL * 2, adaptiveTTL * 1.5);
                }

                cache.set(cacheKey, html, adaptiveTTL);
                console.log(`✅ Background revalidation completed for: ${requestPath} (TTL: ${adaptiveTTL}s)`);
              } else {
                console.log(`⚠️  Revalidation skipped due to cache rules: ${finalDecision.reason}`);
              }
            } else {
              console.log(`⚠️  Revalidation skipped: statusCode=${renderStatusCode}, staleness=${(stalenessRatio * 100).toFixed(1)}%, length=${html.length}`);
            }

            // Clean up revalidation lock
            cache.delete(revalidationKey);

          } catch (error) {
            console.error(`⚠️  Background revalidation failed for ${requestPath}:`, (error as Error).message);

            // Clean up revalidation lock on error
            try {
              cache.delete(`revalidating:${cacheKey}`);
            } catch (cleanupError) {
              // Ignore cleanup errors
            }
          }
        })();

        // Return stale content immediately
        res.set('Content-Type', 'text/html; charset=utf-8');
        res.set('X-Rendered-By', 'SEO-Shield-Proxy');
        res.set('X-Cache-Status', 'STALE');
        res.set('X-Cache-Rule', urlDecision.reason);
        res.set('X-SWR', 'true');

        if (isRenderPreview) {
          res.set('X-Render-Preview', 'true');
        }

        let responseHtml = cacheEntry.value;

        // Add debug metadata for ?_render=debug
        if (isDebugMode) {
          const queueMetrics = browserManager.getMetrics();
          const debugInfo = {
            timestamp: new Date().toISOString(),
            requestPath,
            cacheStatus: 'STALE',
            cacheRule: urlDecision.reason,
            swr: true,
            backgroundRevalidation: true,
            responseTime: Date.now() - startTime,
            queueMetrics: {
              queued: queueMetrics.queued,
              processing: queueMetrics.processing,
              completed: queueMetrics.completed,
              errors: queueMetrics.errors,
              maxConcurrency: queueMetrics.maxConcurrency,
            },
          };

          res.set('X-Debug-Mode', 'true');
          res.set('X-Debug-Info', JSON.stringify(debugInfo));

          // Inject debug info as HTML comment
          const debugComment = `\n<!-- SEO Shield Proxy Debug Info\n${JSON.stringify(debugInfo, null, 2)}\n-->\n`;
          responseHtml = debugComment + responseHtml;
        }

        // Apply hotfixes for emergency SEO overrides
        const hotfixResult = await hotfixEngine.applyHotfixes(responseHtml, requestPath, req.headers as Record<string, string>);

        return res.send(hotfixResult.html);
      }

      // Fresh cache hit
      console.log(`🚀 Serving fresh cached HTML for: ${requestPath}`);
      metricsCollector.recordRequest({
        path: requestPath,
        userAgent,
        isBot: !isRenderPreview,
        action: 'ssr',
        cacheStatus: 'HIT',
        rule: urlDecision.reason,
      });
      res.set('Content-Type', 'text/html; charset=utf-8');
      res.set('X-Rendered-By', 'SEO-Shield-Proxy');
      res.set('X-Cache-Status', 'HIT');
      res.set('X-Cache-Rule', urlDecision.reason);
      res.set('X-Cache-TTL', Math.floor(cacheEntry.ttl).toString());

      if (isRenderPreview) {
        res.set('X-Render-Preview', 'true');
      }

      let responseHtml = cacheEntry.value;

      // Add debug metadata for ?_render=debug
      if (isDebugMode) {
        const queueMetrics = browserManager.getMetrics();
        const debugInfo = {
          timestamp: new Date().toISOString(),
          requestPath,
          cacheStatus: 'HIT',
          cacheRule: urlDecision.reason,
          cacheTTL: Math.floor(cacheEntry.ttl),
          responseTime: Date.now() - startTime,
          queueMetrics: {
            queued: queueMetrics.queued,
            processing: queueMetrics.processing,
            completed: queueMetrics.completed,
            errors: queueMetrics.errors,
            maxConcurrency: queueMetrics.maxConcurrency,
          },
        };

        res.set('X-Debug-Mode', 'true');
        res.set('X-Debug-Info', JSON.stringify(debugInfo));

        // Inject debug info as HTML comment
        const debugComment = `\n<!-- SEO Shield Proxy Debug Info\n${JSON.stringify(debugInfo, null, 2)}\n-->\n`;
        responseHtml = debugComment + responseHtml;
      }

      // Apply hotfixes for emergency SEO overrides
      const hotfixResult = await hotfixEngine.applyHotfixes(responseHtml, requestPath, req.headers as Record<string, string>);

      return res.send(hotfixResult.html);
    }

    // Render with Puppeteer
    console.log(`🎨 Rendering with Puppeteer: ${fullUrl}`);
    const renderStartTime = Date.now();
    const renderResult = await browserManager.render(fullUrl);
    const renderTime = Date.now() - renderStartTime;
    const { html, statusCode } = renderResult;

    const finalDecision = cacheRules.getCacheDecision(req.url, html);

    if (finalDecision.shouldCache) {
      cache.set(cacheKey, html);
      console.log(`💾 HTML cached for: ${requestPath}`);
    } else {
      console.log(`⚠️  HTML NOT cached: ${finalDecision.reason}`);
    }

    metricsCollector.recordRequest({
      path: requestPath,
      userAgent,
      isBot: !isRenderPreview,
      action: 'ssr',
      cacheStatus: 'MISS',
      rule: finalDecision.reason,
      cached: finalDecision.shouldCache,
    });

    // Use custom status code if detected from meta tag
    const httpStatus = statusCode || 200;

    res.status(httpStatus);
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('X-Rendered-By', 'SEO-Shield-Proxy');
    res.set('X-Cache-Status', 'MISS');
    res.set('X-Cache-Rule', finalDecision.reason);
    res.set('X-Cache-Allowed', finalDecision.shouldCache ? 'true' : 'false');
    if (statusCode) {
      res.set('X-Prerender-Status-Code', statusCode.toString());
    }

    if (isRenderPreview) {
      res.set('X-Render-Preview', 'true');
    }

    let responseHtml = html;

    // Enhanced Debug Mode for Enterprise SEO Analysis
    if (isDebugMode) {
      const queueMetrics = browserManager.getMetrics();
      const cacheStats = cache.getStats();
      const memoryUsage = process.memoryUsage();
      const soft404Detected = statusCode === 404 && httpStatus !== 404;

      // Comprehensive debug information
      const debugInfo = {
        // Request information
        request: {
          timestamp: new Date().toISOString(),
          path: requestPath,
          fullUrl,
          userAgent: userAgent.substring(0, 200) + (userAgent.length > 200 ? '...' : ''),
          isBot: isBotRequest,
          isPreview: isRenderPreview,
          clientIP: req.ip || req.connection?.remoteAddress || 'unknown',
        },

        // SEO Analysis
        seo: {
          cacheStatus: 'MISS',
          cacheRule: finalDecision.reason,
          cacheAllowed: finalDecision.shouldCache,
          httpStatus,
          prerenderStatusCode: statusCode || null,
          soft404Detected,
          estimatedPageLoadTime: renderTime,
        },

        // Performance metrics
        performance: {
          renderTime,
          totalResponseTime: Date.now() - startTime,
          cacheLookupTime: 0, // Could be measured if needed
          contentSize: html.length,
          compressionRatio: 0, // Could be calculated if compression is enabled
        },

        // System metrics
        system: {
          queueMetrics: {
            queued: queueMetrics.queued,
            processing: queueMetrics.processing,
            completed: queueMetrics.completed,
            errors: queueMetrics.errors,
            maxConcurrency: queueMetrics.maxConcurrency,
            utilizationRate: queueMetrics.maxConcurrency > 0 ? (queueMetrics.processing / queueMetrics.maxConcurrency * 100).toFixed(1) + '%' : '0%',
          },
          cacheMetrics: {
            keys: cacheStats.keys,
            hits: cacheStats.hits,
            misses: cacheStats.misses,
            hitRate: cacheStats.hits + cacheStats.misses > 0 ? (cacheStats.hits / (cacheStats.hits + cacheStats.misses) * 100).toFixed(1) + '%' : '0%',
            memoryUsage: `${(cacheStats.ksize + cacheStats.vsize / 1024 / 1024).toFixed(2)}MB`,
          },
          memoryUsage: {
            rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)}MB`,
            heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
            heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
            external: `${(memoryUsage.external / 1024 / 1024).toFixed(2)}MB`,
          },
        },

        // Configuration
        config: {
          cacheType: config.CACHE_TYPE,
          cacheTTL: config.CACHE_TTL,
          maxConcurrency: config.MAX_CONCURRENT_RENDERS,
          targetUrl: config.TARGET_URL,
          nodeEnv: config.NODE_ENV,
        },

        // Headers and analysis
        headers: {
          'user-agent': userAgent,
          'accept': req.get('accept') || '',
          'accept-language': req.get('accept-language') || '',
          'referer': req.get('referer') || '',
          'x-forwarded-for': req.get('x-forwarded-for') || '',
        },

        // Debug recommendations
        recommendations: generateDebugRecommendations({
          renderTime,
          httpStatus,
          cacheAllowed: finalDecision.shouldCache,
          utilizationRate: queueMetrics.maxConcurrency > 0 ? (queueMetrics.processing / queueMetrics.maxConcurrency) : 0,
          memoryUsage: memoryUsage.heapUsed,
          soft404Detected,
        }),
      };

      res.set('X-Debug-Mode', 'true');
      res.set('X-Debug-Info', JSON.stringify(debugInfo));
      res.set('X-Debug-Timestamp', new Date().toISOString());

      // Enhanced debug injection with multiple formats
      const debugComment = `
<!-- SEO Shield Proxy - Enterprise Debug Analysis -->
<!-- Generated: ${new Date().toISOString()} -->
<!-- Request: ${requestPath} -->
<!-- Cache: ${finalDecision.shouldCache ? 'ALLOWED' : 'BLOCKED'} - ${finalDecision.reason} -->
<!-- Status: ${httpStatus} (Render: ${statusCode || 'N/A'}) -->
<!-- Performance: ${renderTime}ms render, ${Date.now() - startTime}ms total -->
<!-- Memory: ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB heap used -->
<!-- Queue: ${queueMetrics.processing}/${queueMetrics.maxConcurrency} processing -->
<!-- ${soft404Detected ? '⚠️  SOFT 404 DETECTED - SEO ISSUE!' : '✅ No SEO issues detected'} -->

<!-- Detailed Debug Information:
${JSON.stringify(debugInfo, null, 2)}
-->
`;

      responseHtml = debugComment + responseHtml;
    }

    // Apply hotfixes for emergency SEO overrides
    const hotfixResult = await hotfixEngine.applyHotfixes(responseHtml, requestPath, req.headers as Record<string, string>);

    res.send(hotfixResult.html);
  } catch (error) {
    console.error(`❌ SSR failed for ${requestPath}, falling back to proxy:`, (error as Error).message);

    metricsCollector.recordRequest({
      path: requestPath,
      userAgent,
      isBot: true,
      action: 'proxy',
      cacheStatus: null,
      error: (error as Error).message,
    });

    try {
      return proxyMiddleware(req, res, next);
    } catch (proxyError) {
      console.error('❌ Fallback proxy also failed:', (proxyError as Error).message);
      metricsCollector.recordRequest({
        path: requestPath,
        userAgent,
        isBot: true,
        action: 'error',
        cacheStatus: null,
        error: `${(error as Error).message} + ${(proxyError as Error).message}`,
      });
      res.status(500).send('Internal Server Error: Unable to render or proxy the page');
    }
  }
});

/**
 * Health check endpoint
 */
app.get('/health', generalRateLimiter, (_req: Request, res: Response) => {
  try {
    const stats = cache.getStats();
    const memoryUsage = process.memoryUsage();

    res.json({
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      memory: {
        heapUsed: Math.floor(memoryUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.floor(memoryUsage.heapTotal / 1024 / 1024),
        rss: Math.floor(memoryUsage.rss / 1024 / 1024),
        external: Math.floor(memoryUsage.external / 1024 / 1024),
      },
      cache: {
        keys: stats.keys,
        hits: stats.hits,
        misses: stats.misses,
        hitRate: (stats.hits / (stats.hits + stats.misses) || 0).toFixed(4),
        ksize: stats.ksize,
        vsize: stats.vsize,
      },
      cacheRules: cacheRules.getRulesSummary(),
      config: {
        targetUrl: config.TARGET_URL,
        cacheTtl: config.CACHE_TTL,
        puppeteerTimeout: config.PUPPETEER_TIMEOUT,
        nodeEnv: config.NODE_ENV,
      },
    });
  } catch (error) {
    console.error('❌ Health check error:', error);
    res.status(500).json({
      status: 'error',
      error: (error as Error).message,
    });
  }
});

/**
 * Cache management endpoint
 */
app.post('/cache/clear', apiRateLimiter, (_req: Request, res: Response) => {
  try {
    const statsBefore = cache.getStats();
    cache.flush();

    console.log(`🗑️  Cache cleared via API (${statsBefore.keys} keys removed)`);

    res.json({
      status: 'ok',
      message: 'Cache cleared successfully',
      cleared: {
        keys: statsBefore.keys,
        hits: statsBefore.hits,
        misses: statsBefore.misses,
      },
    });
  } catch (error) {
    console.error('❌ Cache clear error:', error);
    res.status(500).json({
      status: 'error',
      error: (error as Error).message,
    });
  }
});

/**
 * Start server (skip in test environment)
 */
if (process.env['NODE_ENV'] !== 'test') {
  // Ensure cache is initialized before starting server
  (async () => {
    try {
      console.log('🔄 Waiting for cache initialization...');
      await getCache();
      console.log('✅ Cache ready, starting server...');

      httpServer.listen(config.PORT, () => {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🛡️  SEO Shield Proxy - Production Ready');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`🚀 Server running on port ${config.PORT}`);
    console.log(`🎯 Target URL: ${config.TARGET_URL}`);
    console.log(`💾 Cache TTL: ${config.CACHE_TTL}s`);
    console.log(`⏱️  Puppeteer timeout: ${config.PUPPETEER_TIMEOUT}ms`);
    console.log('');
    console.log('Endpoints:');
    console.log(`  - Health check: http://localhost:${config.PORT}/health`);
    console.log(`  - Clear cache: POST http://localhost:${config.PORT}/cache/clear`);
    console.log(`  - Admin Dashboard: http://localhost:${config.PORT}/admin`);
    console.log('');
    console.log('Bot detection: ✅ Active');
    console.log('SSR rendering: ✅ Active');
    console.log('Reverse proxy: ✅ Active');
    console.log('WebSocket: ✅ Active');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');

    initializeWebSocket(httpServer);
      });
    } catch (error) {
      console.error('❌ Cache initialization failed:', error);
      console.log('🔄 Starting server with memory cache fallback...');
      httpServer.listen(config.PORT, () => {
        console.log('⚠️ Server started with memory cache only');
      });
    }
  })();
}

/**
 * Graceful shutdown
 */
process.on('SIGTERM', async () => {
  console.log('⚠️  SIGTERM received, shutting down gracefully...');

  httpServer.close(async () => {
    console.log('🔒 HTTP server closed');
    await browserManager.close();
    process.exit(0);
  });

  setTimeout(() => {
    console.error('⚠️  Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
});

process.on('SIGINT', async () => {
  console.log('\n⚠️  SIGINT received, shutting down gracefully...');

  httpServer.close(async () => {
    console.log('🔒 HTTP server closed');
    await browserManager.close();
    process.exit(0);
  });
});

export default app;
