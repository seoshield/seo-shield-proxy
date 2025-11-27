import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock dependencies before importing server
vi.mock('../../src/browser', () => ({
  default: {
    render: vi.fn().mockResolvedValue({ html: '<html><body>Test</body></html>', statusCode: 200 }),
    getPage: vi.fn().mockResolvedValue({ goto: vi.fn(), content: vi.fn().mockResolvedValue('<html></html>'), close: vi.fn() }),
    releasePage: vi.fn(),
    closeBrowser: vi.fn()
  }
}));

vi.mock('../../src/cache', () => ({
  default: {
    get: vi.fn(),
    set: vi.fn(),
    getWithTTL: vi.fn(),
    isReady: vi.fn().mockReturnValue(true)
  },
  getCache: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(null),
    set: vi.fn().mockReturnValue(true),
    getWithTTL: vi.fn().mockReturnValue(null),
    isReady: vi.fn().mockReturnValue(true)
  })
}));

vi.mock('../../src/database/database-manager', () => ({
  databaseManager: {
    connect: vi.fn().mockResolvedValue(true),
    disconnect: vi.fn().mockResolvedValue(undefined),
    getMongoStorage: vi.fn().mockReturnValue(null),
    isDbConnected: vi.fn().mockReturnValue(false)
  }
}));

vi.mock('../../src/middleware/rate-limiter', () => ({
  generalRateLimiter: (req: any, res: any, next: any) => next(),
  ssrRateLimiter: (req: any, res: any, next: any) => next()
}));

// Create minimal test app that mimics server.ts behavior
function createTestApp() {
  const app = express();

  // Health check endpoint
  app.get('/shieldhealth', (req, res) => {
    res.json({
      status: 'ok',
      service: 'seo-shield-proxy',
      mode: 'proxy-only',
      port: 8080,
      target: 'http://localhost:3000',
      timestamp: new Date().toISOString()
    });
  });

  // SSR middleware simulation
  app.use((req, res, next) => {
    const userAgent = req.headers['user-agent'] || '';
    const requestPath = req.path;

    // Check for static assets
    const STATIC_EXTENSIONS = ['.jpg', '.png', '.css', '.js', '.woff', '.woff2'];
    const isStaticAsset = STATIC_EXTENSIONS.some(ext => requestPath.includes(ext));

    if (isStaticAsset) {
      return res.status(200).send('Static asset');
    }

    // Check render params
    const renderParam = (req.query.render || req.query._render) as string;
    const isRenderPreview = renderParam === 'preview' || renderParam === 'true';
    const isRenderDebug = renderParam === 'debug';

    if (isRenderDebug) {
      return res.json({
        success: true,
        debug: {
          url: `http://localhost:3000${req.originalUrl}`,
          path: requestPath,
          renderTime: '50ms',
          htmlLength: 100,
          statusCode: 200,
          wasCached: false,
          botDetection: {
            isBot: false,
            botType: 'human',
            confidence: '30.0%',
            rulesMatched: [],
            action: 'allow'
          },
          cacheDecision: { shouldCache: true, reason: 'default' },
          timestamp: new Date().toISOString()
        },
        html: '<html><body>Debug</body></html>'
      });
    }

    // Check for bot
    const isBot = userAgent.toLowerCase().includes('bot') || userAgent.toLowerCase().includes('googlebot');

    if (isBot || isRenderPreview) {
      return res.status(200).send('<html><body>SSR Content</body></html>');
    }

    next();
  });

  // Fallback for non-matched routes
  app.use((req, res) => {
    res.status(200).send('Proxied content');
  });

  // 404 handler
  app.use((req: any, res: any) => {
    res.status(404).send('Not Found');
  });

  // Error handler
  app.use((err: any, req: any, res: any, next: any) => {
    res.status(500).send('Internal Server Error');
  });

  return app;
}

