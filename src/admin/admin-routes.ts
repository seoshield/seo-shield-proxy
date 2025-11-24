/**
 * Admin Dashboard API Routes
 * Provides REST API endpoints for React admin dashboard
 * Note: React admin dashboard runs on port 3001, this only provides APIs
 */

import express, { Router, Request, Response, NextFunction } from 'express';
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

const router: Router = express.Router();

/**
 * Basic Authentication Middleware
 */
function authenticate(req: Request, res: Response, next: NextFunction): void | Response {
  try {
    const config = configManager.getConfig();

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
      const [username, password] = credentials.split(':', 2);

      if (!username || !password) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Admin Panel"');
        return res.status(401).json({ error: 'Invalid credentials format' });
      }

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
router.get('/api/stats', authenticate, (_req: Request, res: Response) => {
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
router.get('/api/traffic', authenticate, (req: Request, res: Response) => {
  const limit = parseInt(req.query['limit'] as string) || 100;
  const traffic = metricsCollector.getRecentTraffic(limit);

  res.json({
    success: true,
    data: traffic,
  });
});

/**
 * API: Get traffic timeline
 */
router.get('/api/timeline', authenticate, (req: Request, res: Response) => {
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
router.get('/api/urls', authenticate, (req: Request, res: Response) => {
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
router.get('/api/cache', authenticate, (_req: Request, res: Response) => {
  const cacheData = cache.getAllEntries();

  res.json({
    success: true,
    data: cacheData,
  });
});

/**
 * API: Clear cache
 */
router.post('/api/cache/clear', authenticate, express.json(), (req: Request, res: Response) => {
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
 * API: Get configuration
 */
router.get('/api/config', authenticate, (_req: Request, res: Response) => {
  const config = configManager.getConfig();

  res.json({
    success: true,
    data: config,
  });
});

/**
 * API: Update configuration
 */
router.post('/api/config', authenticate, express.json(), async (req: Request, res: Response) => {
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
      error: (error as Error).message,
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
  '/api/config/cache-pattern',
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
router.post('/api/config/bot', authenticate, express.json(), async (req: Request, res: Response) => {
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
router.post('/api/config/reset', authenticate, async (_req: Request, res: Response) => {
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
router.post('/api/metrics/reset', authenticate, (_req: Request, res: Response) => {
  metricsCollector.reset();

  res.json({
    success: true,
    message: 'Metrics reset',
  });
});

/**
 * API: Real-time updates (Server-Sent Events)
 */
router.get('/api/stream', authenticate, (req: Request, res: Response) => {
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

/**
 * API: Get cache warmer stats
 */
router.get('/api/warmer/stats', authenticate, (_req: Request, res: Response) => {
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
router.post('/api/warmer/add', authenticate, express.json(), async (req: Request, res: Response) => {
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
router.post('/api/warmer/sitemap', authenticate, express.json(), async (req: Request, res: Response) => {
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
router.post('/api/warmer/clear', authenticate, (_req: Request, res: Response) => {
  cacheWarmer.clearQueue();

  res.json({
    success: true,
    message: 'Cache warmer queue cleared',
  });
});

/**
 * API: Warm specific URL immediately
 */
router.post('/api/warmer/warm', authenticate, express.json(), async (req: Request, res: Response) => {
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
router.post('/api/snapshots/capture', authenticate, express.json(), async (req: Request, res: Response) => {
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
router.get('/api/snapshots/:id', authenticate, async (req: Request, res: Response) => {
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
router.get('/api/snapshots', authenticate, async (req: Request, res: Response) => {
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
router.get('/api/snapshots/history/:url', authenticate, async (req: Request, res: Response) => {
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
router.post('/api/snapshots/compare', authenticate, express.json(), async (req: Request, res: Response) => {
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
router.get('/api/snapshots/diff/:id', authenticate, async (req: Request, res: Response) => {
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
router.delete('/api/snapshots/:id', authenticate, async (req: Request, res: Response) => {
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
router.get('/api/hotfix/rules', authenticate, (_req: Request, res: Response) => {
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
router.get('/api/hotfix/stats', authenticate, (_req: Request, res: Response) => {
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
router.post('/api/hotfix/rules', authenticate, express.json(), async (req: Request, res: Response) => {
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
router.put('/api/hotfix/rules/:id', authenticate, express.json(), async (req: Request, res: Response) => {
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
router.delete('/api/hotfix/rules/:id', authenticate, async (req: Request, res: Response) => {
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
router.post('/api/hotfix/rules/:id/toggle', authenticate, async (req: Request, res: Response) => {
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
router.post('/api/hotfix/test', authenticate, express.json(), async (req: Request, res: Response) => {
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
router.get('/api/hotfix/tests', authenticate, (req: Request, res: Response) => {
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
router.get('/api/forensics/stats', authenticate, async (_req: Request, res: Response) => {
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
router.get('/api/forensics/errors', authenticate, async (req: Request, res: Response) => {
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
router.get('/api/forensics/errors/:id', authenticate, async (req: Request, res: Response) => {
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
router.get('/api/forensics/errors/by-url/:url', authenticate, async (req: Request, res: Response) => {
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
router.delete('/api/forensics/errors/:id', authenticate, async (req: Request, res: Response) => {
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
router.post('/api/forensics/cleanup', authenticate, express.json(), async (req: Request, res: Response) => {
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
router.get('/api/blocking/rules', authenticate, (_req: Request, res: Response) => {
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
router.get('/api/blocking/stats', authenticate, (_req: Request, res: Response) => {
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
router.post('/api/blocking/rules', authenticate, express.json(), async (req: Request, res: Response) => {
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
router.post('/api/blocking/test', authenticate, express.json(), async (req: Request, res: Response) => {
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
router.put('/api/blocking/rules/:id', authenticate, express.json(), async (req: Request, res: Response) => {
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
router.delete('/api/blocking/rules/:id', authenticate, async (req: Request, res: Response) => {
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
router.post('/api/blocking/rules/:id/toggle', authenticate, async (req: Request, res: Response) => {
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
router.get('/api/blocking/rules/:id', authenticate, async (req: Request, res: Response) => {
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
router.get('/api/simulate/user-agents', authenticate, (_req: Request, res: Response) => {
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
router.post('/api/simulate/start', authenticate, express.json(), async (req: Request, res: Response) => {
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
 * API: Get simulation by ID
 */
router.get('/api/simulate/:id', authenticate, (req: Request, res: Response) => {
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
 * API: Get simulation history
 */
router.get('/api/simulate/history', authenticate, (req: Request, res: Response) => {
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
router.get('/api/simulate/active', authenticate, (_req: Request, res: Response) => {
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
router.get('/api/simulate/stats', authenticate, (_req: Request, res: Response) => {
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
router.post('/api/simulate/compare', authenticate, express.json(), async (req: Request, res: Response) => {
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
 * API: Cancel simulation
 */
router.post('/api/simulate/:id/cancel', authenticate, async (req: Request, res: Response) => {
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

export default router;
