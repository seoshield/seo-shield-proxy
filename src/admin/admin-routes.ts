/**
 * Admin Dashboard API Routes
 * Provides REST API endpoints for React admin dashboard
 * Note: React admin dashboard runs on port 3001, this only provides APIs
 */

import express, { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import metricsCollector from './metrics-collector';
import configManager from './config-manager';
import cache from '../cache';
import browserManager from '../browser';
import cacheWarmer from './cache-warmer';
import snapshotService from './snapshot-service';
import hotfixEngine from './hotfix-engine';
import forensicsCollector from './forensics-collector';
import blockingManager from './blocking-manager';
import uaSimulator from './ua-simulator';
import { getSEOProtocolsService } from './seo-protocols-service';
import { broadcastTrafficEvent } from './websocket';
import { databaseManager } from '../database/database-manager';
import { ssrEventsStore } from './ssr-events-store';
import config from '../config';
import { Logger } from '../utils/logger';

const logger = new Logger('AdminRoutes');
const router: Router = express.Router();

// JWT Configuration - using centralized config
const JWT_SECRET = config.JWT_SECRET;
const JWT_EXPIRY = '24h';
const ADMIN_PASSWORD = config.ADMIN_PASSWORD;

/**
 * Timing-safe password comparison to prevent timing attacks
 */
function safePasswordCompare(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);
  // Ensure same length for timing safety
  if (providedBuf.length !== expectedBuf.length) {
    // Still do comparison to maintain constant time
    crypto.timingSafeEqual(expectedBuf, expectedBuf);
    return false;
  }
  return crypto.timingSafeEqual(providedBuf, expectedBuf);
}

/**
 * API: Login endpoint for form-based authentication
 */
router.post('/auth/login', express.json(), (req: Request, res: Response) => {
  try {
    const { password } = req.body;

    // Validate password is provided
    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Password is required'
      });
    }

    // Check password against config (timing-safe)
    if (!safePasswordCompare(password, ADMIN_PASSWORD)) {
      logger.warn('Login failed: Invalid password attempt');
      return res.status(401).json({
        success: false,
        error: 'Invalid password'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { role: 'admin', timestamp: Date.now() },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    logger.info('Login successful');
    return res.json({
      success: true,
      message: 'Login successful',
      token,
      expiresIn: JWT_EXPIRY
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      error: 'Login system error'
    });
  }
});

/**
 * API: Check authentication status
 * Supports both JWT Bearer tokens and Basic auth
 */
router.get('/auth/status', (req: Request, res: Response) => {
  try {
    const config = configManager.getConfig();
    const authHeader = req.headers.authorization;

    // Auth disabled in config
    if (config?.adminAuth?.enabled === false) {
      return res.json({
        success: true,
        authenticated: true,
        message: 'Authentication disabled'
      });
    }

    // No auth header
    if (!authHeader) {
      return res.json({
        success: true,
        authenticated: false,
        message: 'No authentication provided'
      });
    }

    // JWT Bearer token check
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        return res.json({
          success: true,
          authenticated: true,
          role: decoded.role || 'admin',
          message: 'Authenticated via JWT'
        });
      } catch (error) {
        const errorMessage = error instanceof jwt.TokenExpiredError
          ? 'Token expired'
          : 'Invalid token';
        return res.json({
          success: true,
          authenticated: false,
          message: errorMessage
        });
      }
    }

    // Basic auth check
    if (authHeader.startsWith('Basic ')) {
      try {
        const base64Credentials = authHeader.slice(6);
        const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
        const [username, password] = credentials.split(':', 2);

        // Check against config
        if (config?.adminAuth?.username && config?.adminAuth?.password) {
          if (username === config.adminAuth.username && password === config.adminAuth.password) {
            return res.json({
              success: true,
              authenticated: true,
              username: username,
              message: 'Authenticated via Basic auth'
            });
          }
        }

        // Check against ADMIN_PASSWORD
        if (password === ADMIN_PASSWORD) {
          return res.json({
            success: true,
            authenticated: true,
            username: username || 'admin',
            message: 'Authenticated via Basic auth'
          });
        }

        return res.json({
          success: true,
          authenticated: false,
          message: 'Invalid credentials'
        });
      } catch (decodeError) {
        return res.json({
          success: true,
          authenticated: false,
          message: 'Invalid authentication format'
        });
      }
    }

    return res.json({
      success: true,
      authenticated: false,
      message: 'Unsupported authentication method'
    });
  } catch (error) {
    console.error('Auth status error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication system error'
    });
  }
});

/**
 * Optional Authentication Middleware
 * Allows read-only access for localhost/development without auth
 * Still validates token if provided
 */
function optionalAuth(req: Request, res: Response, next: NextFunction): void | Response {
  const config = configManager.getConfig();

  // Check if auth is disabled in config
  if (config?.adminAuth?.enabled === false) {
    return next();
  }

  // Development mode - allow all requests without auth
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  // Allow localhost requests without auth (for dashboard)
  // Check multiple IP formats: IPv4, IPv6, and mapped addresses
  const ip = req.ip || req.socket?.remoteAddress || '';
  const localhostPatterns = [
    '127.0.0.1',
    '::1',
    '::ffff:127.0.0.1',
    'localhost',
    '0:0:0:0:0:0:0:1', // Full IPv6 localhost
  ];
  const isLocalhost = localhostPatterns.some(pattern => ip.includes(pattern));
  if (isLocalhost) {
    return next();
  }

  // If auth header provided, validate it (fall through to authenticate)
  const authHeader = req.headers.authorization;
  if (authHeader) {
    return authenticate(req, res, next);
  }

  // No auth in production from non-localhost - reject
  return res.status(401).json({
    success: false,
    error: 'Authentication required for non-localhost requests'
  });
}