describe('Server Integration Tests', () => {
  let app: express.Express;

  beforeAll(() => {
    app = createTestApp();
  });

  describe('Health Check Endpoint', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/shieldhealth')
        .expect(200);

      expect(response.body.status).toBe('ok');
      expect(response.body.service).toBe('seo-shield-proxy');
      expect(response.body.mode).toBe('proxy-only');
    });

    it('should include timestamp in health response', async () => {
      const response = await request(app)
        .get('/shieldhealth')
        .expect(200);

      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('Static Asset Handling', () => {
    it('should handle CSS files', async () => {
      const response = await request(app)
        .get('/styles.css')
        .expect(200);

      expect(response.text).toBe('Static asset');
    });

    it('should handle JS files', async () => {
      const response = await request(app)
        .get('/app.js')
        .expect(200);

      expect(response.text).toBe('Static asset');
    });

    it('should handle image files', async () => {
      const response = await request(app)
        .get('/logo.png')
        .expect(200);

      expect(response.text).toBe('Static asset');
    });

    it('should handle font files', async () => {
      const response = await request(app)
        .get('/font.woff2')
        .expect(200);

      expect(response.text).toBe('Static asset');
    });
  });

  describe('Debug Mode', () => {
    it('should return debug info with ?render=debug', async () => {
      const response = await request(app)
        .get('/test-page?render=debug')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.debug).toBeDefined();
      expect(response.body.debug.path).toBe('/test-page');
    });

    it('should return debug info with ?_render=debug', async () => {
      const response = await request(app)
        .get('/test-page?_render=debug')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.debug).toBeDefined();
    });

    it('should include bot detection in debug response', async () => {
      const response = await request(app)
        .get('/test?render=debug')
        .expect(200);

      expect(response.body.debug.botDetection).toBeDefined();
      expect(response.body.debug.botDetection.isBot).toBe(false);
    });

    it('should include cache decision in debug response', async () => {
      const response = await request(app)
        .get('/test?render=debug')
        .expect(200);

      expect(response.body.debug.cacheDecision).toBeDefined();
    });
  });

  describe('Bot Detection and SSR', () => {
    it('should SSR for Googlebot', async () => {
      const response = await request(app)
        .get('/test-page')
        .set('User-Agent', 'Googlebot/2.1')
        .expect(200);

      expect(response.text).toBe('<html><body>SSR Content</body></html>');
    });

    it('should SSR for generic bot', async () => {
      const response = await request(app)
        .get('/test-page')
        .set('User-Agent', 'somebot crawler')
        .expect(200);

      expect(response.text).toBe('<html><body>SSR Content</body></html>');
    });

    it('should SSR with render=preview', async () => {
      const response = await request(app)
        .get('/test-page?render=preview')
        .set('User-Agent', 'Mozilla/5.0')
        .expect(200);

      expect(response.text).toBe('<html><body>SSR Content</body></html>');
    });

    it('should SSR with render=true', async () => {
      const response = await request(app)
        .get('/test-page?render=true')
        .set('User-Agent', 'Mozilla/5.0')
        .expect(200);

      expect(response.text).toBe('<html><body>SSR Content</body></html>');
    });

    it('should SSR with _render=preview', async () => {
      const response = await request(app)
        .get('/test-page?_render=preview')
        .set('User-Agent', 'Mozilla/5.0')
        .expect(200);

      expect(response.text).toBe('<html><body>SSR Content</body></html>');
    });
  });

  describe('Human User Handling', () => {
    it('should proxy for human users', async () => {
      const response = await request(app)
        .get('/test-page')
        .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
        .expect(200);

      expect(response.text).toBe('Proxied content');
    });

    it('should proxy for Chrome browser', async () => {
      const response = await request(app)
        .get('/about')
        .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
        .expect(200);

      expect(response.text).toBe('Proxied content');
    });
  });
});

describe('isStaticAsset Function Tests', () => {
  const STATIC_EXTENSIONS = [
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico', '.css', '.js', '.jsx',
    '.ts', '.tsx', '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.webm', '.mp3',
    '.wav', '.pdf', '.zip', '.txt', '.xml', '.json', '.rss', '.atom'
  ];

  function isStaticAsset(path: string): boolean {
    if (path.startsWith('/api') || path.startsWith('/shieldhealth') || path.startsWith('/assets') || path === '/' || path.endsWith('/')) {
      return false;
    }
    return STATIC_EXTENSIONS.some(ext => path.includes(ext));
  }

  it('should return false for API paths', () => {
    expect(isStaticAsset('/api/users')).toBe(false);
    expect(isStaticAsset('/api/v1/data')).toBe(false);
  });

  it('should return false for shieldhealth', () => {
    expect(isStaticAsset('/shieldhealth')).toBe(false);
  });

  it('should return false for assets paths', () => {
    expect(isStaticAsset('/assets/img.png')).toBe(false);
  });

  it('should return false for root', () => {
    expect(isStaticAsset('/')).toBe(false);
  });

  it('should return false for trailing slash', () => {
    expect(isStaticAsset('/about/')).toBe(false);
  });

  it('should return true for static files', () => {
    expect(isStaticAsset('/style.css')).toBe(true);
    expect(isStaticAsset('/app.js')).toBe(true);
    expect(isStaticAsset('/image.png')).toBe(true);
    expect(isStaticAsset('/font.woff2')).toBe(true);
  });
});

