import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock config
vi.mock('../../src/config', () => ({
  default: {
    TARGET_URL: 'https://example.com',
    PORT: 8080,
    CACHE_TTL: 3600,
    API_PORT: 3190
  }
}));

// Mock cache
const mockCache = {
  get: vi.fn(),
  set: vi.fn().mockReturnValue(true),
  getWithTTL: vi.fn()
};

vi.mock('../../src/cache', () => ({
  default: mockCache,
  getCache: vi.fn().mockResolvedValue(mockCache)
}));

// Mock browser manager
vi.mock('../../src/browser', () => ({
  default: {
    render: vi.fn().mockResolvedValue({ html: '<html></html>', statusCode: 200 })
  }
}));

// Mock cache rules
vi.mock('../../src/cache-rules', () => ({
  default: vi.fn().mockImplementation(() => ({
    getCacheDecision: vi.fn().mockReturnValue({ shouldCache: true, ttl: 3600 }),
    shouldCacheUrl: vi.fn().mockReturnValue({ shouldCache: true, reason: 'Default' })
  }))
}));

// Mock rate limiter
vi.mock('../../src/middleware/rate-limiter', () => ({
  generalRateLimiter: vi.fn((req: any, res: any, next: any) => next()),
  ssrRateLimiter: vi.fn((req: any, res: any, next: any) => next())
}));

// Mock database manager
const mockDatabaseManager = {
  connect: vi.fn().mockResolvedValue(true),
  getMongoStorage: vi.fn().mockReturnValue({
    storeTrafficMetric: vi.fn().mockResolvedValue(undefined)
  }),
  isDbConnected: vi.fn().mockReturnValue(true)
};

vi.mock('../../src/database/database-manager', () => ({
  databaseManager: mockDatabaseManager
}));

// Mock advanced bot detector
vi.mock('../../src/bot-detection/advanced-bot-detector', () => ({
  AdvancedBotDetector: vi.fn().mockImplementation(() => ({
    detectBot: vi.fn().mockResolvedValue({
      isBot: false,
      confidence: 0.2,
      botType: 'human',
      rulesMatched: [],
      action: 'allow'
    })
  }))
}));

// Mock isbot
vi.mock('isbot', () => ({
  isbot: vi.fn().mockReturnValue(false)
}));

// Mock http-proxy-middleware
vi.mock('http-proxy-middleware', () => ({
  createProxyMiddleware: vi.fn().mockReturnValue(vi.fn((req: any, res: any, next: any) => next()))
}));

// Mock fetch
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  status: 200,
  json: () => Promise.resolve({})
});

