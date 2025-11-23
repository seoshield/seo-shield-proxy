import express from 'express';
import { createServer } from 'http';
import { createProxyMiddleware } from 'http-proxy-middleware';
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
const httpServer = createServer(app);

// Initialize cache rules
const cacheRules = new CacheRules(config);

// Mount admin panel with error handling
try {
  const runtimeConfig = configManager.getConfig();
  const adminPath = runtimeConfig?.adminPath || '/admin';
  console.log(`🔧 Admin panel mounted at: ${adminPath}`);
  app.use(adminPath, adminRoutes);
} catch (error) {
  console.error('⚠️  Failed to mount admin panel:', error.message);
  // Continue without admin panel
}

/**
 * Static asset extensions that should always be proxied
 * (never rendered with Puppeteer)
 */
const STATIC_EXTENSIONS = [
  '.js',
  '.css',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.otf',
  '.json',
  '.xml',
  '.txt',
  '.pdf',
  '.mp4',
  '.webm',
  '.mp3',
  '.wav',
];

/**
 * Check if the request is for a static asset
 * @param {string} path - Request path
 * @returns {boolean} - True if static asset
 */
function isStaticAsset(path) {
  return STATIC_EXTENSIONS.some((ext) => path.toLowerCase().endsWith(ext));
}

/**
 * Proxy configuration for forwarding requests to the target SPA
 */
const proxyMiddleware = createProxyMiddleware({
  target: config.TARGET_URL,
  changeOrigin: true,
  ws: true, // Enable WebSocket proxying
  followRedirects: true,
  onProxyReq: (proxyReq, req) => {
    // Forward the original host header
    proxyReq.setHeader('X-Forwarded-Host', req.headers.host);
    proxyReq.setHeader('X-Forwarded-Proto', req.protocol);
  },
  onError: (err, req, res) => {
    console.error('❌ Proxy error:', err.message);
    res.status(502).send('Bad Gateway: Unable to reach target application');
  },
});

/**
 * Main middleware - Bot detection and SSR logic
 */
app.use(async (req, res, next) => {
  const userAgent = req.headers['user-agent'] || '';
  const requestPath = req.path;

  // Validate and sanitize URL construction
  let fullUrl;
  try {
    const targetUrl = new URL(config.TARGET_URL);
    fullUrl = `${targetUrl.origin}${req.url}`;
  } catch (error) {
    console.error('❌ Invalid TARGET_URL configuration:', error.message);
    return res.status(500).send('Server configuration error');
  }

  // Log incoming request (truncate very long user agents)
  const uaPreview = userAgent.length > 100 ? `${userAgent.substring(0, 97)}...` : userAgent;
  console.log(`📥 ${req.method} ${requestPath} - UA: ${uaPreview}`);

  // 1. Check if it's a static asset - always proxy
  if (isStaticAsset(requestPath)) {
    console.log(`📦 Static asset detected: ${requestPath} - Proxying directly`);

    // Record metrics
    metricsCollector.recordRequest({
      path: requestPath,
      userAgent,
      isBot: false,
      action: 'static',
      cacheStatus: null,
    });

    return proxyMiddleware(req, res, next);
  }

  // 2. Check if it's a bot
  const isBotRequest = isbot(userAgent);

  if (!isBotRequest) {
    // HUMAN USER - Proxy directly to the SPA
    console.log(`👤 Human user detected - Proxying to ${config.TARGET_URL}`);

    // Record metrics
    metricsCollector.recordRequest({
      path: requestPath,
      userAgent,
      isBot: false,
      action: 'proxy',
      cacheStatus: null,
    });

    return proxyMiddleware(req, res, next);
  }

  // 3. BOT DETECTED - Check cache rules
  console.log(`🤖 Bot detected: ${userAgent.substring(0, 80)}`);

  // Check if this URL should be rendered based on patterns
  const urlDecision = cacheRules.shouldCacheUrl(req.url);
  console.log(`📋 Cache decision for ${requestPath}: ${urlDecision.reason}`);

  // If URL pattern says don't render (e.g., NO_CACHE pattern), proxy directly
  if (!urlDecision.shouldRender) {
    console.log(`⏩ Skipping SSR based on rules - Proxying to ${config.TARGET_URL}`);

    // Record metrics
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
    // Check cache first (if URL pattern allows caching)
    const cacheKey = req.url;
    let cachedHtml = null;

    if (urlDecision.shouldCache) {
      cachedHtml = cache.get(cacheKey);
    }

    if (cachedHtml) {
      console.log(`🚀 Serving cached HTML for: ${requestPath}`);

      // Record metrics
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

    // Cache miss - Render with Puppeteer
    console.log(`🎨 Rendering with Puppeteer: ${fullUrl}`);

    const html = await browserManager.render(fullUrl);

    // Check for meta tag override in rendered HTML
    const finalDecision = cacheRules.getCacheDecision(req.url, html);

    // Store in cache if allowed by both URL pattern and meta tag
    if (finalDecision.shouldCache) {
      cache.set(cacheKey, html);
      console.log(`💾 HTML cached for: ${requestPath}`);
    } else {
      console.log(`⚠️  HTML NOT cached: ${finalDecision.reason}`);
    }

    // Record metrics
    metricsCollector.recordRequest({
      path: requestPath,
      userAgent,
      isBot: true,
      action: 'ssr',
      cacheStatus: 'MISS',
      rule: finalDecision.reason,
      cached: finalDecision.shouldCache,
    });

    // Send response
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('X-Rendered-By', 'SEO-Shield-Proxy');
    res.set('X-Cache-Status', 'MISS');
    res.set('X-Cache-Rule', finalDecision.reason);
    res.set('X-Cache-Allowed', finalDecision.shouldCache ? 'true' : 'false');
    res.send(html);
  } catch (error) {
    // If rendering fails, fallback to proxying
    console.error(`❌ SSR failed for ${requestPath}, falling back to proxy:`, error.message);

    // Record metrics
    metricsCollector.recordRequest({
      path: requestPath,
      userAgent,
      isBot: true,
      action: 'proxy',
      cacheStatus: null,
      error: error.message,
    });

    // Try to proxy the request as fallback
    try {
      return proxyMiddleware(req, res, next);
    } catch (proxyError) {
      console.error('❌ Fallback proxy also failed:', proxyError.message);

      // Record fatal error
      metricsCollector.recordRequest({
        path: requestPath,
        userAgent,
        isBot: true,
        action: 'error',
        cacheStatus: null,
        error: `${error.message} + ${proxyError.message}`,
      });

      res.status(500).send('Internal Server Error: Unable to render or proxy the page');
    }
  }
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  try {
    const stats = cache.getStats();
    const memoryUsage = process.memoryUsage();

    res.json({
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      memory: {
        heapUsed: Math.floor(memoryUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.floor(memoryUsage.heapTotal / 1024 / 1024), // MB
        rss: Math.floor(memoryUsage.rss / 1024 / 1024), // MB
        external: Math.floor(memoryUsage.external / 1024 / 1024), // MB
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
      error: error.message,
    });
  }
});

/**
 * Cache management endpoint - Clear cache
 */
app.post('/cache/clear', (req, res) => {
  try {
    const statsBefore = cache.getStats();
    cache.flush();
    const statsAfter = cache.getStats();

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
      error: error.message,
    });
  }
});

/**
 * Start the server
 */
const server = httpServer.listen(config.PORT, () => {
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

  // Initialize WebSocket after server starts
  initializeWebSocket(httpServer);
});

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

  // Force shutdown after 30 seconds
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
