/**
 * Ultra-Clean SEO Proxy Server - Port 8080
 * Pure proxy only - no admin routes, no API endpoints
 * All admin functions are handled by separate services:
 * - Port 8082: API server (/shieldapi/*)
 * - Port 3001: Admin dashboard
 */

import express, { Request, Response, NextFunction } from 'express';
import { createServer, Server as HttpServer } from 'http';
import { createProxyMiddleware, RequestHandler } from 'http-proxy-middleware';
import { isbot } from 'isbot';
import config from './config';
import cache, { getCache } from './cache';
import browserManager from './browser';
import CacheRules from './cache-rules';
import {
  generalRateLimiter,
  ssrRateLimiter
} from './middleware/rate-limiter';

// Traffic event sender to API server
async function sendTrafficEvent(trafficData: any) {
  try {
    console.log('📤 Sending traffic event to API server:', trafficData.path);
    const response = await fetch('http://localhost:8190/shieldapi/traffic-events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(trafficData),
    });

    if (!response.ok) {
      console.error('❌ Failed to send traffic event:', response.status);
    } else {
      console.log('✅ Traffic event sent successfully');
    }
  } catch (error) {
    // Silently fail - API server might not be running
    console.error('❌ Could not send traffic event to API server:', error);
  }
}

const app = express();
const httpServer: HttpServer = createServer(app);

// Apply general rate limiting
app.use(generalRateLimiter);

// Trust proxy for proper IP detection
app.set('trust proxy', 1);

// Initialize cache rules
const cacheRules = new CacheRules(config);

// Static file extensions that should bypass SSR
const STATIC_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico', '.css', '.js', '.jsx',
  '.ts', '.tsx', '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.webm', '.mp3',
  '.wav', '.pdf', '.zip', '.txt', '.xml', '.json', '.rss', '.atom'
];

function isStaticAsset(path: string): boolean {
  // Don't treat API endpoints or root paths as static assets
  if (path.startsWith('/api') || path.startsWith('/health') || path.startsWith('/assets') || path === '/' || path.endsWith('/')) {
    return false;
  }

  // Check for static file extensions
  return STATIC_EXTENSIONS.some(ext => path.includes(ext));
}

// SSR middleware with caching
app.use(async (req: Request, res: Response, next: NextFunction) => {
  const userAgent = req.headers['user-agent'] || '';
  const requestPath = req.path;
  const isBotRequest = isbot(userAgent);
  const isRenderPreview = req.query.render === 'preview' || req.query.render === 'true';

  console.log(`📥 ${req.method} ${requestPath} - UA: ${userAgent.length > 100 ? `${userAgent.substring(0, 97)}...` : userAgent}`);
  console.log(`🤌 Is Bot: ${isBotRequest}`);

  // Send traffic event to API server for real-time monitoring
  sendTrafficEvent({
    method: req.method,
    path: requestPath,
    userAgent: userAgent,
    ip: req.ip || req.connection.remoteAddress,
    timestamp: Date.now(),
    isBot: isBotRequest,
    headers: {
      'user-agent': userAgent,
      'referer': req.headers.referer,
      'accept': req.headers.accept
    }
  });

  // Skip SSR for static assets only
  if (requestPath.startsWith('/assets')) {
    return next();
  }

  let fullUrl: string;

  try {
    fullUrl = `${config.TARGET_URL}${req.originalUrl}`;
    console.log(`🎯 Proxying to: ${fullUrl}`);
  } catch (error) {
    console.error('❌ Failed to construct target URL:', error);
    return res.status(500).send('Internal server error');
  }

  // 2. Static assets - proxy directly
  if (isStaticAsset(requestPath)) {
    console.log(`📦 Static asset detected: ${requestPath} - Proxying directly`);
    // Proxy-only mode - no metrics collection
    return next();
  }

  // 3. Bot requests and render previews - always SSR
  if (isBotRequest || isRenderPreview) {
    console.log(`🤖 Bot detected or render preview - Forcing SSR: ${isBotRequest || isRenderPreview}`);
    // Proxy-only mode - no metrics collection

    try {
      const cached = (await getCache()).get(fullUrl);

      if (cached && !isRenderPreview) {
        const cacheData = JSON.parse(cached as any);
        console.log(`🎯 Bot served from cache: ${requestPath} (${cacheData.renderTime ? new Date(cacheData.renderTime).toISOString() : 'unknown'})`);
        res.status(200).send(cacheData.content);
        return;
      }

      console.log(`🔄 Bot SSR: ${fullUrl} (cache miss - rendering fresh)`);

      const renderResult = await browserManager.render(fullUrl);

      if (renderResult && renderResult.html) {
        // Cache the rendered content for future bot requests
        (await getCache()).set(fullUrl, JSON.stringify({ content: renderResult.html, renderTime: Date.now() }));
        console.log(`✅ Bot SSR rendered and cached: ${requestPath}`);
        res.status(renderResult.statusCode || 200).send(renderResult.html);
      } else {
        console.log(`⚠️ Bot SSR failed, falling back to proxy: ${requestPath}`);
        return next();
      }
    } catch (error) {
      console.error(`❌ Bot rendering failed: ${requestPath}`, error);
      return next();
    }

    return;
  }

  // 4. Human requests - check cache first
  if (!isBotRequest) {
    const isStaleCache = false; // Simplified for proxy-only mode
    const cached = (await getCache()).get(fullUrl);
    const isCacheable = cacheRules.shouldCacheUrl(req.originalUrl).shouldCache;

    if (cached && isCacheable && !isStaleCache) {
      console.log(`🎯 Cache HIT: ${requestPath} (${JSON.parse(cached as any).renderTime}ms render time)`);
      // Proxy-only mode - no metrics collection
      return res.status(200).send(JSON.parse(cached as any).content);
    }

    if (cached && isCacheable && isStaleCache) {
      console.log(`🔄 Cache STALE: ${requestPath} - Serving cached while re-rendering: ${JSON.parse(cached as any).renderTime}ms`);
      // Proxy-only mode - no metrics collection

      try {
        const browser = await browserManager.getBrowser();
        const page = await browser.newPage();

        console.log(`🔄 Re-rendering stale cache: ${fullUrl}`);
        const html = await page.evaluate(async (url: string, waitSelector: string) => {
          const start = Date.now();
          let attempts = 0;
          const maxAttempts = 30;

          while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));

            let ready = false;
            try {
              const scripts = Array.from(document.querySelectorAll('script'));
              for (const script of scripts) {
                if (!script.src && script.textContent) {
                  try {
                    const markers = ['__INITIAL_STATE__', '__NUXT__', '__REDUX__', 'window.__STATE__', 'window.data'];
                    for (const marker of markers) {
                      if (script.textContent.includes(marker)) {
                        ready = true;
                        break;
                      }
                    }
                    if (ready) break;
                  } catch (e) {
                    // Ignore script errors
                  }
                }
              }

              const content = document.querySelector(waitSelector) || document.querySelector('main') || document.querySelector('#app') || document.querySelector('.app') || document.body;
              const text = content ? content.textContent || '' : '';
              if (text.length > 100) ready = true;

              if (ready || Date.now() - start > 5000) break;
              attempts++;
            } catch (e) {
              console.warn('Warning: Error checking render readiness:', e);
              break;
            }
          }

          return document.documentElement.outerHTML;
        }, fullUrl, 'body');

        await page.close();

        if (html) {
          (await getCache()).set(fullUrl, JSON.stringify({ content: html, renderTime: Date.now() }));
          console.log(`✅ Stale cache re-rendered: ${requestPath}`);
        }
      } catch (error) {
        console.error(`❌ Stale cache re-render failed: ${requestPath}`, error);
      }

      return res.status(200).send(JSON.parse(cached as any).content);
    }
  }

  // 5. Humans - always use transparent proxy (no SSR, no cache)
  console.log(`👤 Human user - Using transparent proxy: ${requestPath}`);
  // Proxy-only mode - no metrics collection
  return next();
});