/**
 * JWT Authentication Middleware
 * Validates Bearer token or allows bypass when auth is disabled
 */
function authenticate(req: Request, res: Response, next: NextFunction): void | Response {
  const config = configManager.getConfig();

  // Check if auth is disabled in config
  if (config?.adminAuth?.enabled === false) {
    return next();
  }

  const authHeader = req.headers.authorization;

  // No auth header provided
  if (!authHeader) {
    return res.status(401).json({
      success: false,
      error: 'No authorization header provided'
    });
  }

  // Bearer token authentication (JWT)
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      (req as any).user = decoded;
      return next();
    } catch (error) {
      const errorMessage = error instanceof jwt.TokenExpiredError
        ? 'Token expired'
        : 'Invalid token';
      return res.status(401).json({
        success: false,
        error: errorMessage
      });
    }
  }

  // Basic auth fallback for backward compatibility
  if (authHeader.startsWith('Basic ')) {
    try {
      const base64Credentials = authHeader.slice(6);
      const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
      const [username, password] = credentials.split(':', 2);

      if (config?.adminAuth?.username && config?.adminAuth?.password) {
        if (safePasswordCompare(username, config.adminAuth.username) &&
            safePasswordCompare(password, config.adminAuth.password)) {
          return next();
        }
      }

      // Fallback to ADMIN_PASSWORD check (timing-safe)
      if (safePasswordCompare(password, ADMIN_PASSWORD)) {
        return next();
      }
    } catch (decodeError) {
      // Invalid format, fall through to error
    }
  }

  return res.status(401).json({
    success: false,
    error: 'Invalid credentials'
  });
}

/**
 * API: Get statistics
 */
router.get('/stats', optionalAuth, (_req: Request, res: Response) => {
  const stats = metricsCollector.getStats();
  const botStats = metricsCollector.getBotStats();
  const cacheStats = cache.getStats();

  const queueMetrics = browserManager.getMetrics();

  res.json({
    success: true,
    data: {
      metrics: stats,
      bots: botStats,
      cache: cacheStats,
      queue: queueMetrics,
    },
  });
});

/**
 * API: Get recent traffic
 */
router.get('/traffic', optionalAuth, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query['limit'] as string) || 100;
    const mongoStorage = databaseManager.getMongoStorage();

    if (mongoStorage) {
      // Get traffic from MongoDB
      const trafficData = await mongoStorage.getTrafficMetrics(limit, {
        sortBy: 'timestamp',
        sortOrder: -1
      });

      res.json({
        success: true,
        data: trafficData.map(metric => ({
          timestamp: metric.timestamp,
          path: metric.path,
          method: metric.method,
          ip: metric.ip,
          userAgent: metric.userAgent,
          referer: metric.referer,
          isBot: metric.isBot,
          statusCode: metric.statusCode,
          responseTime: metric.responseTime,
          responseSize: metric.responseSize,
        })),
      });
    } else {
      // Fallback to in-memory metrics collector
      const traffic = metricsCollector.getRecentTraffic(limit);
      res.json({
        success: true,
        data: traffic,
      });
    }
  } catch (error) {
    console.error('Traffic API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch traffic data'
    });
  }
});

/**
 * API: Get traffic timeline
 */
router.get('/timeline', optionalAuth, (req: Request, res: Response) => {
  const minutes = parseInt(req.query['minutes'] as string) || 60;
  const timeline = metricsCollector.getTrafficTimeline(minutes);

  res.json({
    success: true,
    data: timeline,
  });
});

/**
 * API: Get URL statistics
 */
router.get('/urls', optionalAuth, (req: Request, res: Response) => {
  const limit = parseInt(req.query['limit'] as string) || 50;
  const urlStats = metricsCollector.getUrlStats(limit);

  res.json({
    success: true,
    data: urlStats,
  });
});

/**
 * API: Get cache list
 */
router.get('/cache', optionalAuth, (_req: Request, res: Response) => {
  const cacheData = cache.getAllEntries();

  res.json({
    success: true,
    data: cacheData,
  });
});

/**
 * API: Get advanced cache analytics
 */
