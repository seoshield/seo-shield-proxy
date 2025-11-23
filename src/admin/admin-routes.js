/**
 * Admin Dashboard API Routes
 * Provides REST API endpoints for React admin dashboard
 * Note: React admin dashboard runs on port 3001, this only provides APIs
 */

import express from 'express';
import metricsCollector from './metrics-collector.js';
import configManager from './config-manager.js';
import cache from '../cache.js';

const router = express.Router();

/**
 * Basic Authentication Middleware
 */
function authenticate(req, res, next) {
  try {
    const config = configManager.getConfig();

    // Skip auth if disabled
    if (!config?.adminAuth?.enabled) {
      return next();
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Basic ')) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Admin Panel"');
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      const base64Credentials = authHeader.slice(6);
      const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
      const [username, password] = credentials.split(':', 2); // Limit split to 2 parts

      // Validate credentials exist
      if (!username || !password) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Admin Panel"');
        return res.status(401).json({ error: 'Invalid credentials format' });
      }

      // Check credentials (use constant-time comparison in production)
      if (
        username === config.adminAuth.username &&
        password === config.adminAuth.password
      ) {
        return next();
      } else {
        res.setHeader('WWW-Authenticate', 'Basic realm="Admin Panel"');
        return res.status(401).json({ error: 'Invalid credentials' });
      }
    } catch (decodeError) {
      console.error('Auth decode error:', decodeError);
      res.setHeader('WWW-Authenticate', 'Basic realm="Admin Panel"');
      return res.status(401).json({ error: 'Invalid authentication format' });
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ error: 'Authentication system error' });
  }
}

/**
 * API: Get statistics
 */
router.get('/api/stats', authenticate, (req, res) => {
  const stats = metricsCollector.getStats();
  const botStats = metricsCollector.getBotStats();
  const cacheStats = cache.getStats();

  res.json({
    success: true,
    data: {
      metrics: stats,
      bots: botStats,
      cache: cacheStats,
    },
  });
});

/**
 * API: Get recent traffic
 */
router.get('/api/traffic', authenticate, (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const traffic = metricsCollector.getRecentTraffic(limit);

  res.json({
    success: true,
    data: traffic,
  });
});

/**
 * API: Get traffic timeline
 */
router.get('/api/timeline', authenticate, (req, res) => {
  const minutes = parseInt(req.query.minutes) || 60;
  const timeline = metricsCollector.getTrafficTimeline(minutes);

  res.json({
    success: true,
    data: timeline,
  });
});

/**
 * API: Get URL statistics
 */
router.get('/api/urls', authenticate, (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const urlStats = metricsCollector.getUrlStats(limit);

  res.json({
    success: true,
    data: urlStats,
  });
});

/**
 * API: Get cache list
 */
router.get('/api/cache', authenticate, (req, res) => {
  const cacheKeys = cache.cache.keys();
  const cacheData = cacheKeys.map((key) => {
    const value = cache.cache.get(key);
    const ttl = cache.cache.getTtl(key);

    return {
      url: key,
      size: value ? value.length : 0,
      ttl: ttl ? Math.floor((ttl - Date.now()) / 1000) : 0,
    };
  });

  res.json({
    success: true,
    data: cacheData,
  });
});

/**
 * API: Clear cache
 */
router.post('/api/cache/clear', authenticate, (req, res) => {
  const { url } = req.body;

  if (url) {
    // Clear specific URL
    const deleted = cache.delete(url);
    res.json({
      success: true,
      message: deleted ? 'Cache entry deleted' : 'Cache entry not found',
      deleted,
    });
  } else {
    // Clear all cache
    cache.flush();
    res.json({
      success: true,
      message: 'All cache cleared',
    });
  }
});

/**
 * API: Get configuration
 */
router.get('/api/config', authenticate, (req, res) => {
  const config = configManager.getConfig();

  res.json({
    success: true,
    data: config,
  });
});

/**
 * API: Update configuration
 */
router.post('/api/config', authenticate, express.json(), async (req, res) => {
  try {
    const updates = req.body;
    const newConfig = await configManager.updateConfig(updates);

    res.json({
      success: true,
      message: 'Configuration updated',
      data: newConfig,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * API: Add cache pattern
 */
router.post(
  '/api/config/cache-pattern',
  authenticate,
  express.json(),
  async (req, res) => {
    try {
      const { pattern, type } = req.body;

      if (!pattern) {
        return res.status(400).json({
          success: false,
          error: 'Pattern is required',
        });
      }

      const config = await configManager.addCachePattern(pattern, type);

      res.json({
        success: true,
        message: 'Cache pattern added',
        data: config,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * API: Remove cache pattern
 */
router.delete(
  '/api/config/cache-pattern',
  authenticate,
  express.json(),
  async (req, res) => {
    try {
      const { pattern, type } = req.body;

      if (!pattern) {
        return res.status(400).json({
          success: false,
          error: 'Pattern is required',
        });
      }

      const config = await configManager.removeCachePattern(pattern, type);

      res.json({
        success: true,
        message: 'Cache pattern removed',
        data: config,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * API: Manage bot rules
 */
router.post('/api/config/bot', authenticate, express.json(), async (req, res) => {
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

    res.json({
      success: true,
      message: `Bot ${botName} ${action}ed`,
      data: config,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * API: Reset configuration to defaults
 */
router.post('/api/config/reset', authenticate, async (req, res) => {
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
      error: error.message,
    });
  }
});

/**
 * API: Reset metrics
 */
router.post('/api/metrics/reset', authenticate, (req, res) => {
  metricsCollector.reset();

  res.json({
    success: true,
    message: 'Metrics reset',
  });
});

/**
 * API: Real-time updates (Server-Sent Events)
 */
router.get('/api/stream', authenticate, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send stats every 2 seconds
  const interval = setInterval(() => {
    const stats = metricsCollector.getStats();
    const cacheStats = cache.getStats();

    const data = {
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

export default router;
