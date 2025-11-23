import express, { Request, Response, NextFunction } from 'express';
import { createServer, Server as HttpServer } from 'http';
import { createProxyMiddleware, RequestHandler } from 'http-proxy-middleware';
import { isbot } from 'isbot';
import config from './config.js';
import cache from './cache.js';
import browserManager from './browser.js';
import CacheRules from './cache-rules.js';
import adminRoutes from './admin/admin-routes.js';
import metricsCollector from './admin/metrics-collector.js';
import configManager from './admin/config-manager.js';
import { initializeWebSocket } from './admin/websocket.js';

const app = express();
const httpServer: HttpServer = createServer(app);

// Initialize cache rules
const cacheRules = new CacheRules(config);

// Mount admin panel with error handling
try {
  const runtimeConfig = configManager.getConfig();
  const adminPath = runtimeConfig?.adminPath || '/admin';
  console.log(`🔧 Admin panel mounted at: ${adminPath}`);
  app.use(adminPath, adminRoutes);
} catch (error) {
  console.error('⚠️  Failed to mount admin panel:', (error as Error).message);
}

/**
 * Static asset extensions
 */
const STATIC_EXTENSIONS = [
  '.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico',
  '.woff', '.woff2', '.ttf', '.eot', '.otf', '.json', '.xml', '.txt',
  '.pdf', '.mp4', '.webm', '.mp3', '.wav',
];

function isStaticAsset(path: string): boolean {
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

  // 1. Static assets - proxy directly
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

  // 2. Human users - proxy directly
  const isBotRequest = isbot(userAgent);
  if (!isBotRequest) {
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

  // 3. Bot detected - check cache rules
  console.log(`🤖 Bot detected: ${userAgent.substring(0, 80)}`);

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
    const cacheKey = req.url;
    let cachedHtml: string | undefined = undefined;

    if (urlDecision.shouldCache) {
      cachedHtml = cache.get(cacheKey);
    }

    if (cachedHtml) {
      console.log(`🚀 Serving cached HTML for: ${requestPath}`);
      metricsCollector.recordRequest({
        path: requestPath,
        userAgent,
        isBot: true,
        action: 'ssr',
        cacheStatus: 'HIT',
        rule: urlDecision.reason,
      });
      res.set('Content-Type', 'text/html; charset=utf-8');
      res.set('X-Rendered-By', 'SEO-Shield-Proxy');
      res.set('X-Cache-Status', 'HIT');
      res.set('X-Cache-Rule', urlDecision.reason);
      return res.send(cachedHtml);
    }

    // Render with Puppeteer
    console.log(`🎨 Rendering with Puppeteer: ${fullUrl}`);
    const html = await browserManager.render(fullUrl);

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
      isBot: true,
      action: 'ssr',
      cacheStatus: 'MISS',
      rule: finalDecision.reason,
      cached: finalDecision.shouldCache,
    });

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('X-Rendered-By', 'SEO-Shield-Proxy');
    res.set('X-Cache-Status', 'MISS');
    res.set('X-Cache-Rule', finalDecision.reason);
    res.set('X-Cache-Allowed', finalDecision.shouldCache ? 'true' : 'false');
    res.send(html);
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
app.get('/health', (_req: Request, res: Response) => {
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
app.post('/cache/clear', (_req: Request, res: Response) => {
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
