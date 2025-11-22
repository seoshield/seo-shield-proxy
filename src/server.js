import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { isbot } from 'isbot';
import config from './config.js';
import cache from './cache.js';
import browserManager from './browser.js';
import CacheRules from './cache-rules.js';

const app = express();

// Initialize cache rules
const cacheRules = new CacheRules(config);

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
  const fullUrl = `${config.TARGET_URL}${req.url}`;

  // Log incoming request
  console.log(`📥 ${req.method} ${requestPath} - UA: ${userAgent.substring(0, 50)}...`);

  // 1. Check if it's a static asset - always proxy
  if (isStaticAsset(requestPath)) {
    console.log(`📦 Static asset detected: ${requestPath} - Proxying directly`);
    return proxyMiddleware(req, res, next);
  }

  // 2. Check if it's a bot
  const isBotRequest = isbot(userAgent);

  if (!isBotRequest) {
    // HUMAN USER - Proxy directly to the SPA
    console.log(`👤 Human user detected - Proxying to ${config.TARGET_URL}`);
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

    // Try to proxy the request as fallback
    try {
      return proxyMiddleware(req, res, next);
    } catch (proxyError) {
      console.error('❌ Fallback proxy also failed:', proxyError.message);
      res.status(500).send('Internal Server Error: Unable to render or proxy the page');
    }
  }
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  const stats = cache.getStats();
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    cache: {
      keys: stats.keys,
      hits: stats.hits,
      misses: stats.misses,
      hitRate: stats.hits / (stats.hits + stats.misses) || 0,
    },
    cacheRules: cacheRules.getRulesSummary(),
    config: {
      targetUrl: config.TARGET_URL,
      cacheTtl: config.CACHE_TTL,
      puppeteerTimeout: config.PUPPETEER_TIMEOUT,
    },
  });
});

/**
 * Cache management endpoint - Clear cache
 */
app.post('/cache/clear', (req, res) => {
  cache.flush();
  res.json({ status: 'ok', message: 'Cache cleared successfully' });
});

/**
 * Start the server
 */
const server = app.listen(config.PORT, () => {
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
  console.log('');
  console.log('Bot detection: ✅ Active');
  console.log('SSR rendering: ✅ Active');
  console.log('Reverse proxy: ✅ Active');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
});

/**
 * Graceful shutdown
 */
process.on('SIGTERM', async () => {
  console.log('⚠️  SIGTERM received, shutting down gracefully...');

  server.close(async () => {
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

  server.close(async () => {
    console.log('🔒 HTTP server closed');
    await browserManager.close();
    process.exit(0);
  });
});

export default app;