// Create proxy middleware
const proxyMiddleware = createProxyMiddleware({
  target: config.TARGET_URL,
  changeOrigin: true,
  followRedirects: true,
  timeout: 30000,
  onProxyReq: (proxyReq: any, req: any, res: any) => {
    console.log(`🔗 Proxying: ${req.method} ${req.url} -> ${config.TARGET_URL}${req.url}`);
  },
  onProxyInit: () => {
    console.log(`🚀 Proxy middleware initialized`);
  },
  onError: (err: any, req: any, res: any) => {
    console.error(`❌ Proxy error: ${err.message} for ${req.url}`);
    if (!res.headersSent) {
      res.status(502).send('Bad Gateway: Target server unavailable');
    }
  },
  onProxyRes: (proxyRes: any, req: any, res: any) => {
    console.log(`📤 Proxy response: ${req.method} ${req.url} -> ${proxyRes.statusCode}`);
  }
} as any);

// Health check endpoint - proxy middleware'den önce tanımlanmalı
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'seo-shield-proxy',
    mode: 'proxy-only',
    port: config.PORT,
    target: config.TARGET_URL,
    timestamp: new Date().toISOString()
  });
});

// Apply proxy middleware as the last handler
console.log('📌 About to apply proxy middleware...');
app.use((req, res, next) => {
  console.log('🔍 Final middleware - calling proxy for:', req.url);
  return next();
});
app.use(proxyMiddleware);

// 404 handler
app.use((req: Request, res: Response) => {
  console.log(`❌ 404: ${req.method} ${req.url} - No route handler found`);
  res.status(404).send('Not Found: No route handler found');
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(`💥 Server error: ${err.message}`, err.stack);
  res.status(500).send('Internal Server Error');
});

// Start server
httpServer.listen(config.PORT, '0.0.0.0', () => {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║               SEO Shield Proxy (Ultra-Clean)           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`🚀 Ultra-clean proxy server running on port ${config.PORT}`);
  console.log(`🎯 Target URL: ${config.TARGET_URL}`);
  console.log('');
  console.log('🎯 Ultra-clean architecture: Proxy, API, and Admin are completely separate');
  console.log(`  - API Server: http://localhost:8190/shieldapi/*`);
  console.log('');
  console.log('Bot detection: ✅ Active');
  console.log('SSR rendering: ✅ Active');
  console.log('Reverse proxy: ✅ Active');
  console.log('Caching: ✅ Active');
  console.log('Rate limiting: ✅ Active');
  console.log('');
});

export default app;