router.get('/cache/analytics', optionalAuth, (_req: Request, res: Response) => {
  try {
    const cacheData = cache.getAllEntries();
    const cacheStats = cache.getStats();

    // Calculate analytics with real data from cache entries
    const entries = cacheData.map((entry) => {
      const now = Date.now();
      const remaining = Math.max(0, entry.ttl);

      // Try to parse metadata from cached content
      let metadata = {
        renderTime: 0,
        statusCode: 200,
        timestamp: now - (entry.ttl > 0 ? entry.ttl : 3600000)
      };

      try {
        // Cache stores JSON with { content, renderTime, statusCode }
        const cachedValue = cache.get(entry.url);
        if (cachedValue) {
          const parsed = JSON.parse(cachedValue);
          metadata.renderTime = parsed.renderTime || 0;
          metadata.statusCode = parsed.statusCode || 200;
          // renderTime field stores the timestamp when it was cached
          if (parsed.renderTime && parsed.renderTime > 1000000000000) {
            metadata.timestamp = parsed.renderTime;
          }
        }
      } catch (e) {
        // Parsing failed, use defaults
      }

      const cacheAge = now - metadata.timestamp;

      return {
        url: entry.url,
        timestamp: metadata.timestamp,
        size: entry.size,
        ttl: entry.ttl,
        cacheAge: Math.round(cacheAge / 1000), // seconds
        renderTime: metadata.renderTime > 1000000000000 ? 0 : metadata.renderTime, // If it's a timestamp, show 0
        statusCode: metadata.statusCode,
        userAgent: 'SEO Shield Proxy',
        cacheKey: entry.url,
        isStale: remaining <= 0,
        cacheStatus: remaining > 0 ? 'HIT' : 'STALE'
      };
    }).sort((a, b) => b.timestamp - a.timestamp);

    const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
    const avgSize = entries.length > 0 ? totalSize / entries.length : 0;
    const avgTtl = entries.length > 0 ? entries.reduce((sum, entry) => sum + entry.ttl, 0) / entries.length : 0;

    const staleCount = entries.filter(entry => entry.isStale).length;
    const freshCount = entries.length - staleCount;

    const hitRate = cacheStats.hits + cacheStats.misses > 0
      ? (cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100
      : 0;

    const stats = {
      totalEntries: entries.length,
      totalSize,
      hitRate,
      missRate: 100 - hitRate,
      totalHits: cacheStats.hits,
      totalMisses: cacheStats.misses,
      avgTtl,
      avgSize,
      oldestEntry: entries.length > 0 ? Date.now() - Math.min(...entries.map(e => e.timestamp)) : 0,
      newestEntry: entries.length > 0 ? Date.now() - Math.max(...entries.map(e => e.timestamp)) : 0,
      staleCount,
      freshCount,
      entriesBySize: entries.reduce((acc, entry) => {
        const sizeRange = entry.size < 1024 ? '<1KB' : entry.size < 10240 ? '<10KB' : entry.size < 102400 ? '<100KB' : '>100KB';
        const existing = acc.find(item => item.size === sizeRange) || { size: sizeRange, count: 0 };
        existing.count++;
        if (!acc.find(item => item.size === sizeRange)) acc.push(existing);
        return acc;
      }, [] as Array<{ size: string; count: number }>),
      entriesByTtl: entries.reduce((acc, entry) => {
        const ttlRange = entry.ttl < 300000 ? '<5m' : entry.ttl < 1800000 ? '<30m' : entry.ttl < 3600000 ? '<1h' : '>1h';
        const existing = acc.find(item => item.ttl === ttlRange) || { ttl: ttlRange, count: 0 };
        existing.count++;
        if (!acc.find(item => item.ttl === ttlRange)) acc.push(existing);
        return acc;
      }, [] as Array<{ ttl: string; count: number }>)
    };

    res.json({
      success: true,
      entries,
      stats,
    });
  } catch (error) {
    console.error('Cache analytics error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * API: Clear specific cache entry by key
 */
router.delete('/cache/entry', authenticate, express.json(), (req: Request, res: Response) => {
  try {
    const { cacheKey } = req.body;
    if (!cacheKey) {
      return res.status(400).json({
        success: false,
        error: 'Cache key is required',
      });
    }

    const deleted = cache.delete(cacheKey);
    res.json({
      success: true,
      message: deleted ? 'Cache entry deleted' : 'Cache entry not found',
      deleted,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * API: Refresh cache entry
 */
router.post('/cache/refresh', authenticate, express.json(), (req: Request, res: Response) => {
  try {
    const { cacheKey } = req.body;
    if (!cacheKey) {
      return res.status(400).json({
        success: false,
        error: 'Cache key is required',
      });
    }

    // Delete existing entry to force refresh on next request
    const deleted = cache.delete(cacheKey);
    res.json({
      success: true,
      message: deleted ? 'Cache entry refreshed - will be re-cached on next request' : 'Cache entry not found',
      deleted,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * API: Clear cache
 */
router.post('/cache/clear', authenticate, express.json(), (req: Request, res: Response) => {
  const { url } = req.body;

  if (url) {
    const deleted = cache.delete(url);
    res.json({
      success: true,
      message: deleted ? 'Cache entry deleted' : 'Cache entry not found',
      deleted,
    });
  } else {
    cache.flush();
    res.json({
      success: true,
      message: 'All cache cleared',
    });
  }
});

/**
 * API: Delete specific cache entry
 */
router.delete('/cache/:key', authenticate, (req: Request, res: Response) => {
  const { key } = req.params;

  try {
    const deleted = cache.delete(key);
    res.json({
      success: true,
      message: deleted ? 'Cache entry deleted' : 'Cache entry not found',
      deleted,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * API: Get configuration
 */
router.get('/config', async (req: Request, res: Response) => {
  try {
    const mongoStorage = databaseManager.getMongoStorage();

    if (mongoStorage) {
      // Try to get config from MongoDB first
      try {
        const mongoConfig = await mongoStorage.getConfig('runtime_config');
        if (mongoConfig) {
          return res.json({
            success: true,
            data: mongoConfig,
            source: 'database'
          });
        }
      } catch (dbError) {
        console.warn('Failed to load config from database, using file config:', dbError);
      }
    }

    // Fallback to file-based config
    const config = configManager.getConfig();
    res.json({
      success: true,
      data: config,
      source: 'file'
    });
  } catch (error) {
    console.error('Config GET error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get configuration'
    });
  }
});

/**
 * API: Update configuration
 */
router.post('/config', authenticate, express.json(), async (req: Request, res: Response) => {
  try {
    const updates = req.body;
    const mongoStorage = databaseManager.getMongoStorage();

    if (mongoStorage) {
      // Store in MongoDB with versioning
      try {
        const configId = await mongoStorage.saveConfig(updates, 'Admin panel update', 'admin');

        // Also try to update file config for backwards compatibility
        try {
          await configManager.updateConfig(updates);
        } catch (fileError) {
          console.warn('Failed to update file config, but database update succeeded:', fileError);
        }

        return res.json({
          success: true,
          message: 'Configuration updated and saved to database',
          configId,
          data: updates,
        });
      } catch (dbError) {
        console.warn('Failed to save config to database, falling back to file config:', dbError);
      }
    }

    // Fallback to file-based config
    const newConfig = await configManager.updateConfig(updates);
    res.json({
      success: true,
      message: 'Configuration updated (file only)',
      data: newConfig,
    });
  } catch (error) {
    console.error('Config POST error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * API: Add cache pattern
 */
router.post(
  '/config/cache-pattern',
  authenticate,
  express.json(),
  async (req: Request, res: Response) => {
    try {
      const { pattern, type } = req.body;

      if (!pattern) {
        return res.status(400).json({
          success: false,
          error: 'Pattern is required',
        });
      }

      const config = await configManager.addCachePattern(pattern, type as 'noCache' | 'cache');

      return res.json({
        success: true,
        message: 'Cache pattern added',
        data: config,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }
);

/**
 * API: Remove cache pattern
 */
router.delete(
  '/config/cache-pattern',
  authenticate,
  express.json(),
  async (req: Request, res: Response) => {
    try {
      const { pattern, type } = req.body;

      if (!pattern) {
        return res.status(400).json({
          success: false,
          error: 'Pattern is required',
        });
      }

      const config = await configManager.removeCachePattern(pattern, type as 'noCache' | 'cache');

      return res.json({
        success: true,
        message: 'Cache pattern removed',
        data: config,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }
);

/**
 * API: Manage bot rules
 */
router.post('/config/bot', authenticate, express.json(), async (req: Request, res: Response) => {
  try {
    const { botName, action } = req.body;

    if (!botName || !action) {
      return res.status(400).json({
        success: false,
        error: 'Bot name and action are required',
      });
    }

    let config;

    switch (action) {
      case 'allow':
        config = await configManager.addAllowedBot(botName);
        break;
      case 'block':
        config = await configManager.addBlockedBot(botName);
        break;
      case 'remove':
        config = await configManager.removeBot(botName);
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid action',
        });
    }

    return res.json({
      success: true,
      message: `Bot ${botName} ${action}ed`,
      data: config,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * API: Reset configuration to defaults
 */
router.post('/config/reset', authenticate, async (_req: Request, res: Response) => {
  try {
    const config = await configManager.resetToDefaults();

    res.json({
      success: true,
      message: 'Configuration reset to defaults',
      data: config,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * API: Reset metrics
 */
router.post('/metrics/reset', authenticate, (_req: Request, res: Response) => {
  metricsCollector.reset();

  res.json({
    success: true,
    message: 'Metrics reset',
  });
});

/**
 * API: Real-time updates (Server-Sent Events) - Public endpoint for EventSource
 */
router.options('/stream', (_req: Request, res: Response) => {
  // Handle CORS preflight for SSE endpoint
  const origin = _req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cache-Control, Last-Event-ID');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.sendStatus(204);
});

router.get('/stream', (req: Request, res: Response) => {
  // CORS headers for SSE - use specific origin if provided, fallback to *
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cache-Control, Last-Event-ID');

  // SSE-specific headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Send initial connection event
  res.write(`data: ${JSON.stringify({
    type: 'connection',
    status: 'connected',
    timestamp: Date.now(),
    message: 'Real-time stream connected'
  })}\n\n`);

  // Send stats every 2 seconds
  const interval = setInterval(() => {
    const stats = metricsCollector.getStats();
    const cacheStats = cache.getStats();

    const data = {
      type: 'metrics',
      metrics: stats,
      cache: cacheStats,
      timestamp: Date.now(),
    };

    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }, 2000);

  // Clean up on close
  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
});

/**
 * API: Authenticated stream endpoint (for future use)
 */
router.options('/stream/auth', (_req: Request, res: Response) => {
  // Handle CORS preflight for authenticated SSE endpoint
  const origin = _req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cache-Control, Last-Event-ID, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.sendStatus(204);
});

router.get('/stream/auth', authenticate, (req: Request, res: Response) => {
  // CORS headers for SSE
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cache-Control, Last-Event-ID, Authorization');

  // SSE-specific headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Send stats every 2 seconds with additional authenticated data
  const interval = setInterval(() => {
    const stats = metricsCollector.getStats();
    const cacheStats = cache.getStats();

    const data = {
      type: 'authenticated_metrics',
      metrics: stats,
      cache: cacheStats,
      timestamp: Date.now(),
      user: (req as any).user || 'admin',
    };

    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }, 2000);

  // Clean up on close
  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
});

/**
 * API: Get cache warmer stats
 */
router.get('/warmer/stats', optionalAuth, (_req: Request, res: Response) => {
  const stats = cacheWarmer.getStats();
  const estimatedTime = cacheWarmer.getEstimatedTime();

  res.json({
    success: true,
    data: {
      ...stats,
      estimatedTime,
    },
  });
});

/**
 * API: Add URLs to cache warmer
 */
router.post('/warmer/add', authenticate, express.json(), async (req: Request, res: Response) => {
  try {
    const { urls, priority = 'normal' } = req.body;

    if (!Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'URLs array is required',
      });
    }

    const added = await cacheWarmer.addUrls(urls, priority);

    res.json({
      success: true,
      message: `Added ${added} URLs to warm queue`,
      data: { added },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * API: Parse and add sitemap URLs
 */
router.post('/warmer/sitemap', authenticate, express.json(), async (req: Request, res: Response) => {
  try {
    const { sitemapUrl, priority = 'normal' } = req.body;

    if (!sitemapUrl) {
      return res.status(400).json({
        success: false,
        error: 'Sitemap URL is required',
      });
    }

    // Parse sitemap
    const urls = await cacheWarmer.parseSitemap(sitemapUrl);

    if (urls.length === 0) {
      return res.json({
        success: true,
        message: 'No URLs found in sitemap',
        data: { urls: [], added: 0 },
      });
    }

    // Add URLs to warmer
    const added = await cacheWarmer.addUrls(urls, priority);

    res.json({
      success: true,
      message: `Parsed ${urls.length} URLs from sitemap and added ${added} to warm queue`,
      data: { urls, added, total: urls.length },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * API: Clear cache warmer queue
 */
router.post('/warmer/clear', authenticate, (_req: Request, res: Response) => {
  cacheWarmer.clearQueue();

  res.json({
    success: true,
    message: 'Cache warmer queue cleared',
  });
});

/**
 * API: Warm specific URL immediately
 */
router.post('/warmer/warm', authenticate, express.json(), async (req: Request, res: Response) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required',
      });
    }

    const result = await cacheWarmer.addUrls([url], 'high');

    res.json({
      success: true,
      message: result.added > 0 ? `URL added to high priority warm queue` : `URL is already cached or in queue`,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * API: Capture snapshot
 */
router.post('/snapshots/capture', authenticate, express.json(), async (req: Request, res: Response) => {
  try {
    const { url, options = {} } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required',
      });
    }

    const snapshot = await snapshotService.captureSnapshot(url, options);

    res.json({
      success: true,
      data: snapshot,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * API: Get snapshot by ID
 */
router.get('/snapshots/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const snapshot = await snapshotService.getSnapshot(id);

    if (!snapshot) {
      return res.status(404).json({
        success: false,
        error: 'Snapshot not found',
      });
    }

    res.json({
      success: true,
      data: snapshot,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * API: Get all snapshots with pagination
 */
router.get('/snapshots', optionalAuth, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query['page'] as string) || 1;
    const limit = parseInt(req.query['limit'] as string) || 20;

    const result = await snapshotService.getAllSnapshots(page, limit);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * API: Get snapshot history for URL
 */
router.get('/snapshots/history/:url', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { url } = req.params;
    const limit = parseInt(req.query['limit'] as string) || 10;

    const history = await snapshotService.getSnapshotHistory(decodeURIComponent(url), limit);

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * API: Compare snapshots
 */
router.post('/snapshots/compare', authenticate, express.json(), async (req: Request, res: Response) => {
  try {
    const { beforeId, afterId } = req.body;

    if (!beforeId || !afterId) {
      return res.status(400).json({
        success: false,
        error: 'Both beforeId and afterId are required',
      });
    }

    const diff = await snapshotService.compareSnapshots(beforeId, afterId);

    res.json({
      success: true,
      data: diff,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * API: Get diff result by ID
 */
router.get('/snapshots/diff/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const diff = await snapshotService.getDiff(id);

    if (!diff) {
      return res.status(404).json({
        success: false,
        error: 'Diff not found',
      });
    }

    res.json({
      success: true,
      data: diff,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * API: Delete snapshot
 */
router.delete('/snapshots/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await snapshotService.deleteSnapshot(id);

    res.json({
      success: true,
      message: deleted ? 'Snapshot deleted' : 'Snapshot not found',
      deleted,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * API: Get hotfix rules
 */
router.get('/hotfix/rules', optionalAuth, (_req: Request, res: Response) => {
  try {
    const rules = hotfixEngine.getRules();

    res.json({
      success: true,
      data: rules,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * API: Get hotfix stats
 */
router.get('/hotfix/stats', optionalAuth, (_req: Request, res: Response) => {
  try {
    const stats = hotfixEngine.getStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * API: Create hotfix rule
 */
router.post('/hotfix/rules', authenticate, express.json(), async (req: Request, res: Response) => {
  try {
    const ruleData = req.body;

    // Basic validation
    if (!ruleData.name || !ruleData.urlPattern) {
      return res.status(400).json({
        success: false,
        error: 'Name and URL pattern are required',
      });
    }

    const rule = await hotfixEngine.createRule(ruleData);

    res.json({
      success: true,
      message: 'Hotfix rule created',
      data: rule,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * API: Update hotfix rule
 */
router.put('/hotfix/rules/:id', authenticate, express.json(), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const rule = await hotfixEngine.updateRule(id, updates);

    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Hotfix rule not found',
      });
    }

    res.json({
      success: true,
      message: 'Hotfix rule updated',
      data: rule,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * API: Delete hotfix rule
 */
router.delete('/hotfix/rules/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await hotfixEngine.deleteRule(id);

    res.json({
      success: true,
      message: deleted ? 'Hotfix rule deleted' : 'Hotfix rule not found',
      deleted,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * API: Toggle hotfix rule
 */
router.post('/hotfix/rules/:id/toggle', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const toggled = await hotfixEngine.toggleRule(id);

    if (!toggled) {
      return res.status(404).json({
        success: false,
        error: 'Hotfix rule not found',
      });
    }

    res.json({
      success: true,
      message: 'Hotfix rule toggled',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * API: Test hotfix on URL
 */
router.post('/hotfix/test', authenticate, express.json(), async (req: Request, res: Response) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required',
      });
    }

    const testResult = await hotfixEngine.testHotfix(url);

    res.json({
      success: true,
      data: testResult,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * API: Get hotfix test history
 */
router.get('/hotfix/tests', optionalAuth, (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query['limit'] as string) || 20;
    const history = hotfixEngine.getTestHistory(limit);

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * API: Get forensics stats
 */
router.get('/forensics/stats', optionalAuth, async (_req: Request, res: Response) => {
  try {
    const stats = await forensicsCollector.getStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * API: Get forensics errors
 */
router.get('/forensics/errors', optionalAuth, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query['page'] as string) || 1;
    const limit = parseInt(req.query['limit'] as string) || 50;

    const result = await forensicsCollector.getErrors(page, limit);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * API: Get specific error
 */
router.get('/forensics/errors/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const error = await forensicsCollector.getError(id);

    if (!error) {
      return res.status(404).json({
        success: false,
        error: 'Error not found',
      });
    }

    res.json({
      success: true,
      data: error,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * API: Get errors by URL
 */
router.get('/forensics/errors/by-url/:url', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { url } = req.params;
    const limit = parseInt(req.query['limit'] as string) || 20;

    const errors = await forensicsCollector.getErrorsByUrl(decodeURIComponent(url), limit);

    res.json({
      success: true,
      data: errors,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * API: Delete error
 */
router.delete('/forensics/errors/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await forensicsCollector.deleteError(id);

    res.json({
      success: true,
      message: deleted ? 'Error deleted' : 'Error not found',
      deleted,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * API: Clear old errors
 */
router.post('/forensics/cleanup', authenticate, express.json(), async (req: Request, res: Response) => {
  try {
    const { daysToKeep = 30 } = req.body;
    const deleted = await forensicsCollector.clearOldErrors(daysToKeep);

    res.json({
      success: true,
      message: `Cleared ${deleted} old errors`,
      data: { deleted },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * API: Get blocking rules
 */
router.get('/blocking/rules', optionalAuth, (_req: Request, res: Response) => {
  try {
    const rules = blockingManager.getRules();

    res.json({
      success: true,
      data: rules,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * API: Get blocking stats
 */
router.get('/blocking/stats', optionalAuth, (_req: Request, res: Response) => {
  try {
    const stats = blockingManager.getStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * API: Create blocking rule
 */
router.post('/blocking/rules', authenticate, express.json(), async (req: Request, res: Response) => {
  try {
    const ruleData = req.body;

    // Basic validation
    if (!ruleData.name || !ruleData.pattern) {
      return res.status(400).json({
        success: false,
        error: 'Name and pattern are required',
      });
    }

    const rule = await blockingManager.createRule(ruleData);

    res.json({
      success: true,
      message: 'Blocking rule created',
      data: rule,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * API: Test blocking rule
 */
router.post('/blocking/test', authenticate, express.json(), async (req: Request, res: Response) => {
  try {
    const { url, userAgent, headers } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required',
      });
    }

    const result = await blockingManager.testBlocking(url, userAgent, headers);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * API: Update blocking rule
 */
router.put('/blocking/rules/:id', authenticate, express.json(), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const rule = await blockingManager.updateRule(id, updates);

    res.json({
      success: true,
      data: rule,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * API: Delete blocking rule
 */
router.delete('/blocking/rules/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const deleted = await blockingManager.deleteRule(id);

    res.json({
      success: true,
      data: { deleted },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * API: Toggle blocking rule
 */
router.post('/blocking/rules/:id/toggle', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const toggled = await blockingManager.toggleRule(id);

    res.json({
      success: true,
      data: { toggled },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * API: Get blocking rule by ID
 */
router.get('/blocking/rules/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const rule = blockingManager.getRule(id);

    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Blocking rule not found',
      });
    }

    res.json({
      success: true,
      data: rule,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * API: Get user agent templates
 */
router.get('/simulate/user-agents', optionalAuth, (_req: Request, res: Response) => {
  try {
    const userAgents = uaSimulator.getUserAgents();

    res.json({
      success: true,
      data: userAgents,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * API: Start simulation
 */
router.post('/simulate/start', authenticate, express.json(), async (req: Request, res: Response) => {
  try {
    const { url, userAgentId, options = {} } = req.body;

    if (!url || !userAgentId) {
      return res.status(400).json({
        success: false,
        error: 'URL and user agent ID are required',
      });
    }

    const userAgentTemplate = uaSimulator.getUserAgent(userAgentId);
    if (!userAgentTemplate) {
      return res.status(404).json({
        success: false,
        error: 'User agent not found',
      });
    }

    const simulation = await uaSimulator.startSimulation(url, userAgentTemplate, options);

    res.json({
      success: true,
      message: 'Simulation started',
      data: simulation,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * API: Get simulation history
 */
router.get('/simulate/history', optionalAuth, (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query['limit'] as string) || 20;
    const history = uaSimulator.getSimulationHistory(limit);

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * API: Get active simulations
 */
router.get('/simulate/active', optionalAuth, (_req: Request, res: Response) => {
  try {
    const active = uaSimulator.getActiveSimulations();

    res.json({
      success: true,
      data: active,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * API: Get simulation stats
 */
router.get('/simulate/stats', optionalAuth, (_req: Request, res: Response) => {
  try {
    const stats = uaSimulator.getStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * API: Compare simulations
 */
router.post('/simulate/compare', authenticate, express.json(), async (req: Request, res: Response) => {
  try {
    const { simulationId1, simulationId2 } = req.body;

    if (!simulationId1 || !simulationId2) {
      return res.status(400).json({
        success: false,
        error: 'Both simulation IDs are required',
      });
    }

    const sim1 = uaSimulator.getSimulation(simulationId1);
    const sim2 = uaSimulator.getSimulation(simulationId2);

    if (!sim1 || !sim2) {
      return res.status(404).json({
        success: false,
        error: 'One or both simulations not found',
      });
    }

    if (sim1.status !== 'completed' || sim2.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Both simulations must be completed to compare',
      });
    }

    const comparison = await uaSimulator.compareSimulations(sim1, sim2);

    res.json({
      success: true,
      data: comparison,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * API: Get simulation by ID
 * NOTE: This route must come AFTER specific routes (history, active, stats, compare)
 * because :id would match those paths otherwise
 */
router.get('/simulate/:id', optionalAuth, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const simulation = uaSimulator.getSimulation(id);

    if (!simulation) {
      return res.status(404).json({
        success: false,
        error: 'Simulation not found',
      });
    }

    res.json({
      success: true,
      data: simulation,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * API: Cancel simulation
 */
router.post('/simulate/:id/cancel', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const cancelled = await uaSimulator.cancelSimulation(id);

    res.json({
      success: true,
      message: cancelled ? 'Simulation cancelled' : 'Simulation not found or not active',
      cancelled,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * API: Get SSR events (real data from SSR Events Store)
 */
router.get('/ssr/events', optionalAuth, (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query['limit'] as string) || 50;
    const events = ssrEventsStore.getRecentEvents(limit);
    const stats = ssrEventsStore.getStats();

    res.json({
      success: true,
      events,
      stats,
    });
  } catch (error) {
    console.error('SSR events error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * API: Get SEO protocols status
 */
router.get('/seo-protocols/status', optionalAuth, async (_req: Request, res: Response) => {
  try {
    const service = getSEOProtocolsService();
    const status = await service.getStatus();
    const metrics = await service.getMetrics();

    res.json({
      success: true,
      protocols: status.protocols,
      globalStats: metrics,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * API: Toggle SEO protocol
 */
router.post('/seo-protocols/:protocolName/toggle', authenticate, async (req: Request, res: Response) => {
  try {
    const { protocolName } = req.params;
    const service = getSEOProtocolsService();
    const currentConfig = service.getConfig();

    // Map protocol names to config keys
    const protocolMap: Record<string, string> = {
      'contentHealthCheck': 'contentHealthCheck',
      'virtualScroll': 'virtualScroll',
      'etagStrategy': 'etagStrategy',
      'clusterMode': 'clusterMode',
      'shadowDom': 'shadowDom',
      'circuitBreaker': 'circuitBreaker'
    };

    const configKey = protocolMap[protocolName];
    if (!configKey) {
      return res.status(404).json({
        success: false,
        error: `Protocol '${protocolName}' not found`,
      });
    }

    // Toggle the enabled state
    const protocolConfig = (currentConfig as any)[configKey];
    if (protocolConfig) {
      protocolConfig.enabled = !protocolConfig.enabled;
      service.updateConfig({ [configKey]: protocolConfig } as any);
    }

    res.json({
      success: true,
      message: `Protocol '${protocolName}' toggled`,
      enabled: protocolConfig?.enabled,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * API: Run SEO protocol
 */
router.post('/seo-protocols/:protocolName/run', authenticate, async (req: Request, res: Response) => {
  try {
    const { protocolName } = req.params;
    const service = getSEOProtocolsService();

    // Get the appropriate manager based on protocol name
    let result: any = null;

    switch (protocolName) {
      case 'contentHealthCheck':
        const healthCheck = service.getContentHealthCheck();
        if (healthCheck) {
          result = { status: 'active', message: 'Content Health Check is running' };
        }
        break;
      case 'virtualScroll':
        const virtualScroll = service.getVirtualScrollManager();
        if (virtualScroll) {
          result = { status: 'active', message: 'Virtual Scroll Manager is running' };
        }
        break;
      case 'etagStrategy':
        const etag = service.getETagService();
        if (etag) {
          result = { status: 'active', stats: etag.getCacheStats() };
        }
        break;
      case 'clusterMode':
        const cluster = service.getClusterManager();
        if (cluster) {
          result = { status: 'active', stats: await cluster.getStats() };
        }
        break;
      case 'shadowDom':
        const shadowDom = service.getShadowDOMExtractor();
        if (shadowDom) {
          result = { status: 'active', message: 'Shadow DOM Extractor is running' };
        }
        break;
      case 'circuitBreaker':
        const circuitBreaker = service.getCircuitBreakerManager();
        if (circuitBreaker) {
          result = { status: 'active', health: circuitBreaker.getOverallHealth() };
        }
        break;
      default:
        return res.status(404).json({
          success: false,
          error: `Protocol '${protocolName}' not found`,
        });
    }

    if (!result) {
      return res.json({
        success: true,
        message: `Protocol '${protocolName}' is not enabled or not initialized`,
        result: null,
      });
    }

    res.json({
      success: true,
      message: `Protocol '${protocolName}' executed`,
      result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * API: Receive traffic events from proxy server
 */
router.post('/traffic-events', express.json(), (req: Request, res: Response) => {
  try {
    const trafficData = req.body;

    // Store the traffic data in metrics collector
    if (trafficData && trafficData.path && trafficData.userAgent) {
      const requestData = {
        path: trafficData.path || '/',
        userAgent: trafficData.userAgent || '',
        isBot: trafficData.isBot || false,
        action: trafficData.action || 'proxy',
        cacheStatus: trafficData.cacheStatus || null,
        rule: trafficData.rule,
        cached: trafficData.cached,
        error: trafficData.error
      };

      metricsCollector.recordRequest(requestData);
    }

    // Broadcast to all connected admin clients
    broadcastTrafficEvent(trafficData);

    res.json({
      success: true,
      message: 'Traffic event recorded and broadcasted'
    });
  } catch (error) {
    console.error('❌ Failed to process traffic event:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * API: Get audit logs (structured logging)
 */
router.get('/audit-logs', optionalAuth, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query['limit'] as string) || 100;
    const offset = parseInt(req.query['offset'] as string) || 0;
    const category = req.query['category'] as string;
    const userId = req.query['userId'] as string;

    const mongoStorage = databaseManager.getMongoStorage();

    if (mongoStorage) {
      const auditLogs = await mongoStorage.getAuditLogs(limit, {
        offset,
        category,
        userId
      });

      res.json({
        success: true,
        data: auditLogs,
        meta: {
          limit,
          offset,
          count: auditLogs.length
        }
      });
    } else {
      // Fallback when database is not available
      res.json({
        success: true,
        data: [],
        message: 'Audit logs not available - database not connected',
        meta: { limit, offset, count: 0 }
      });
    }
  } catch (error) {
    console.error('Audit logs API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audit logs'
    });
  }
});

/**
 * API: Log audit event
 */
router.post('/audit-logs', authenticate, express.json(), async (req: Request, res: Response) => {
  try {
    const { action, details, category = 'general', severity = 'info', userId = 'admin' } = req.body;

    if (!action) {
      return res.status(400).json({
        success: false,
        error: 'Action is required for audit log entry'
      });
    }

    const mongoStorage = databaseManager.getMongoStorage();

    if (mongoStorage) {
      await mongoStorage.logAudit({
        action,
        message: details || '',
        category,
        level: severity,
        userId,
        ip: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || ''
      });

      res.json({
        success: true,
        message: 'Audit log entry created'
      });
    } else {
      // Fallback to console logging when database is not available
      console.log(`[AUDIT] ${severity.toUpperCase()}: ${action} by ${userId} - ${details}`);
      res.json({
        success: true,
        message: 'Audit log entry created (console fallback)'
      });
    }
  } catch (error) {
    console.error('Audit log creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create audit log entry'
    });
  }
});

/**
 * API: Get error logs
 */
router.get('/error-logs', optionalAuth, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query['limit'] as string) || 100;
    const offset = parseInt(req.query['offset'] as string) || 0;
    const severity = req.query['severity'] as string;
    const category = req.query['category'] as string;
    const url = req.query['url'] as string;

    const mongoStorage = databaseManager.getMongoStorage();

    if (mongoStorage) {
      const errorLogs = await mongoStorage.getErrorLogs(limit, {
        offset,
        severity,
        category,
        url
      });

      res.json({
        success: true,
        data: errorLogs,
        meta: {
          limit,
          offset,
          count: errorLogs.length
        }
      });
    } else {
      // Fallback when database is not available
      res.json({
        success: true,
        data: [],
        message: 'Error logs not available - database not connected',
        meta: { limit, offset, count: 0 }
      });
    }
  } catch (error) {
    console.error('Error logs API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch error logs'
    });
  }
});

/**
 * API: Log error event
 */
router.post('/error-logs', authenticate, express.json(), async (req: Request, res: Response) => {
  try {
    const {
      message,
      stack,
      category = 'general',
      severity = 'medium',
      url = '',
      context = {}
    } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required for error log entry'
      });
    }

    const mongoStorage = databaseManager.getMongoStorage();

    if (mongoStorage) {
      await mongoStorage.logError({
        error: message,
        stack,
        context,
        path: url,
        ip: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || '',
        resolved: false
      });

      res.json({
        success: true,
        message: 'Error log entry created'
      });
    } else {
      // Fallback to console logging when database is not available
      console.error(`[ERROR] ${severity.toUpperCase()}: ${message} at ${url}`);
      res.json({
        success: true,
        message: 'Error log entry created (console fallback)'
      });
    }
  } catch (error) {
    console.error('Error log creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create error log entry'
    });
  }
});

/**
 * API: Get database health and statistics
 */
router.get('/database-stats', optionalAuth, async (req: Request, res: Response) => {
  try {
    const dbHealth = await databaseManager.healthCheck();
    const mongoStorage = databaseManager.getMongoStorage();

    let additionalStats = {};
    if (mongoStorage) {
      try {
        additionalStats = await mongoStorage.getStats();
      } catch (statsError) {
        console.warn('Failed to get additional database stats:', statsError);
      }
    }

    res.json({
      success: true,
      data: {
        connected: dbHealth.connected,
        stats: dbHealth.stats,
        additional: additionalStats
      }
    });
  } catch (error) {
    console.error('Database stats API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch database statistics'
    });
  }
});

export default router;