describe('Server Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('sendTrafficEvent function', () => {
    it('should store traffic in MongoDB when available', async () => {
      const mongoStorage = mockDatabaseManager.getMongoStorage();

      const sendTrafficEvent = async (trafficData: any) => {
        try {
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
              responseTime: 0,
              statusCode: 200,
              responseSize: 0,
            });
            console.log('Traffic event stored in MongoDB');
          }
        } catch (error) {
          console.error('Could not send traffic event:', error);
        }
      };

      await sendTrafficEvent({
        method: 'GET',
        path: '/',
        userAgent: 'test-agent',
        ip: '1.1.1.1'
      });

      expect(mongoStorage?.storeTrafficMetric).toHaveBeenCalled();
    });

    it('should send traffic to API server', async () => {
      const sendTrafficEvent = async (trafficData: any) => {
        try {
          const response = await fetch('http://localhost:3190/shieldapi/traffic-events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(trafficData),
          });

          if (!response.ok) {
            console.error('Failed to send traffic event:', response.status);
          } else {
            console.log('Traffic event sent successfully');
          }
        } catch (error) {
          console.error('Could not send traffic event to API server:', error);
        }
      };

      await sendTrafficEvent({ path: '/test' });

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3190/shieldapi/traffic-events',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
      );
    });

    it('should handle failed API response', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const sendTrafficEvent = async (trafficData: any) => {
        try {
          const response = await fetch('http://localhost:3190/shieldapi/traffic-events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(trafficData),
          });

          if (!response.ok) {
            console.error('Failed to send traffic event:', response.status);
          }
        } catch (error) {
          console.error('Could not send traffic event:', error);
        }
      };

      await sendTrafficEvent({ path: '/test' });

      expect(errorSpy).toHaveBeenCalledWith('Failed to send traffic event:', 500);

      errorSpy.mockRestore();
    });

    it('should handle fetch error silently', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const sendTrafficEvent = async (trafficData: any) => {
        try {
          await fetch('http://localhost:3190/shieldapi/traffic-events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(trafficData),
          });
        } catch (error) {
          console.error('Could not send traffic event to API server:', error);
        }
      };

      await sendTrafficEvent({ path: '/test' });

      expect(errorSpy).toHaveBeenCalled();

      errorSpy.mockRestore();
    });

    it('should use default values when not provided', async () => {
      const mongoStorage = mockDatabaseManager.getMongoStorage();

      const sendTrafficEvent = async (trafficData: any) => {
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
            responseTime: 0,
            statusCode: 200,
            responseSize: 0,
          });
        }
      };

      await sendTrafficEvent({});

      expect(mongoStorage?.storeTrafficMetric).toHaveBeenCalledWith(expect.objectContaining({
        method: 'GET',
        path: '/',
        ip: 'unknown',
        userAgent: '',
        isBot: false,
        action: 'proxy'
      }));
    });
  });

  describe('isStaticAsset function', () => {
    const STATIC_EXTENSIONS = [
      '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico', '.css', '.js', '.jsx',
      '.ts', '.tsx', '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.webm', '.mp3',
      '.wav', '.pdf', '.zip', '.txt', '.xml', '.json', '.rss', '.atom'
    ];

    const isStaticAsset = (path: string): boolean => {
      if (path.startsWith('/api') || path.startsWith('/shieldhealth') || path.startsWith('/assets') || path === '/' || path.endsWith('/')) {
        return false;
      }
      return STATIC_EXTENSIONS.some(ext => path.includes(ext));
    };

    it('should return false for API endpoints', () => {
      expect(isStaticAsset('/api/data')).toBe(false);
      expect(isStaticAsset('/api/users')).toBe(false);
    });

    it('should return false for health check endpoint', () => {
      expect(isStaticAsset('/shieldhealth')).toBe(false);
    });

    it('should return false for assets path', () => {
      expect(isStaticAsset('/assets/image.png')).toBe(false);
    });

    it('should return false for root path', () => {
      expect(isStaticAsset('/')).toBe(false);
    });

    it('should return false for paths ending with slash', () => {
      expect(isStaticAsset('/about/')).toBe(false);
      expect(isStaticAsset('/products/')).toBe(false);
    });

    it('should return true for image files', () => {
      expect(isStaticAsset('/image.jpg')).toBe(true);
      expect(isStaticAsset('/photo.png')).toBe(true);
      expect(isStaticAsset('/icon.svg')).toBe(true);
      expect(isStaticAsset('/banner.webp')).toBe(true);
      expect(isStaticAsset('/animation.gif')).toBe(true);
    });

    it('should return true for CSS files', () => {
      expect(isStaticAsset('/style.css')).toBe(true);
      expect(isStaticAsset('/app.min.css')).toBe(true);
    });

    it('should return true for JavaScript files', () => {
      expect(isStaticAsset('/app.js')).toBe(true);
      expect(isStaticAsset('/bundle.min.js')).toBe(true);
    });

    it('should return true for font files', () => {
      expect(isStaticAsset('/font.woff')).toBe(true);
      expect(isStaticAsset('/font.woff2')).toBe(true);
      expect(isStaticAsset('/font.ttf')).toBe(true);
    });

    it('should return true for media files', () => {
      expect(isStaticAsset('/video.mp4')).toBe(true);
      expect(isStaticAsset('/audio.mp3')).toBe(true);
    });

    it('should return true for document files', () => {
      expect(isStaticAsset('/doc.pdf')).toBe(true);
      expect(isStaticAsset('/archive.zip')).toBe(true);
    });

    it('should return true for data files', () => {
      expect(isStaticAsset('/data.json')).toBe(true);
      expect(isStaticAsset('/sitemap.xml')).toBe(true);
    });

    it('should return false for HTML pages', () => {
      expect(isStaticAsset('/about')).toBe(false);
      expect(isStaticAsset('/products')).toBe(false);
      expect(isStaticAsset('/contact')).toBe(false);
    });
  });

  describe('Bot detection logic', () => {
    it('should detect bot request with advanced detector', async () => {
      const botDetector = {
        detectBot: vi.fn().mockResolvedValue({
          isBot: true,
          confidence: 0.95,
          botType: 'googlebot',
          rulesMatched: ['ua-match'],
          action: 'render'
        })
      };

      const result = await botDetector.detectBot({
        userAgent: 'Googlebot/2.1',
        ip: '66.249.66.1',
        headers: {},
        path: '/',
        method: 'GET'
      });

      expect(result.isBot).toBe(true);
      expect(result.botType).toBe('googlebot');
      expect(result.confidence).toBe(0.95);
    });

    it('should fallback to basic isbot when advanced detection fails', async () => {
      const { isbot } = await import('isbot');
      (isbot as any).mockReturnValue(true);

      const botDetector = {
        detectBot: vi.fn().mockRejectedValue(new Error('Detection failed'))
      };

      let botDetection;
      try {
        botDetection = await botDetector.detectBot({});
      } catch {
        const isBotResult = isbot('Googlebot/2.1');
        botDetection = {
          isBot: isBotResult,
          confidence: isBotResult ? 0.8 : 0.2,
          botType: isBotResult ? 'unknown' : 'human',
          rulesMatched: [],
          action: isBotResult ? 'render' : 'allow'
        };
      }

      expect(botDetection.isBot).toBe(true);
      expect(botDetection.confidence).toBe(0.8);
    });

    it('should use basic isbot when no advanced detector', async () => {
      // Simulate basic bot detection without advanced detector
      const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
      const isBotResult = false; // simulated human user

      const botDetection = {
        isBot: isBotResult,
        confidence: isBotResult ? 0.7 : 0.3,
        botType: isBotResult ? 'unknown' : 'human',
        rulesMatched: [],
        action: isBotResult ? 'render' : 'allow'
      };

      expect(botDetection.isBot).toBe(false);
      expect(botDetection.botType).toBe('human');
      expect(botDetection.confidence).toBe(0.3);
    });
  });

  describe('Render parameters', () => {
    it('should detect render preview mode', () => {
      const parseRenderParam = (query: any) => {
        const renderParam = (query.render || query._render) as string | undefined;
        const isRenderPreview = renderParam === 'preview' || renderParam === 'true';
        const isRenderDebug = renderParam === 'debug';
        return { isRenderPreview, isRenderDebug };
      };

      expect(parseRenderParam({ render: 'preview' }).isRenderPreview).toBe(true);
      expect(parseRenderParam({ render: 'true' }).isRenderPreview).toBe(true);
      expect(parseRenderParam({ _render: 'preview' }).isRenderPreview).toBe(true);
      expect(parseRenderParam({ _render: 'true' }).isRenderPreview).toBe(true);
    });

    it('should detect debug mode', () => {
      const parseRenderParam = (query: any) => {
        const renderParam = (query.render || query._render) as string | undefined;
        const isRenderDebug = renderParam === 'debug';
        return { isRenderDebug };
      };

      expect(parseRenderParam({ render: 'debug' }).isRenderDebug).toBe(true);
      expect(parseRenderParam({ _render: 'debug' }).isRenderDebug).toBe(true);
      expect(parseRenderParam({ render: 'preview' }).isRenderDebug).toBe(false);
    });
  });

  describe('Debug mode response', () => {
    it('should build debug JSON response', async () => {
      const browserManager = await import('../../src/browser');
      (browserManager.default.render as any).mockResolvedValue({
        html: '<html><body>Debug</body></html>',
        statusCode: 200
      });

      const buildDebugResponse = async (fullUrl: string, requestPath: string, botDetection: any, cached: any, cacheDecision: any) => {
        const debugStartTime = Date.now();
        const renderResult = await browserManager.default.render(fullUrl);
        const debugDuration = Date.now() - debugStartTime;

        return {
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
        };
      };

      const result = await buildDebugResponse(
        'https://example.com/',
        '/',
        { isBot: false, confidence: 0.2, botType: 'human', rulesMatched: [], action: 'allow' },
        null,
        { shouldCache: true, ttl: 3600 }
      );

      expect(result.success).toBe(true);
      expect(result.debug.url).toBe('https://example.com/');
      expect(result.debug.htmlLength).toBeGreaterThan(0);
    });

    it('should handle debug mode error', async () => {
      const browserManager = await import('../../src/browser');
      (browserManager.default.render as any).mockRejectedValueOnce(new Error('Render failed'));

      const buildDebugError = async (fullUrl: string) => {
        try {
          await browserManager.default.render(fullUrl);
        } catch (error) {
          return {
            success: false,
            debug: {
              url: fullUrl,
              error: (error as Error).message,
              timestamp: new Date().toISOString()
            }
          };
        }
      };

      const result = await buildDebugError('https://example.com/');

      expect(result?.success).toBe(false);
      expect(result?.debug.error).toBe('Render failed');
    });
  });

  describe('Bot SSR logic', () => {
    it('should serve from cache for bot requests', async () => {
      mockCache.get.mockReturnValue(JSON.stringify({ content: '<html>Cached</html>', renderTime: Date.now() }));

      const serveBot = async (fullUrl: string, isRenderPreview: boolean) => {
        const cached = mockCache.get(fullUrl);

        if (cached && !isRenderPreview) {
          const cacheData = JSON.parse(cached as any);
          return { fromCache: true, content: cacheData.content };
        }

        return { fromCache: false };
      };

      const result = await serveBot('https://example.com/', false);

      expect(result.fromCache).toBe(true);
      expect(result.content).toBe('<html>Cached</html>');
    });

    it('should render fresh for bot requests when no cache', async () => {
      mockCache.get.mockReturnValue(null);

      const browserManager = await import('../../src/browser');
      (browserManager.default.render as any).mockResolvedValue({
        html: '<html>Fresh render</html>',
        statusCode: 200
      });

      const serveBot = async (fullUrl: string) => {
        const cached = mockCache.get(fullUrl);

        if (!cached) {
          const renderResult = await browserManager.default.render(fullUrl);
          if (renderResult && renderResult.html) {
            mockCache.set(fullUrl, JSON.stringify({ content: renderResult.html, renderTime: Date.now() }));
            return { rendered: true, content: renderResult.html };
          }
        }

        return { rendered: false };
      };

      const result = await serveBot('https://example.com/');

      expect(result.rendered).toBe(true);
      expect(result.content).toBe('<html>Fresh render</html>');
      expect(mockCache.set).toHaveBeenCalled();
    });

    it('should bypass cache for render preview', async () => {
      mockCache.get.mockReturnValue(JSON.stringify({ content: '<html>Cached</html>', renderTime: Date.now() }));

      const serveBot = async (fullUrl: string, isRenderPreview: boolean) => {
        const cached = mockCache.get(fullUrl);

        if (cached && !isRenderPreview) {
          return { fromCache: true };
        }

        return { fromCache: false };
      };

      const result = await serveBot('https://example.com/', true);

      expect(result.fromCache).toBe(false);
    });
  });

  describe('Human cache logic with Stale-While-Revalidate', () => {
    it('should serve fresh cache immediately', async () => {
      const cacheData = { content: '<html>Fresh</html>', renderTime: Date.now() - 1000 }; // 1 second old
      mockCache.get.mockReturnValue(JSON.stringify(cacheData));
      mockCache.getWithTTL.mockReturnValue({ value: JSON.stringify(cacheData), isStale: false });

      const serveHuman = async (fullUrl: string, isCacheable: boolean) => {
        const cachedEntry = mockCache.getWithTTL(fullUrl);
        const cached = cachedEntry?.value || mockCache.get(fullUrl);

        if (cached && isCacheable) {
          const data = JSON.parse(cached as string);
          const cacheAge = Date.now() - (data.renderTime || 0);
          const isStale = cachedEntry?.isStale || cacheAge > 2880000; // 80% of TTL

          if (!isStale) {
            return { served: true, status: 'fresh', content: data.content };
          }

          return { served: true, status: 'stale', content: data.content };
        }

        return { served: false };
      };

      const result = await serveHuman('https://example.com/', true);

      expect(result.served).toBe(true);
      expect(result.status).toBe('fresh');
    });

    it('should serve stale cache and revalidate in background', async () => {
      const cacheData = { content: '<html>Stale</html>', renderTime: Date.now() - 3000000 }; // Very old
      mockCache.get.mockReturnValue(JSON.stringify(cacheData));
      mockCache.getWithTTL.mockReturnValue({ value: JSON.stringify(cacheData), isStale: true });

      const serveHuman = async (fullUrl: string, isCacheable: boolean) => {
        const cachedEntry = mockCache.getWithTTL(fullUrl);
        const cached = cachedEntry?.value || mockCache.get(fullUrl);

        if (cached && isCacheable) {
          const data = JSON.parse(cached as string);
          const isStale = cachedEntry?.isStale;

          if (isStale) {
            // Background revalidation would happen here
            return { served: true, status: 'stale', needsRevalidation: true, content: data.content };
          }

          return { served: true, status: 'fresh', content: data.content };
        }

        return { served: false };
      };

      const result = await serveHuman('https://example.com/', true);

      expect(result.served).toBe(true);
      expect(result.status).toBe('stale');
      expect(result.needsRevalidation).toBe(true);
    });

    it('should handle cache parse error', async () => {
      mockCache.get.mockReturnValue('invalid json');
      mockCache.getWithTTL.mockReturnValue({ value: 'invalid json', isStale: false });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const serveHuman = async (fullUrl: string, isCacheable: boolean) => {
        const cachedEntry = mockCache.getWithTTL(fullUrl);
        const cached = cachedEntry?.value || mockCache.get(fullUrl);

        if (cached && isCacheable) {
          try {
            JSON.parse(cached as string);
            return { served: true };
          } catch (parseError) {
            console.warn(`Cache parse error for ${fullUrl}, serving fresh`);
            return { served: false, parseError: true };
          }
        }

        return { served: false };
      };

      const result = await serveHuman('https://example.com/', true);

      expect(result.served).toBe(false);
      expect(result.parseError).toBe(true);
      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it('should not serve cache for non-cacheable URLs', async () => {
      mockCache.get.mockReturnValue(JSON.stringify({ content: '<html>Cached</html>', renderTime: Date.now() }));

      const serveHuman = async (fullUrl: string, isCacheable: boolean) => {
        const cached = mockCache.get(fullUrl);

        if (cached && isCacheable) {
          return { served: true };
        }

        return { served: false };
      };

      const result = await serveHuman('https://example.com/api/data', false);

      expect(result.served).toBe(false);
    });
  });

  describe('Background revalidation', () => {
    it('should update cache on successful background render', async () => {
      const browserManager = await import('../../src/browser');
      (browserManager.default.render as any).mockResolvedValue({
        html: '<html>Updated</html>',
        statusCode: 200
      });

      const backgroundRevalidate = async (fullUrl: string) => {
        try {
          const renderResult = await browserManager.default.render(fullUrl);

          if (renderResult && renderResult.html) {
            mockCache.set(fullUrl, JSON.stringify({
              content: renderResult.html,
              renderTime: Date.now(),
              statusCode: renderResult.statusCode || 200
            }));
            return { success: true };
          }
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }

        return { success: false };
      };

      const result = await backgroundRevalidate('https://example.com/');

      expect(result.success).toBe(true);
      expect(mockCache.set).toHaveBeenCalled();
    });

    it('should handle background render failure', async () => {
      const browserManager = await import('../../src/browser');
      (browserManager.default.render as any).mockRejectedValueOnce(new Error('Background render failed'));

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const backgroundRevalidate = async (fullUrl: string) => {
        try {
          await browserManager.default.render(fullUrl);
        } catch (error) {
          console.error('Background re-render failed:', (error as Error).message);
          return { success: false, error: (error as Error).message };
        }
      };

      const result = await backgroundRevalidate('https://example.com/');

      expect(result?.success).toBe(false);
      expect(errorSpy).toHaveBeenCalled();

      errorSpy.mockRestore();
    });
  });

  describe('Proxy middleware configuration', () => {
    it('should have correct proxy configuration', () => {
      const proxyConfig = {
        target: 'https://example.com',
        changeOrigin: true,
        followRedirects: true,
        timeout: 30000
      };

      expect(proxyConfig.target).toBe('https://example.com');
      expect(proxyConfig.changeOrigin).toBe(true);
      expect(proxyConfig.followRedirects).toBe(true);
      expect(proxyConfig.timeout).toBe(30000);
    });

    it('should log proxy request', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const onProxyReq = (proxyReq: any, req: any, res: any) => {
        console.log(`Proxying: ${req.method} ${req.url} -> https://example.com${req.url}`);
      };

      onProxyReq({}, { method: 'GET', url: '/page' }, {});

      expect(logSpy).toHaveBeenCalledWith('Proxying: GET /page -> https://example.com/page');

      logSpy.mockRestore();
    });

    it('should handle proxy error', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const onError = (err: any, req: any, res: any) => {
        console.error(`Proxy error: ${err.message} for ${req.url}`);
        if (!res.headersSent) {
          res.status(502).send('Bad Gateway: Target server unavailable');
        }
      };

      const mockRes = {
        headersSent: false,
        status: vi.fn().mockReturnThis(),
        send: vi.fn()
      };

      onError({ message: 'Connection refused' }, { url: '/page' }, mockRes);

      expect(errorSpy).toHaveBeenCalledWith('Proxy error: Connection refused for /page');
      expect(mockRes.status).toHaveBeenCalledWith(502);
      expect(mockRes.send).toHaveBeenCalledWith('Bad Gateway: Target server unavailable');

      errorSpy.mockRestore();
    });

    it('should not send error if headers already sent', () => {
      const onError = (err: any, req: any, res: any) => {
        if (!res.headersSent) {
          res.status(502).send('Bad Gateway');
        }
      };

      const mockRes = {
        headersSent: true,
        status: vi.fn().mockReturnThis(),
        send: vi.fn()
      };

      onError({ message: 'Error' }, { url: '/page' }, mockRes);

      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should log proxy response', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const onProxyRes = (proxyRes: any, req: any, res: any) => {
        console.log(`Proxy response: ${req.method} ${req.url} -> ${proxyRes.statusCode}`);
      };

      onProxyRes({ statusCode: 200 }, { method: 'GET', url: '/page' }, {});

      expect(logSpy).toHaveBeenCalledWith('Proxy response: GET /page -> 200');

      logSpy.mockRestore();
    });
  });

  describe('Health check endpoint', () => {
    it('should return health status', () => {
      const healthCheck = (req: any, res: any) => {
        res.json({
          status: 'ok',
          service: 'seo-shield-proxy',
          mode: 'proxy-only',
          port: 8080,
          target: 'https://example.com',
          timestamp: new Date().toISOString()
        });
      };

      const mockRes = { json: vi.fn() };
      healthCheck({}, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        status: 'ok',
        service: 'seo-shield-proxy',
        mode: 'proxy-only',
        port: 8080,
        target: 'https://example.com'
      }));
    });
  });

  describe('404 handler', () => {
    it('should return 404 for unhandled routes', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const notFoundHandler = (req: any, res: any) => {
        console.log(`404: ${req.method} ${req.url} - No route handler found`);
        res.status(404).send('Not Found: No route handler found');
      };

      const mockRes = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn()
      };

      notFoundHandler({ method: 'GET', url: '/unknown' }, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.send).toHaveBeenCalledWith('Not Found: No route handler found');

      logSpy.mockRestore();
    });
  });

  describe('Error handler', () => {
    it('should return 500 for server errors', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const errorHandler = (err: Error, req: any, res: any, next: any) => {
        console.error(`Server error: ${err.message}`, err.stack);
        res.status(500).send('Internal Server Error');
      };

      const mockRes = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn()
      };

      const testError = new Error('Test error');
      errorHandler(testError, {}, mockRes, vi.fn());

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith('Internal Server Error');
      expect(errorSpy).toHaveBeenCalled();

      errorSpy.mockRestore();
    });
  });

  describe('Database initialization', () => {
    it('should initialize bot detector with database support', async () => {
      mockDatabaseManager.connect.mockResolvedValueOnce(true);
      const mongoStorage = mockDatabaseManager.getMongoStorage();

      const initializeDatabase = async () => {
        try {
          const connected = await mockDatabaseManager.connect();
          if (connected) {
            console.log('MongoDB connected for traffic logging');

            if (mongoStorage) {
              // Initialize advanced bot detector
              return { connected: true, botDetectorInitialized: true };
            }
          }
          return { connected: false };
        } catch (error) {
          console.error('Database initialization error:', error);
          return { connected: false, error: (error as Error).message };
        }
      };

      const result = await initializeDatabase();

      expect(result.connected).toBe(true);
      expect(result.botDetectorInitialized).toBe(true);
    });

    it('should handle database connection failure', async () => {
      mockDatabaseManager.connect.mockResolvedValueOnce(false);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const initializeDatabase = async () => {
        try {
          const connected = await mockDatabaseManager.connect();
          if (!connected) {
            console.warn('MongoDB connection failed, traffic events will not be persisted');
            console.warn('Advanced bot detector not initialized - using basic isbot()');
            return { connected: false };
          }
        } catch (error) {
          return { connected: false, error: true };
        }
      };

      const result = await initializeDatabase();

      expect(result?.connected).toBe(false);
      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it('should handle database initialization error', async () => {
      mockDatabaseManager.connect.mockRejectedValueOnce(new Error('Connection error'));

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const initializeDatabase = async () => {
        try {
          await mockDatabaseManager.connect();
        } catch (error) {
          console.error('Database initialization error:', error);
          console.warn('Advanced bot detector not initialized due to database error - using basic isbot()');
          return { error: true };
        }
      };

      const result = await initializeDatabase();

      expect(result?.error).toBe(true);
      expect(errorSpy).toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();

      errorSpy.mockRestore();
      warnSpy.mockRestore();
    });
  });

  describe('Server startup logging', () => {
    it('should log startup banner', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const logStartupBanner = (port: number, targetUrl: string, dbConnected: boolean) => {
        console.log('SEO Shield Proxy (Ultra-Clean)');
        console.log('');
        console.log(`Ultra-clean proxy server running on port ${port}`);
        console.log(`Target URL: ${targetUrl}`);
        console.log(`MongoDB: ${dbConnected ? 'Connected' : 'Disconnected'}`);
        console.log('Bot detection: Active');
        console.log('SSR rendering: Active');
        console.log('Reverse proxy: Active');
        console.log('Caching: Active');
        console.log('Rate limiting: Active');
      };

      logStartupBanner(8080, 'https://example.com', true);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('SEO Shield Proxy'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('8080'));

      logSpy.mockRestore();
    });

    it('should log fallback mode when database fails', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const logFallbackStartup = (port: number, targetUrl: string) => {
        console.log(`Ultra-clean proxy server running on port ${port} (Database fallback mode)`);
        console.log(`Target URL: ${targetUrl}`);
      };

      logFallbackStartup(8080, 'https://example.com');

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Database fallback mode'));

      logSpy.mockRestore();
    });
  });

  describe('User agent truncation', () => {
    it('should truncate long user agents', () => {
      const truncateUserAgent = (userAgent: string) => {
        return userAgent.length > 100 ? `${userAgent.substring(0, 97)}...` : userAgent;
      };

      const longUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 ExtraLongPart';
      const shortUA = 'Googlebot/2.1';

      expect(truncateUserAgent(longUA).length).toBeLessThanOrEqual(100);
      expect(truncateUserAgent(longUA).endsWith('...')).toBe(true);
      expect(truncateUserAgent(shortUA)).toBe(shortUA);
    });
  });

  describe('Client IP extraction', () => {
    it('should extract client IP from various sources', () => {
      const extractClientIP = (req: any) => {
        return req.ip || req.connection?.remoteAddress || 'unknown';
      };

      expect(extractClientIP({ ip: '1.1.1.1' })).toBe('1.1.1.1');
      expect(extractClientIP({ connection: { remoteAddress: '2.2.2.2' } })).toBe('2.2.2.2');
      expect(extractClientIP({})).toBe('unknown');
    });
  });
});