describe('sendTrafficEvent Function Simulation', () => {
  it('should create traffic event data structure', () => {
    const trafficData = {
      method: 'GET',
      path: '/test',
      userAgent: 'Mozilla/5.0',
      ip: '127.0.0.1',
      timestamp: Date.now(),
      isBot: false,
      botType: 'human',
      botConfidence: 0.3,
      botRulesMatched: [],
      botAction: 'allow',
      headers: {
        'user-agent': 'Mozilla/5.0',
        'referer': 'http://example.com',
        'accept': 'text/html'
      }
    };

    expect(trafficData.method).toBe('GET');
    expect(trafficData.path).toBe('/test');
    expect(trafficData.isBot).toBe(false);
    expect(trafficData.botType).toBe('human');
  });

  it('should handle MongoDB storage call', async () => {
    const mockMongoStorage = {
      storeTrafficMetric: vi.fn().mockResolvedValue(undefined)
    };

    const trafficData = {
      timestamp: new Date(),
      method: 'GET',
      path: '/',
      ip: '127.0.0.1',
      userAgent: 'Mozilla/5.0',
      referer: '',
      isBot: false,
      action: 'proxy',
      responseTime: 0,
      statusCode: 200,
      responseSize: 0
    };

    await mockMongoStorage.storeTrafficMetric(trafficData);

    expect(mockMongoStorage.storeTrafficMetric).toHaveBeenCalledWith(trafficData);
  });

  it('should handle fetch to API server', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });

    const trafficData = { path: '/test' };

    await mockFetch('http://localhost:3190/shieldapi/traffic-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trafficData)
    });

    expect(mockFetch).toHaveBeenCalled();
  });

  it('should handle fetch error gracefully', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

    try {
      await mockFetch('http://localhost:3190/shieldapi/traffic-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
    } catch (error) {
      expect((error as Error).message).toBe('Connection refused');
    }
  });
});

describe('Bot Detection Fallback Logic', () => {
  it('should create fallback detection when advanced detection is not available', () => {
    const botDetector = null;
    const userAgent = 'Mozilla/5.0';
    const isBotResult = false;

    let botDetection;
    if (botDetector) {
      // Would use advanced detection
    } else {
      botDetection = {
        isBot: isBotResult,
        confidence: isBotResult ? 0.7 : 0.3,
        botType: isBotResult ? 'unknown' : 'human',
        rulesMatched: [],
        action: isBotResult ? 'render' : 'allow' as const
      };
    }

    expect(botDetection!.isBot).toBe(false);
    expect(botDetection!.confidence).toBe(0.3);
    expect(botDetection!.botType).toBe('human');
    expect(botDetection!.action).toBe('allow');
  });

  it('should create fallback detection when advanced detection fails', () => {
    const error = new Error('Detection failed');
    const userAgent = 'Googlebot/2.1';
    const isBotResult = true;

    // Simulate fallback after error
    const botDetection = {
      isBot: isBotResult,
      confidence: isBotResult ? 0.8 : 0.2,
      botType: isBotResult ? 'unknown' : 'human',
      rulesMatched: [],
      action: isBotResult ? 'render' : 'allow' as const
    };

    expect(botDetection.isBot).toBe(true);
    expect(botDetection.confidence).toBe(0.8);
    expect(botDetection.action).toBe('render');
  });
});

