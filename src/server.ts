/**
 * Ultra-Clean SEO Proxy Server - Port 8080
 * Pure proxy only - no admin routes, no API endpoints
 * All admin functions are handled by separate services:
 * - Port 3190: API server (/shieldapi/*)
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
import { Logger } from './utils/logger';

const logger = new Logger('ProxyServer');

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
      logger.debug('Traffic event stored in MongoDB');
    }

    // Also send to API server for real-time updates
    const response = await fetch(`http://localhost:${config.API_PORT}/shieldapi/traffic-events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(trafficData),
    });

    if (!response.ok) {
      logger.debug(`Failed to send traffic event: ${response.status}`);
    }
  } catch (error) {
    // Silently fail - API server might not be running
    logger.debug('Could not send traffic event to API server');
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

// Health check endpoint - MUST be before SSR middleware!
app.get('/shieldhealth', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'seo-shield-proxy',
    mode: 'proxy-only',
    port: config.PORT,
    target: config.TARGET_URL,
    timestamp: new Date().toISOString()
  });
});

// Static file extensions that should bypass SSR
const STATIC_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico', '.css', '.js', '.jsx',
  '.ts', '.tsx', '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.webm', '.mp3',
  '.wav', '.pdf', '.zip', '.txt', '.xml', '.json', '.rss', '.atom'
];

function isStaticAsset(path: string): boolean {
  // Don't treat API endpoints or root paths as static assets
  if (path.startsWith('/api') || path.startsWith('/shieldhealth') || path.startsWith('/assets') || path === '/' || path.endsWith('/')) {
    return false;
  }

  // Check for static file extensions
  return STATIC_EXTENSIONS.some(ext => path.includes(ext));
}

// SSR middleware with caching
app.use(async (req: Request, res: Response, next: NextFunction) => {
  const userAgent = req.headers['user-agent'] || '';
  const requestPath = req.path;
  const clientIP = req.ip || req.socket?.remoteAddress || 'unknown';

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

  logger.debug(`${req.method} ${requestPath} - Bot: ${isBotRequest} (${botDetection.botType}, ${(botDetection.confidence * 100).toFixed(0)}%)`);
  if (botDetector && botDetection.rulesMatched.length > 0) {
    logger.debug(`Rules matched: ${botDetection.rulesMatched.join(', ')}`);
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
  } catch (error) {
    logger.error('Failed to construct target URL:', error);
    return res.status(500).send('Internal server error');
  }

  // 2. Static assets - proxy directly
  if (isStaticAsset(requestPath)) {
    return next();
  }

  // 3a. Debug mode - return JSON with detailed metrics
  if (isRenderDebug) {
    logger.debug(`Debug mode: ${requestPath}`);
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
    logger.debug(`Bot SSR: ${requestPath}`);

    try {
      const cached = (await getCache()).get(fullUrl);

      if (cached && !isRenderPreview) {
        const cacheData = JSON.parse(cached as any);
        logger.debug(`Bot cache HIT: ${requestPath}`);
        res.status(200).send(cacheData.content);
        return;
      }

      logger.debug(`Bot SSR rendering: ${requestPath}`);
      const renderResult = await browserManager.render(fullUrl);

      if (renderResult && renderResult.html) {
        // Cache the rendered content for future bot requests
        (await getCache()).set(fullUrl, JSON.stringify({ content: renderResult.html, renderTime: Date.now() }));
        logger.debug(`Bot SSR cached: ${requestPath}`);
        res.status(renderResult.statusCode || 200).send(renderResult.html);
      } else {
        logger.warn(`Bot SSR failed, falling back to proxy: ${requestPath}`);
        return next();
      }
    } catch (error) {
      logger.error(`Bot rendering failed: ${requestPath}`, error);
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
          logger.debug(`Cache HIT: ${requestPath} (age: ${Math.round(cacheAge / 1000)}s)`);
          return res.status(200).send(cacheData.content);
        }

        // Stale cache - serve immediately, revalidate in background
        logger.debug(`Cache STALE: ${requestPath} - revalidating`);
        res.status(200).send(cacheData.content);

        // Background revalidation (fire and forget)
        setImmediate(async () => {
          try {
            const renderResult = await browserManager.render(fullUrl);

            if (renderResult && renderResult.html) {
              cacheInstance.set(fullUrl, JSON.stringify({
                content: renderResult.html,
                renderTime: Date.now(),
                statusCode: renderResult.statusCode || 200
              }));
              logger.debug(`Background revalidation completed: ${requestPath}`);
            }
          } catch (error) {
            logger.error(`Background revalidation failed: ${requestPath}`, error);
          }
        });

        return; // Response already sent
      } catch (parseError) {
        logger.warn(`Cache parse error for ${requestPath}, serving fresh`);
      }
    }
  }

  // 5. Humans - always use transparent proxy (no SSR, no cache)
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
    logger.debug(`Proxy: ${req.method} ${req.url}`);
  },
  onError: (err: any, req: any, res: any) => {
    logger.error(`Proxy error: ${err.message} for ${req.url}`);
    if (!res.headersSent) {
      res.status(502).send('Bad Gateway: Target server unavailable');
    }
  }
} as any);

// Apply proxy middleware
app.use(proxyMiddleware);

// 404 handler
app.use((req: Request, res: Response) => {
  logger.warn(`404: ${req.method} ${req.url}`);
  res.status(404).send('Not Found');
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error(`Server error: ${err.message}`, err.stack);
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: config.NODE_ENV === 'production' ? 'An error occurred' : err.message
  });
});

// Initialize database connection
async function initializeDatabase(): Promise<boolean> {
  try {
    const connected = await databaseManager.connect();
    if (connected) {
      logger.info('MongoDB connected for traffic logging');

      // Initialize advanced bot detector with database support
      const mongoStorage = databaseManager.getMongoStorage();
      if (mongoStorage) {
        botDetector = new AdvancedBotDetector(mongoStorage);
        logger.info('Advanced bot detector initialized');
      }
      return true;
    } else {
      logger.warn('MongoDB connection failed, using basic bot detection');
      return false;
    }
  } catch (error) {
    logger.error('Database initialization error:', error);
    return false;
  }
}

// Server startup logging
function logServerStart(dbConnected: boolean): void {
  const mode = dbConnected ? '' : ' (Database fallback mode)';
  logger.info('═══════════════════════════════════════════════════════════');
  logger.info('           SEO Shield Proxy Server                         ');
  logger.info('═══════════════════════════════════════════════════════════');
  logger.info(`Proxy server running on port ${config.PORT}${mode}`);
  logger.info(`Target URL: ${config.TARGET_URL}`);
  logger.info(`MongoDB: ${dbConnected ? 'Connected' : 'Disconnected'}`);
  logger.info('Features: Bot detection, SSR, Caching, Rate limiting');
}

// Start server
initializeDatabase().then((dbConnected) => {
  httpServer.listen(config.PORT, '0.0.0.0', () => {
    logServerStart(dbConnected);
  });
}).catch((error) => {
  logger.error('Failed to initialize database:', error);
  // Still start server even if database fails
  httpServer.listen(config.PORT, '0.0.0.0', () => {
    logServerStart(false);
  });
});

export default app;