/**
 * Ultra-Clean SEO Proxy Server - Port 8080
 * Pure proxy only - no admin routes, no API endpoints
 * All admin functions are handled by separate services:
 * - Port 8190: API server (/shieldapi/*)
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
import { databaseManager } from './database/database-manager';
import { AdvancedBotDetector } from './bot-detection/advanced-bot-detector';

// Traffic event sender to API server and database
async function sendTrafficEvent(trafficData: any) {
  try {
    // Store in MongoDB if available
    const mongoStorage = databaseManager.getMongoStorage();
    if (mongoStorage) {
      await mongoStorage.storeTrafficMetric({
        timestamp: trafficData.timestamp || new Date(),
        method: trafficData.method || 'GET',
        path: trafficData.path || '/',
        ip: trafficData.ip || 'unknown',
        userAgent: trafficData.userAgent || '',
        referer: trafficData.headers?.referer || '',
        isBot: trafficData.isBot || false,
        action: trafficData.action || 'proxy',
        responseTime: 0, // Not measured at this level
        statusCode: 200,
        responseSize: 0,
      });
      console.log('💾 Traffic event stored in MongoDB');
    }

    // Also send to API server for real-time updates
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

// Initialize advanced bot detector
let botDetector: AdvancedBotDetector | null = null;

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
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';

  // Use advanced bot detection if available, fallback to basic isbot()
  let botDetection;
  if (botDetector) {
    try {
      botDetection = await botDetector.detectBot({
        userAgent,
        ip: clientIP,
        headers: req.headers as Record<string, string>,
        referer: req.headers.referer,
        path: requestPath,
        method: req.method
      });
    } catch (error) {
      console.warn('⚠️  Advanced bot detection failed, falling back to basic:', error);
      botDetection = {
        isBot: isbot(userAgent),
        confidence: isbot(userAgent) ? 0.8 : 0.2,
        botType: isbot(userAgent) ? 'unknown' : 'human',
        rulesMatched: [],
        action: isbot(userAgent) ? 'render' : 'allow' as const
      };
    }
  } else {
    botDetection = {
      isBot: isbot(userAgent),
      confidence: isbot(userAgent) ? 0.7 : 0.3,
      botType: isbot(userAgent) ? 'unknown' : 'human',
      rulesMatched: [],
      action: isbot(userAgent) ? 'render' : 'allow' as const
    };
  }

  const isBotRequest = botDetection.isBot;

  // Support both ?render and ?_render query parameters
  const renderParam = (req.query.render || req.query._render) as string | undefined;
  const isRenderPreview = renderParam === 'preview' || renderParam === 'true';
  const isRenderDebug = renderParam === 'debug';

  console.log(`📥 ${req.method} ${requestPath} - UA: ${userAgent.length > 100 ? `${userAgent.substring(0, 97)}...` : userAgent}`);
  console.log(`🤌 Is Bot: ${isBotRequest} (${botDetection.botType}, confidence: ${(botDetection.confidence * 100).toFixed(1)}%)`);
  if (botDetector && botDetection.rulesMatched.length > 0) {
    console.log(`🎯 Rules matched: ${botDetection.rulesMatched.join(', ')}`);
  }

  // Send traffic event to API server for real-time monitoring
  sendTrafficEvent({
    method: req.method,
    path: requestPath,
    userAgent: userAgent,
    ip: clientIP,
    timestamp: Date.now(),
    isBot: isBotRequest,
    botType: botDetection.botType,
    botConfidence: botDetection.confidence,
    botRulesMatched: botDetection.rulesMatched,
    botAction: botDetection.action,
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

  // 3a. Debug mode - return JSON with detailed metrics
  if (isRenderDebug) {
    console.log(`🔍 Debug mode requested for: ${requestPath}`);
    const debugStartTime = Date.now();

    try {
      const cacheInstance = await getCache();
      const cached = cacheInstance.get(fullUrl);
      const cacheDecision = cacheRules.getCacheDecision(req.originalUrl);

      const renderResult = await browserManager.render(fullUrl);
      const debugDuration = Date.now() - debugStartTime;

      return res.json({
        success: true,
        debug: {
          url: fullUrl,
          path: requestPath,
          renderTime: `${debugDuration}ms`,
          htmlLength: renderResult.html?.length || 0,
          statusCode: renderResult.statusCode || 200,
          wasCached: !!cached,
          botDetection: {
            isBot: botDetection.isBot,
            botType: botDetection.botType,
            confidence: `${(botDetection.confidence * 100).toFixed(1)}%`,
            rulesMatched: botDetection.rulesMatched,
            action: botDetection.action
          },
          cacheDecision: cacheDecision,
          timestamp: new Date().toISOString()
        },
        html: renderResult.html
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        debug: {
          url: fullUrl,
          error: (error as Error).message,
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  // 3b. Bot requests and render previews - always SSR
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

  // 4. Human requests - check cache first (with Stale-While-Revalidate)
  if (!isBotRequest) {
    const cacheInstance = await getCache();
    const cachedEntry = cacheInstance.getWithTTL ? cacheInstance.getWithTTL(fullUrl) : null;
    const cached = cachedEntry?.value || cacheInstance.get(fullUrl);
    const isCacheable = cacheRules.shouldCacheUrl(req.originalUrl).shouldCache;

    if (cached && isCacheable) {
      try {
        const cacheData = JSON.parse(cached as string);
        const cacheAge = Date.now() - (cacheData.renderTime || 0);
        const cacheTTL = config.CACHE_TTL * 1000; // Convert to ms
        const staleThreshold = cacheTTL * 0.8; // Consider stale at 80% of TTL
        const isStale = cachedEntry?.isStale || cacheAge > staleThreshold;

        if (!isStale) {
          // Fresh cache - serve directly
          console.log(`🎯 Cache HIT (fresh): ${requestPath} - Age: ${Math.round(cacheAge / 1000)}s`);
          return res.status(200).send(cacheData.content);
        }

        // Stale cache - serve immediately, revalidate in background
        console.log(`🔄 Cache STALE: ${requestPath} - Age: ${Math.round(cacheAge / 1000)}s - Serving stale, revalidating...`);
        res.status(200).send(cacheData.content);

        // Background revalidation (fire and forget)
        setImmediate(async () => {
          try {
            console.log(`🔄 Background re-render starting: ${fullUrl}`);
            const renderResult = await browserManager.render(fullUrl);

            if (renderResult && renderResult.html) {
              cacheInstance.set(fullUrl, JSON.stringify({
                content: renderResult.html,
                renderTime: Date.now(),
                statusCode: renderResult.statusCode || 200
              }));
              console.log(`✅ Background re-render completed: ${requestPath}`);
            }
          } catch (error) {
            console.error(`❌ Background re-render failed: ${requestPath}`, error);
          }
        });

        return; // Response already sent
      } catch (parseError) {
        console.warn(`⚠️ Cache parse error for ${requestPath}, serving fresh`);
      }
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

// Initialize database connection
async function initializeDatabase() {
  try {
    const connected = await databaseManager.connect();
    if (connected) {
      console.log('✅ MongoDB connected for traffic logging');

      // Initialize advanced bot detector with database support
      const mongoStorage = databaseManager.getMongoStorage();
      if (mongoStorage) {
        botDetector = new AdvancedBotDetector(mongoStorage);
        console.log('✅ Advanced bot detector initialized with database support');
      }
    } else {
      console.warn('⚠️  MongoDB connection failed, traffic events will not be persisted');
      console.warn('⚠️  Advanced bot detector not initialized - using basic isbot()');
    }
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    console.warn('⚠️  Advanced bot detector not initialized due to database error - using basic isbot()');
  }
}

// Start server
initializeDatabase().then(() => {
  httpServer.listen(config.PORT, '0.0.0.0', () => {
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║               SEO Shield Proxy (Ultra-Clean)           ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`🚀 Ultra-clean proxy server running on port ${config.PORT}`);
    console.log(`🎯 Target URL: ${config.TARGET_URL}`);
    console.log(`💾 MongoDB: ${databaseManager.isDbConnected() ? 'Connected' : 'Disconnected'}`);
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
}).catch((error) => {
  console.error('❌ Failed to initialize database:', error);
  // Still start server even if database fails
  httpServer.listen(config.PORT, '0.0.0.0', () => {
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║               SEO Shield Proxy (Ultra-Clean)           ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`🚀 Ultra-clean proxy server running on port ${config.PORT} (Database fallback mode)`);
    console.log(`🎯 Target URL: ${config.TARGET_URL}`);
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
});

export default app;