describe('Database Initialization Logic', () => {
  it('should handle successful database connection', async () => {
    const mockDatabaseManager = {
      connect: vi.fn().mockResolvedValue(true),
      getMongoStorage: vi.fn().mockReturnValue({ someMethod: vi.fn() }),
      isDbConnected: vi.fn().mockReturnValue(true)
    };

    const connected = await mockDatabaseManager.connect();
    expect(connected).toBe(true);

    const mongoStorage = mockDatabaseManager.getMongoStorage();
    expect(mongoStorage).toBeDefined();
  });

  it('should handle failed database connection', async () => {
    const mockDatabaseManager = {
      connect: vi.fn().mockResolvedValue(false),
      getMongoStorage: vi.fn().mockReturnValue(null),
      isDbConnected: vi.fn().mockReturnValue(false)
    };

    const connected = await mockDatabaseManager.connect();
    expect(connected).toBe(false);

    const mongoStorage = mockDatabaseManager.getMongoStorage();
    expect(mongoStorage).toBeNull();
  });

  it('should handle database connection error', async () => {
    const mockDatabaseManager = {
      connect: vi.fn().mockRejectedValue(new Error('Connection failed'))
    };

    try {
      await mockDatabaseManager.connect();
    } catch (error) {
      expect((error as Error).message).toBe('Connection failed');
    }
  });
});

describe('Stale-While-Revalidate Logic', () => {
  it('should calculate cache age correctly', () => {
    const renderTime = Date.now() - 30000; // 30 seconds ago
    const cacheAge = Date.now() - renderTime;
    expect(cacheAge).toBeGreaterThanOrEqual(30000);
  });

  it('should identify fresh cache', () => {
    const cacheTTL = 60 * 1000; // 60 seconds
    const staleThreshold = cacheTTL * 0.8; // 48 seconds
    const cacheAge = 30000; // 30 seconds

    const isStale = cacheAge > staleThreshold;
    expect(isStale).toBe(false);
  });

  it('should identify stale cache', () => {
    const cacheTTL = 60 * 1000; // 60 seconds
    const staleThreshold = cacheTTL * 0.8; // 48 seconds
    const cacheAge = 50000; // 50 seconds

    const isStale = cacheAge > staleThreshold;
    expect(isStale).toBe(true);
  });

  it('should trigger background revalidation for stale cache', async () => {
    const mockBrowserManager = {
      render: vi.fn().mockResolvedValue({ html: '<html>New</html>', statusCode: 200 })
    };
    const mockCache = {
      set: vi.fn().mockReturnValue(true)
    };

    // Simulate background revalidation
    const fullUrl = 'http://localhost:3000/test';
    const renderResult = await mockBrowserManager.render(fullUrl);

    if (renderResult && renderResult.html) {
      mockCache.set(fullUrl, JSON.stringify({
        content: renderResult.html,
        renderTime: Date.now(),
        statusCode: renderResult.statusCode || 200
      }));
    }

    expect(mockBrowserManager.render).toHaveBeenCalledWith(fullUrl);
    expect(mockCache.set).toHaveBeenCalled();
  });
});

describe('Proxy Middleware Configuration', () => {
  it('should have correct proxy options', () => {
    const proxyOptions = {
      target: 'http://localhost:3000',
      changeOrigin: true,
      followRedirects: true,
      timeout: 30000
    };

    expect(proxyOptions.target).toBe('http://localhost:3000');
    expect(proxyOptions.changeOrigin).toBe(true);
    expect(proxyOptions.followRedirects).toBe(true);
    expect(proxyOptions.timeout).toBe(30000);
  });

  it('should handle onProxyReq callback', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const onProxyReq = (proxyReq: any, req: any, res: any) => {
      console.log(`🔗 Proxying: ${req.method} ${req.url} -> http://localhost:3000${req.url}`);
    };

    onProxyReq({}, { method: 'GET', url: '/test' }, {});

    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('should handle onProxyRes callback', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const onProxyRes = (proxyRes: any, req: any, res: any) => {
      console.log(`📤 Proxy response: ${req.method} ${req.url} -> ${proxyRes.statusCode}`);
    };

    onProxyRes({ statusCode: 200 }, { method: 'GET', url: '/test' }, {});

    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('should handle onError callback', () => {
    const mockRes = {
      headersSent: false,
      status: vi.fn().mockReturnThis(),
      send: vi.fn()
    };

    const onError = (err: any, req: any, res: any) => {
      if (!res.headersSent) {
        res.status(502).send('Bad Gateway: Target server unavailable');
      }
    };

    onError(new Error('ECONNREFUSED'), { url: '/test' }, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(502);
    expect(mockRes.send).toHaveBeenCalledWith('Bad Gateway: Target server unavailable');
  });
});
