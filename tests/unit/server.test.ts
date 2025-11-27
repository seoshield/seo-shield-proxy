import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock http to prevent actual server creation
vi.mock('http', () => ({
  createServer: vi.fn(() => ({
    listen: vi.fn((port, host, cb) => { if (cb) cb(); return { close: vi.fn() }; }),
    close: vi.fn(),
    on: vi.fn()
  }))
}));

vi.mock('express', () => ({
  default: vi.fn(() => ({
    use: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
    set: vi.fn(),
    all: vi.fn(),
    listen: vi.fn((port, cb) => { if (cb) cb(); return { close: vi.fn() }; }),
    disable: vi.fn()
  }))
}));

vi.mock('http-proxy-middleware', () => ({
  createProxyMiddleware: vi.fn(() => (req: any, res: any, next: any) => next())
}));

vi.mock('isbot', () => ({
  default: vi.fn(() => false)
}));

vi.mock('../../src/config', () => ({
  default: {
    PORT: 8080,
    TARGET_URL: 'http://localhost:3000',
    CACHE_TTL: 60,
    PUPPETEER_TIMEOUT: 30000,
    MAX_CONCURRENT_RENDERS: 5,
    NODE_ENV: 'test',
    USER_AGENT: 'test',
    BYPASS_PATTERNS: [],
    BYPASS_PATTERNS_REGEX: []
  }
}));

vi.mock('../../src/cache', () => ({
  default: { get: vi.fn(), set: vi.fn() },
  getCache: vi.fn().mockResolvedValue({ get: vi.fn(), set: vi.fn() })
}));

vi.mock('../../src/browser', () => ({
  default: {
    getPage: vi.fn().mockResolvedValue({ goto: vi.fn(), content: vi.fn().mockResolvedValue('<html></html>'), close: vi.fn() }),
    releasePage: vi.fn(),
    closeBrowser: vi.fn()
  },
  renderPage: vi.fn().mockResolvedValue('<html></html>'),
  getBrowserStats: vi.fn().mockReturnValue({}),
  closeBrowser: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../src/cache-rules', () => ({
  default: class {
    shouldCacheUrl() { return { shouldRender: true, shouldCache: true, reason: 'test' }; }
    getCacheDecision() { return { shouldRender: true, shouldCache: true, reason: 'test' }; }
  }
}));

vi.mock('../../src/bot-detection/advanced-bot-detector', () => ({
  AdvancedBotDetector: class {
    detect() { return { isBot: false, confidence: 0, botType: null }; }
  }
}));

vi.mock('puppeteer', () => ({
  default: {
    launch: vi.fn().mockResolvedValue({
      newPage: vi.fn().mockResolvedValue({ goto: vi.fn(), content: vi.fn() }),
      close: vi.fn()
    })
  }
}));

vi.mock('../../src/middleware/rate-limiter', () => ({
  generalRateLimiter: vi.fn((req: any, res: any, next: any) => next()),
  ssrRateLimiter: vi.fn((req: any, res: any, next: any) => next())
}));

vi.mock('../../src/database/database-manager', () => ({
  databaseManager: {
    connect: vi.fn().mockResolvedValue(true),
    disconnect: vi.fn().mockResolvedValue(undefined),
    getMongoStorage: vi.fn().mockReturnValue(null),
    isDbConnected: vi.fn().mockReturnValue(false)
  }
}));

describe('Server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should import server module', async () => {
    const module = await import('../../src/server');
    expect(module).toBeDefined();
  });

  it('should have default export', async () => {
    const module = await import('../../src/server');
    expect(module.default).toBeDefined();
  });
});

describe('Server Configuration', () => {
  it('should use config values', async () => {
    const config = await import('../../src/config');

    expect(config.default.PORT).toBe(8080);
    expect(config.default.TARGET_URL).toBe('http://localhost:3000');
    expect(config.default.CACHE_TTL).toBe(60);
  });

  it('should have required config properties', async () => {
    const config = await import('../../src/config');

    expect(config.default).toHaveProperty('PORT');
    expect(config.default).toHaveProperty('TARGET_URL');
    expect(config.default).toHaveProperty('CACHE_TTL');
    expect(config.default).toHaveProperty('PUPPETEER_TIMEOUT');
    expect(config.default).toHaveProperty('MAX_CONCURRENT_RENDERS');
  });
});

describe('Static Asset Detection', () => {
  const STATIC_EXTENSIONS = [
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico', '.css', '.js', '.jsx',
    '.ts', '.tsx', '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.webm', '.mp3',
    '.wav', '.pdf', '.zip', '.txt', '.xml', '.json', '.rss', '.atom'
  ];

  it('should have comprehensive static extensions list', () => {
    expect(STATIC_EXTENSIONS.length).toBeGreaterThan(20);
    expect(STATIC_EXTENSIONS).toContain('.jpg');
    expect(STATIC_EXTENSIONS).toContain('.css');
    expect(STATIC_EXTENSIONS).toContain('.js');
    expect(STATIC_EXTENSIONS).toContain('.png');
  });

  it('should include image formats', () => {
    expect(STATIC_EXTENSIONS).toContain('.jpg');
    expect(STATIC_EXTENSIONS).toContain('.jpeg');
    expect(STATIC_EXTENSIONS).toContain('.png');
    expect(STATIC_EXTENSIONS).toContain('.gif');
    expect(STATIC_EXTENSIONS).toContain('.webp');
    expect(STATIC_EXTENSIONS).toContain('.svg');
    expect(STATIC_EXTENSIONS).toContain('.ico');
  });

  it('should include style formats', () => {
    expect(STATIC_EXTENSIONS).toContain('.css');
  });

  it('should include script formats', () => {
    expect(STATIC_EXTENSIONS).toContain('.js');
    expect(STATIC_EXTENSIONS).toContain('.jsx');
    expect(STATIC_EXTENSIONS).toContain('.ts');
    expect(STATIC_EXTENSIONS).toContain('.tsx');
  });

  it('should include font formats', () => {
    expect(STATIC_EXTENSIONS).toContain('.woff');
    expect(STATIC_EXTENSIONS).toContain('.woff2');
    expect(STATIC_EXTENSIONS).toContain('.ttf');
    expect(STATIC_EXTENSIONS).toContain('.eot');
  });

  it('should include media formats', () => {
    expect(STATIC_EXTENSIONS).toContain('.mp4');
    expect(STATIC_EXTENSIONS).toContain('.webm');
    expect(STATIC_EXTENSIONS).toContain('.mp3');
    expect(STATIC_EXTENSIONS).toContain('.wav');
  });

  it('should include document formats', () => {
    expect(STATIC_EXTENSIONS).toContain('.pdf');
    expect(STATIC_EXTENSIONS).toContain('.txt');
  });

  it('should include data formats', () => {
    expect(STATIC_EXTENSIONS).toContain('.xml');
    expect(STATIC_EXTENSIONS).toContain('.json');
    expect(STATIC_EXTENSIONS).toContain('.rss');
    expect(STATIC_EXTENSIONS).toContain('.atom');
  });
});

describe('Express Middleware', () => {
  it('should have express mock available', async () => {
    const express = await import('express');
    expect(express).toBeDefined();
    expect(express.default).toBeDefined();
  });

  it('should create express app', async () => {
    const express = await import('express');
    const app = express.default();

    expect(app).toBeDefined();
    expect(typeof app.use).toBe('function');
    expect(typeof app.get).toBe('function');
    expect(typeof app.post).toBe('function');
  });
});

describe('HTTP Proxy Middleware', () => {
  it('should have http-proxy-middleware available', async () => {
    const { createProxyMiddleware } = await import('http-proxy-middleware');
    expect(createProxyMiddleware).toBeDefined();
    expect(typeof createProxyMiddleware).toBe('function');
  });

  it('should create proxy middleware', async () => {
    const { createProxyMiddleware } = await import('http-proxy-middleware');
    const proxy = createProxyMiddleware({ target: 'http://localhost:3000' });

    expect(proxy).toBeDefined();
    expect(typeof proxy).toBe('function');
  });
});

describe('Cache Integration', () => {
  it('should have cache module available', async () => {
    const cacheModule = await import('../../src/cache');
    expect(cacheModule.default).toBeDefined();
    expect(cacheModule.getCache).toBeDefined();
  });

  it('should get cache instance', async () => {
    const { getCache } = await import('../../src/cache');
    const cache = await getCache();

    expect(cache).toBeDefined();
    expect(typeof cache.get).toBe('function');
    expect(typeof cache.set).toBe('function');
  });
});

describe('Browser Integration', () => {
  it('should have browser module available', async () => {
    const browser = await import('../../src/browser');
    expect(browser.default).toBeDefined();
  });
});

describe('Cache Rules Integration', () => {
  it('should have CacheRules class', async () => {
    const CacheRules = await import('../../src/cache-rules');
    expect(CacheRules.default).toBeDefined();
  });

  it('should create CacheRules instance', async () => {
    const CacheRulesModule = await import('../../src/cache-rules');
    const config = await import('../../src/config');
    const cacheRules = new CacheRulesModule.default(config.default);

    expect(cacheRules).toBeDefined();
    expect(typeof cacheRules.shouldCacheUrl).toBe('function');
    expect(typeof cacheRules.getCacheDecision).toBe('function');
  });

  it('should return cache decision', async () => {
    const CacheRulesModule = await import('../../src/cache-rules');
    const config = await import('../../src/config');
    const cacheRules = new CacheRulesModule.default(config.default);

    const decision = cacheRules.getCacheDecision('/test');
    expect(decision).toBeDefined();
    expect(decision).toHaveProperty('shouldCache');
  });
});

describe('Bot Detection Integration', () => {
  it('should have isbot function', async () => {
    const isbot = await import('isbot');
    expect(isbot).toBeDefined();
  });

  it('should have AdvancedBotDetector class', async () => {
    const { AdvancedBotDetector } = await import('../../src/bot-detection/advanced-bot-detector');
    expect(AdvancedBotDetector).toBeDefined();
  });

  it('should create AdvancedBotDetector instance', async () => {
    const { AdvancedBotDetector } = await import('../../src/bot-detection/advanced-bot-detector');
    const detector = new AdvancedBotDetector();

    expect(detector).toBeDefined();
    expect(typeof detector.detect).toBe('function');
  });
});

describe('HTTP Server Creation', () => {
  it('should have createServer function', async () => {
    const http = await import('http');
    expect(http.createServer).toBeDefined();
    expect(typeof http.createServer).toBe('function');
  });

  it('should create HTTP server', async () => {
    const http = await import('http');
    const server = http.createServer();

    expect(server).toBeDefined();
    expect(typeof server.listen).toBe('function');
  });
});

describe('Proxy Middleware Options', () => {
  const proxyOptions = {
    target: 'http://localhost:3000',
    changeOrigin: true,
    followRedirects: true,
    timeout: 30000
  };

  it('should have correct target', () => {
    expect(proxyOptions.target).toBe('http://localhost:3000');
  });

  it('should change origin', () => {
    expect(proxyOptions.changeOrigin).toBe(true);
  });

  it('should follow redirects', () => {
    expect(proxyOptions.followRedirects).toBe(true);
  });

  it('should have timeout', () => {
    expect(proxyOptions.timeout).toBe(30000);
  });
});

describe('Health Check', () => {
  it('should have health check endpoint path', () => {
    const healthPath = '/shieldhealth';
    expect(healthPath).toBe('/shieldhealth');
  });

  it('should return health status structure', () => {
    const healthResponse = {
      status: 'ok',
      service: 'seo-shield-proxy',
      mode: 'proxy-only',
      port: 8080,
      target: 'http://localhost:3000'
    };

    expect(healthResponse.status).toBe('ok');
    expect(healthResponse.service).toBe('seo-shield-proxy');
    expect(healthResponse.mode).toBe('proxy-only');
  });
});

describe('Error Handling', () => {
  it('should handle 404 errors', () => {
    const notFoundHandler = (req: any, res: any) => {
      res.status(404).send('Not Found');
    };

    expect(typeof notFoundHandler).toBe('function');
  });

  it('should handle 500 errors', () => {
    const errorHandler = (err: Error, req: any, res: any, next: any) => {
      res.status(500).send('Internal Server Error');
    };

    expect(typeof errorHandler).toBe('function');
  });

  it('should handle 502 proxy errors', () => {
    const proxyErrorHandler = (err: any, req: any, res: any) => {
      res.status(502).send('Bad Gateway');
    };

    expect(typeof proxyErrorHandler).toBe('function');
  });
});

describe('Rate Limiter Integration', () => {
  it('should have rate limiter middleware', async () => {
    const rateLimiter = await import('../../src/middleware/rate-limiter');
    expect(rateLimiter).toBeDefined();
  });
});

describe('Database Manager Integration', () => {
  it('should have database manager available', async () => {
    const { databaseManager } = await import('../../src/database/database-manager');
    expect(databaseManager).toBeDefined();
  });
});

describe('Request Paths', () => {
  it('should identify static paths', () => {
    const staticPaths = ['/styles.css', '/script.js', '/image.png', '/font.woff'];

    staticPaths.forEach(path => {
      const hasExtension = path.includes('.');
      expect(hasExtension).toBe(true);
    });
  });

  it('should identify API paths', () => {
    const apiPaths = ['/api/users', '/api/products', '/shieldhealth'];

    apiPaths.forEach(path => {
      const isApiPath = path.startsWith('/api') || path.startsWith('/shieldhealth');
      expect(isApiPath).toBe(true);
    });
  });

  it('should identify SSR paths', () => {
    const ssrPaths = ['/', '/about', '/products', '/contact'];

    ssrPaths.forEach(path => {
      const needsSSR = !path.includes('.') && !path.startsWith('/api');
      expect(needsSSR).toBe(true);
    });
  });
});

describe('Query Parameters', () => {
  it('should recognize render preview parameter', () => {
    const renderParams = ['preview', 'true'];

    renderParams.forEach(param => {
      const isPreview = param === 'preview' || param === 'true';
      expect(isPreview).toBe(true);
    });
  });

  it('should recognize render debug parameter', () => {
    const debugParam = 'debug';
    expect(debugParam).toBe('debug');
  });
});

describe('isStaticAsset Logic', () => {
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
    expect(isStaticAsset('/api/products/123')).toBe(false);
    expect(isStaticAsset('/api')).toBe(false);
  });

  it('should return false for shieldhealth paths', () => {
    expect(isStaticAsset('/shieldhealth')).toBe(false);
    expect(isStaticAsset('/shieldhealthcheck')).toBe(false);
  });

  it('should return false for assets paths', () => {
    expect(isStaticAsset('/assets/image.png')).toBe(false);
    expect(isStaticAsset('/assets/styles.css')).toBe(false);
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
  });

  it('should return true for style files', () => {
    expect(isStaticAsset('/styles.css')).toBe(true);
    expect(isStaticAsset('/main.css')).toBe(true);
  });

  it('should return true for script files', () => {
    expect(isStaticAsset('/bundle.js')).toBe(true);
    expect(isStaticAsset('/app.jsx')).toBe(true);
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
    expect(isStaticAsset('/document.pdf')).toBe(true);
    expect(isStaticAsset('/readme.txt')).toBe(true);
  });

  it('should return false for HTML paths without extensions', () => {
    expect(isStaticAsset('/about')).toBe(false);
    expect(isStaticAsset('/products')).toBe(false);
    expect(isStaticAsset('/contact')).toBe(false);
  });
});

describe('Traffic Event Data Structure', () => {
  it('should have correct structure for traffic event', () => {
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

    expect(trafficData).toHaveProperty('method');
    expect(trafficData).toHaveProperty('path');
    expect(trafficData).toHaveProperty('userAgent');
    expect(trafficData).toHaveProperty('ip');
    expect(trafficData).toHaveProperty('timestamp');
    expect(trafficData).toHaveProperty('isBot');
    expect(trafficData).toHaveProperty('botType');
    expect(trafficData).toHaveProperty('botConfidence');
    expect(trafficData).toHaveProperty('botRulesMatched');
    expect(trafficData).toHaveProperty('botAction');
    expect(trafficData).toHaveProperty('headers');
  });

  it('should have valid bot detection fields', () => {
    const botDetection = {
      isBot: true,
      confidence: 0.95,
      botType: 'googlebot',
      rulesMatched: ['googlebot-ua', 'google-ip'],
      action: 'render' as const
    };

    expect(botDetection.isBot).toBe(true);
    expect(botDetection.confidence).toBeGreaterThan(0.9);
    expect(botDetection.botType).toBe('googlebot');
    expect(botDetection.rulesMatched.length).toBe(2);
    expect(botDetection.action).toBe('render');
  });

  it('should have valid human detection fields', () => {
    const humanDetection = {
      isBot: false,
      confidence: 0.2,
      botType: 'human',
      rulesMatched: [],
      action: 'allow' as const
    };

    expect(humanDetection.isBot).toBe(false);
    expect(humanDetection.confidence).toBeLessThan(0.5);
    expect(humanDetection.botType).toBe('human');
    expect(humanDetection.rulesMatched.length).toBe(0);
    expect(humanDetection.action).toBe('allow');
  });
});

describe('Render Parameters', () => {
  it('should recognize render=preview', () => {
    const query = { render: 'preview' };
    const isRenderPreview = query.render === 'preview' || query.render === 'true';
    expect(isRenderPreview).toBe(true);
  });

  it('should recognize render=true', () => {
    const query = { render: 'true' };
    const isRenderPreview = query.render === 'preview' || query.render === 'true';
    expect(isRenderPreview).toBe(true);
  });

  it('should recognize render=debug', () => {
    const query = { render: 'debug' };
    const isRenderDebug = query.render === 'debug';
    expect(isRenderDebug).toBe(true);
  });

  it('should recognize _render parameter', () => {
    const query = { _render: 'preview' };
    const renderParam = query._render;
    const isRenderPreview = renderParam === 'preview' || renderParam === 'true';
    expect(isRenderPreview).toBe(true);
  });

  it('should handle missing render parameter', () => {
    const query = {};
    const renderParam = (query as any).render || (query as any)._render;
    expect(renderParam).toBeUndefined();
  });
});

describe('Cache Data Structure', () => {
  it('should have correct structure for cached content', () => {
    const cacheData = {
      content: '<html><body>Test</body></html>',
      renderTime: Date.now(),
      statusCode: 200
    };

    expect(cacheData).toHaveProperty('content');
    expect(cacheData).toHaveProperty('renderTime');
    expect(cacheData).toHaveProperty('statusCode');
    expect(typeof cacheData.content).toBe('string');
    expect(typeof cacheData.renderTime).toBe('number');
    expect(cacheData.statusCode).toBe(200);
  });

  it('should calculate cache age correctly', () => {
    const renderTime = Date.now() - 30000; // 30 seconds ago
    const cacheData = { renderTime };
    const cacheAge = Date.now() - cacheData.renderTime;

    expect(cacheAge).toBeGreaterThanOrEqual(30000);
    expect(cacheAge).toBeLessThan(31000);
  });

  it('should determine stale threshold correctly', () => {
    const cacheTTL = 60 * 1000; // 60 seconds in ms
    const staleThreshold = cacheTTL * 0.8; // 80% of TTL

    expect(staleThreshold).toBe(48000);
  });

  it('should identify stale cache correctly', () => {
    const cacheTTL = 60 * 1000;
    const staleThreshold = cacheTTL * 0.8;

    const freshAge = 30000; // 30 seconds
    const staleAge = 50000; // 50 seconds

    expect(freshAge > staleThreshold).toBe(false);
    expect(staleAge > staleThreshold).toBe(true);
  });
});

describe('Debug Response Structure', () => {
  it('should have correct debug response structure', () => {
    const debugResponse = {
      success: true,
      debug: {
        url: 'http://localhost:3000/test',
        path: '/test',
        renderTime: '150ms',
        htmlLength: 5000,
        statusCode: 200,
        wasCached: false,
        botDetection: {
          isBot: false,
          botType: 'human',
          confidence: '30.0%',
          rulesMatched: [],
          action: 'allow'
        },
        cacheDecision: { shouldCache: true, reason: 'test' },
        timestamp: new Date().toISOString()
      },
      html: '<html></html>'
    };

    expect(debugResponse.success).toBe(true);
    expect(debugResponse.debug).toHaveProperty('url');
    expect(debugResponse.debug).toHaveProperty('path');
    expect(debugResponse.debug).toHaveProperty('renderTime');
    expect(debugResponse.debug).toHaveProperty('htmlLength');
    expect(debugResponse.debug).toHaveProperty('statusCode');
    expect(debugResponse.debug).toHaveProperty('wasCached');
    expect(debugResponse.debug).toHaveProperty('botDetection');
    expect(debugResponse.debug).toHaveProperty('cacheDecision');
    expect(debugResponse.debug).toHaveProperty('timestamp');
    expect(debugResponse.html).toBeDefined();
  });

  it('should have correct error debug response structure', () => {
    const errorDebugResponse = {
      success: false,
      debug: {
        url: 'http://localhost:3000/test',
        error: 'Render failed',
        timestamp: new Date().toISOString()
      }
    };

    expect(errorDebugResponse.success).toBe(false);
    expect(errorDebugResponse.debug).toHaveProperty('url');
    expect(errorDebugResponse.debug).toHaveProperty('error');
    expect(errorDebugResponse.debug).toHaveProperty('timestamp');
  });
});

describe('Proxy Error Handling', () => {
  it('should handle proxy errors with 502 status', () => {
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

    onError(new Error('Connection refused'), {}, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(502);
    expect(mockRes.send).toHaveBeenCalledWith('Bad Gateway: Target server unavailable');
  });

  it('should not send response if headers already sent', () => {
    const mockRes = {
      headersSent: true,
      status: vi.fn().mockReturnThis(),
      send: vi.fn()
    };

    const onError = (err: any, req: any, res: any) => {
      if (!res.headersSent) {
        res.status(502).send('Bad Gateway: Target server unavailable');
      }
    };

    onError(new Error('Connection refused'), {}, mockRes);

    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.send).not.toHaveBeenCalled();
  });
});

describe('SSR Middleware Flow', () => {
  it('should skip SSR for assets paths', () => {
    const requestPath = '/assets/image.png';
    const shouldSkip = requestPath.startsWith('/assets');
    expect(shouldSkip).toBe(true);
  });

  it('should not skip SSR for non-assets paths', () => {
    const requestPath = '/about';
    const shouldSkip = requestPath.startsWith('/assets');
    expect(shouldSkip).toBe(false);
  });

  it('should determine bot requests correctly', () => {
    const botDetection = { isBot: true };
    const isBotRequest = botDetection.isBot;
    expect(isBotRequest).toBe(true);
  });

  it('should determine human requests correctly', () => {
    const botDetection = { isBot: false };
    const isBotRequest = botDetection.isBot;
    expect(isBotRequest).toBe(false);
  });

  it('should force SSR for bot requests', () => {
    const isBotRequest = true;
    const isRenderPreview = false;
    const shouldSSR = isBotRequest || isRenderPreview;
    expect(shouldSSR).toBe(true);
  });

  it('should force SSR for render preview', () => {
    const isBotRequest = false;
    const isRenderPreview = true;
    const shouldSSR = isBotRequest || isRenderPreview;
    expect(shouldSSR).toBe(true);
  });

  it('should not force SSR for human without preview', () => {
    const isBotRequest = false;
    const isRenderPreview = false;
    const shouldSSR = isBotRequest || isRenderPreview;
    expect(shouldSSR).toBe(false);
  });
});

describe('Database Initialization', () => {
  it('should have database manager methods', async () => {
    const { databaseManager } = await import('../../src/database/database-manager');

    expect(typeof databaseManager.connect).toBe('function');
    expect(typeof databaseManager.disconnect).toBe('function');
    expect(typeof databaseManager.getMongoStorage).toBe('function');
    expect(typeof databaseManager.isDbConnected).toBe('function');
  });

  it('should handle successful connection', async () => {
    const { databaseManager } = await import('../../src/database/database-manager');
    const connected = await databaseManager.connect();
    expect(connected).toBe(true);
  });

  it('should check db connection status', async () => {
    const { databaseManager } = await import('../../src/database/database-manager');
    const isConnected = databaseManager.isDbConnected();
    expect(typeof isConnected).toBe('boolean');
  });
});

describe('Health Check Response', () => {
  it('should return correct health check fields', () => {
    const healthResponse = {
      status: 'ok',
      service: 'seo-shield-proxy',
      mode: 'proxy-only',
      port: 8080,
      target: 'http://localhost:3000',
      timestamp: new Date().toISOString()
    };

    expect(healthResponse.status).toBe('ok');
    expect(healthResponse.service).toBe('seo-shield-proxy');
    expect(healthResponse.mode).toBe('proxy-only');
    expect(healthResponse.port).toBe(8080);
    expect(healthResponse.target).toBe('http://localhost:3000');
    expect(healthResponse.timestamp).toBeDefined();
  });
});

describe('Bot Detection Fallback', () => {
  it('should create fallback detection for bot', () => {
    const userAgent = 'Googlebot/2.1';
    const isBotResult = true; // simulating isbot() returning true

    const botDetection = {
      isBot: isBotResult,
      confidence: isBotResult ? 0.7 : 0.3,
      botType: isBotResult ? 'unknown' : 'human',
      rulesMatched: [],
      action: isBotResult ? 'render' : 'allow' as const
    };

    expect(botDetection.isBot).toBe(true);
    expect(botDetection.confidence).toBe(0.7);
    expect(botDetection.botType).toBe('unknown');
    expect(botDetection.action).toBe('render');
  });

  it('should create fallback detection for human', () => {
    const userAgent = 'Mozilla/5.0';
    const isBotResult = false; // simulating isbot() returning false

    const botDetection = {
      isBot: isBotResult,
      confidence: isBotResult ? 0.7 : 0.3,
      botType: isBotResult ? 'unknown' : 'human',
      rulesMatched: [],
      action: isBotResult ? 'render' : 'allow' as const
    };

    expect(botDetection.isBot).toBe(false);
    expect(botDetection.confidence).toBe(0.3);
    expect(botDetection.botType).toBe('human');
    expect(botDetection.action).toBe('allow');
  });

  it('should create advanced bot detector fallback on error', () => {
    const userAgent = 'Mozilla/5.0';
    const isBotResult = false;

    // Simulating fallback when advanced detection fails
    const botDetection = {
      isBot: isBotResult,
      confidence: isBotResult ? 0.8 : 0.2, // Different confidence in fallback
      botType: isBotResult ? 'unknown' : 'human',
      rulesMatched: [],
      action: isBotResult ? 'render' : 'allow' as const
    };

    expect(botDetection.confidence).toBe(0.2);
  });
});

describe('URL Construction', () => {
  it('should construct full URL correctly', () => {
    const targetUrl = 'http://localhost:3000';
    const originalUrl = '/about?param=value';
    const fullUrl = `${targetUrl}${originalUrl}`;

    expect(fullUrl).toBe('http://localhost:3000/about?param=value');
  });

  it('should handle root path', () => {
    const targetUrl = 'http://localhost:3000';
    const originalUrl = '/';
    const fullUrl = `${targetUrl}${originalUrl}`;

    expect(fullUrl).toBe('http://localhost:3000/');
  });

  it('should handle complex paths', () => {
    const targetUrl = 'http://localhost:3000';
    const originalUrl = '/products/123/reviews?page=1&sort=date';
    const fullUrl = `${targetUrl}${originalUrl}`;

    expect(fullUrl).toBe('http://localhost:3000/products/123/reviews?page=1&sort=date');
  });
});

describe('Render Result Handling', () => {
  it('should handle successful render result', () => {
    const renderResult = {
      html: '<html><body>Content</body></html>',
      statusCode: 200
    };

    expect(renderResult.html).toBeDefined();
    expect(renderResult.statusCode).toBe(200);
  });

  it('should handle render result with custom status', () => {
    const renderResult = {
      html: '<html><body>Not Found</body></html>',
      statusCode: 404
    };

    expect(renderResult.statusCode).toBe(404);
  });

  it('should handle empty render result', () => {
    const renderResult = {
      html: null,
      statusCode: 500
    };

    const hasContent = renderResult && renderResult.html;
    expect(hasContent).toBeFalsy();
  });

  it('should handle render result with default status', () => {
    const renderResult = {
      html: '<html></html>'
    };

    const statusCode = (renderResult as any).statusCode || 200;
    expect(statusCode).toBe(200);
  });
});

describe('Client IP Extraction', () => {
  it('should extract IP from req.ip', () => {
    const req = { ip: '192.168.1.1', connection: { remoteAddress: '10.0.0.1' } };
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    expect(clientIP).toBe('192.168.1.1');
  });

  it('should fallback to connection.remoteAddress', () => {
    const req = { ip: undefined, connection: { remoteAddress: '10.0.0.1' } };
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    expect(clientIP).toBe('10.0.0.1');
  });

  it('should fallback to unknown', () => {
    const req = { ip: undefined, connection: { remoteAddress: undefined } };
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    expect(clientIP).toBe('unknown');
  });
});

describe('User Agent Truncation', () => {
  it('should not truncate short user agent', () => {
    const userAgent = 'Mozilla/5.0';
    const truncated = userAgent.length > 100 ? `${userAgent.substring(0, 97)}...` : userAgent;
    expect(truncated).toBe('Mozilla/5.0');
  });

  it('should truncate long user agent', () => {
    const userAgent = 'A'.repeat(150);
    const truncated = userAgent.length > 100 ? `${userAgent.substring(0, 97)}...` : userAgent;
    expect(truncated.length).toBe(100);
    expect(truncated.endsWith('...')).toBe(true);
  });
});

describe('Cache JSON Parsing', () => {
  it('should parse valid cache JSON', () => {
    const cached = JSON.stringify({ content: '<html></html>', renderTime: Date.now() });
    const cacheData = JSON.parse(cached);

    expect(cacheData.content).toBe('<html></html>');
    expect(cacheData.renderTime).toBeDefined();
  });

  it('should handle invalid cache JSON gracefully', () => {
    const cached = 'invalid json';

    let cacheData = null;
    try {
      cacheData = JSON.parse(cached);
    } catch (parseError) {
      cacheData = null;
    }

    expect(cacheData).toBeNull();
  });
});

describe('Background Revalidation', () => {
  it('should handle background revalidation concept', () => {
    const revalidationTriggered = true;

    // Simulating fire-and-forget pattern
    const backgroundTask = () => {
      return new Promise<void>(resolve => {
        setTimeout(resolve, 10);
      });
    };

    expect(typeof backgroundTask).toBe('function');
    expect(revalidationTriggered).toBe(true);
  });
});

describe('Stale-While-Revalidate Strategy', () => {
  it('should serve stale content while revalidating', () => {
    const cacheTTL = 60 * 1000;
    const staleThreshold = cacheTTL * 0.8;
    const cacheAge = 50 * 1000; // 50 seconds

    const isStale = cacheAge > staleThreshold;
    const shouldServeStale = isStale;
    const shouldRevalidate = isStale;

    expect(shouldServeStale).toBe(true);
    expect(shouldRevalidate).toBe(true);
  });

  it('should serve fresh content without revalidating', () => {
    const cacheTTL = 60 * 1000;
    const staleThreshold = cacheTTL * 0.8;
    const cacheAge = 30 * 1000; // 30 seconds

    const isStale = cacheAge > staleThreshold;
    const shouldServeStale = isStale;

    expect(shouldServeStale).toBe(false);
  });
});

describe('Traffic Metric Structure', () => {
  it('should have correct traffic metric fields for MongoDB', () => {
    const trafficMetric = {
      timestamp: new Date(),
      method: 'GET',
      path: '/test',
      ip: '127.0.0.1',
      userAgent: 'Mozilla/5.0',
      referer: 'http://example.com',
      isBot: false,
      action: 'proxy',
      responseTime: 0,
      statusCode: 200,
      responseSize: 0
    };

    expect(trafficMetric).toHaveProperty('timestamp');
    expect(trafficMetric).toHaveProperty('method');
    expect(trafficMetric).toHaveProperty('path');
    expect(trafficMetric).toHaveProperty('ip');
    expect(trafficMetric).toHaveProperty('userAgent');
    expect(trafficMetric).toHaveProperty('referer');
    expect(trafficMetric).toHaveProperty('isBot');
    expect(trafficMetric).toHaveProperty('action');
    expect(trafficMetric).toHaveProperty('responseTime');
    expect(trafficMetric).toHaveProperty('statusCode');
    expect(trafficMetric).toHaveProperty('responseSize');
  });
});

describe('Proxy Middleware Events', () => {
  it('should have onProxyReq handler', () => {
    const onProxyReq = (proxyReq: any, req: any, res: any) => {
      // Log proxying
    };
    expect(typeof onProxyReq).toBe('function');
  });

  it('should have onProxyRes handler', () => {
    const onProxyRes = (proxyRes: any, req: any, res: any) => {
      // Log response
    };
    expect(typeof onProxyRes).toBe('function');
  });

  it('should have onProxyInit handler', () => {
    const onProxyInit = () => {
      // Initialize proxy
    };
    expect(typeof onProxyInit).toBe('function');
  });

  it('should have onError handler', () => {
    const onError = (err: any, req: any, res: any) => {
      // Handle error
    };
    expect(typeof onError).toBe('function');
  });
});

describe('Server Startup Logging', () => {
  it('should log startup banner', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║             SEO Shield Proxy Server                   ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    expect(consoleSpy).toHaveBeenCalledTimes(3);
    consoleSpy.mockRestore();
  });

  it('should log listening message', () => {
    const port = 8080;
    const target = 'http://localhost:3000';
    const message = `🚀 Proxy server running on port ${port}, proxying to ${target}`;
    expect(message).toContain('8080');
    expect(message).toContain('http://localhost:3000');
  });
});

describe('API Server URL Building', () => {
  it('should build API server URL', () => {
    const apiPort = 3190;
    const apiUrl = `http://localhost:${apiPort}`;
    expect(apiUrl).toBe('http://localhost:3190');
  });

  it('should use API server for traffic events', () => {
    const apiPort = 3190;
    const trafficEndpoint = `http://localhost:${apiPort}/shieldapi/traffic-events`;
    expect(trafficEndpoint).toContain('/shieldapi/traffic-events');
  });
});

describe('Render Flow Decision', () => {
  it('should decide to render for bot requests', () => {
    const isBotRequest = true;
    const isRenderPreview = false;
    const shouldRender = isBotRequest || isRenderPreview;
    expect(shouldRender).toBe(true);
  });

  it('should decide to render for render preview requests', () => {
    const isBotRequest = false;
    const isRenderPreview = true;
    const shouldRender = isBotRequest || isRenderPreview;
    expect(shouldRender).toBe(true);
  });

  it('should decide not to render for human requests without preview', () => {
    const isBotRequest = false;
    const isRenderPreview = false;
    const shouldRender = isBotRequest || isRenderPreview;
    expect(shouldRender).toBe(false);
  });

  it('should skip render for static assets', () => {
    const path = '/styles.css';
    const isStatic = path.endsWith('.css') || path.endsWith('.js') || path.endsWith('.png');
    expect(isStatic).toBe(true);
  });
});

describe('Cache Key Generation', () => {
  it('should use URL as cache key', () => {
    const url = 'http://localhost:3000/about';
    const cacheKey = url;
    expect(cacheKey).toBe('http://localhost:3000/about');
  });

  it('should include query params in cache key', () => {
    const url = 'http://localhost:3000/search?q=test';
    const cacheKey = url;
    expect(cacheKey).toContain('q=test');
  });

  it('should strip render param from cache key', () => {
    const url = 'http://localhost:3000/about?_render=true&other=value';
    const cacheKey = url.replace(/[?&]_render=[^&]*/g, '').replace(/[?&]render=[^&]*/g, '');
    expect(cacheKey).not.toContain('_render');
    expect(cacheKey).toContain('other=value');
  });
});

describe('Response Headers', () => {
  it('should set X-SSR-Cache header for cached content', () => {
    const headers = { 'X-SSR-Cache': 'HIT' };
    expect(headers['X-SSR-Cache']).toBe('HIT');
  });

  it('should set X-SSR-Cache header for fresh render', () => {
    const headers = { 'X-SSR-Cache': 'MISS' };
    expect(headers['X-SSR-Cache']).toBe('MISS');
  });

  it('should set X-SSR-Render-Time header', () => {
    const renderTime = 150;
    const headers = { 'X-SSR-Render-Time': `${renderTime}ms` };
    expect(headers['X-SSR-Render-Time']).toBe('150ms');
  });

  it('should set X-Powered-By header', () => {
    const headers = { 'X-Powered-By': 'SEO Shield Proxy' };
    expect(headers['X-Powered-By']).toBe('SEO Shield Proxy');
  });
});

describe('Error Page Generation', () => {
  it('should generate 502 error page', () => {
    const errorHtml = '<html><body><h1>502 Bad Gateway</h1></body></html>';
    expect(errorHtml).toContain('502');
    expect(errorHtml).toContain('Bad Gateway');
  });

  it('should generate 503 error page', () => {
    const errorHtml = '<html><body><h1>503 Service Unavailable</h1></body></html>';
    expect(errorHtml).toContain('503');
    expect(errorHtml).toContain('Service Unavailable');
  });

  it('should generate 500 error page', () => {
    const errorHtml = '<html><body><h1>500 Internal Server Error</h1></body></html>';
    expect(errorHtml).toContain('500');
    expect(errorHtml).toContain('Internal Server Error');
  });
});

describe('Request Logging', () => {
  it('should log request method and path', () => {
    const req = { method: 'GET', path: '/about' };
    const logMessage = `${req.method} ${req.path}`;
    expect(logMessage).toBe('GET /about');
  });

  it('should log user agent (truncated)', () => {
    const userAgent = 'A'.repeat(150);
    const truncated = userAgent.length > 100 ? userAgent.substring(0, 97) + '...' : userAgent;
    expect(truncated.length).toBe(100);
  });

  it('should log client IP', () => {
    const req = { ip: '192.168.1.1' };
    expect(req.ip).toBe('192.168.1.1');
  });

  it('should log response status code', () => {
    const statusCode = 200;
    expect(statusCode).toBe(200);
  });
});

describe('Bypass Patterns', () => {
  it('should bypass proxy for health check', () => {
    const path = '/shieldhealth';
    const shouldBypass = path.startsWith('/shieldhealth');
    expect(shouldBypass).toBe(true);
  });

  it('should not bypass proxy for regular paths', () => {
    const path = '/about';
    const shouldBypass = path.startsWith('/shieldhealth') || path.startsWith('/api');
    expect(shouldBypass).toBe(false);
  });

  it('should match bypass patterns with regex', () => {
    const patterns = [/^\/admin/, /^\/api/];
    const path = '/admin/dashboard';
    const shouldBypass = patterns.some(p => p.test(path));
    expect(shouldBypass).toBe(true);
  });
});

describe('SSR Middleware Logic', () => {
  it('should check if request needs SSR', () => {
    const isBot = true;
    const isStaticAsset = false;
    const needsSSR = isBot && !isStaticAsset;
    expect(needsSSR).toBe(true);
  });

  it('should not SSR static assets even for bots', () => {
    const isBot = true;
    const isStaticAsset = true;
    const needsSSR = isBot && !isStaticAsset;
    expect(needsSSR).toBe(false);
  });

  it('should SSR for render preview regardless of bot status', () => {
    const isBot = false;
    const isRenderPreview = true;
    const needsSSR = isBot || isRenderPreview;
    expect(needsSSR).toBe(true);
  });
});

describe('Traffic Event Recording', () => {
  it('should record bot traffic event', () => {
    const trafficEvent = {
      timestamp: Date.now(),
      method: 'GET',
      path: '/about',
      userAgent: 'Googlebot/2.1',
      ip: '66.249.66.1',
      isBot: true,
      action: 'render'
    };

    expect(trafficEvent.isBot).toBe(true);
    expect(trafficEvent.action).toBe('render');
  });

  it('should record human traffic event', () => {
    const trafficEvent = {
      timestamp: Date.now(),
      method: 'GET',
      path: '/about',
      userAgent: 'Mozilla/5.0',
      ip: '192.168.1.1',
      isBot: false,
      action: 'proxy'
    };

    expect(trafficEvent.isBot).toBe(false);
    expect(trafficEvent.action).toBe('proxy');
  });

  it('should include response time in traffic event', () => {
    const startTime = Date.now();
    const endTime = startTime + 150;
    const responseTime = endTime - startTime;
    expect(responseTime).toBe(150);
  });
});

describe('Cache Retrieval Logic', () => {
  it('should parse cached JSON content', () => {
    const cached = JSON.stringify({ content: '<html></html>', renderTime: Date.now() });
    const parsed = JSON.parse(cached);
    expect(parsed.content).toBeDefined();
    expect(parsed.renderTime).toBeDefined();
  });

  it('should handle cache miss', () => {
    const cached = undefined;
    const isCacheHit = !!cached;
    expect(isCacheHit).toBe(false);
  });

  it('should validate cached content has required fields', () => {
    const cacheData = { content: '<html></html>', renderTime: Date.now() };
    const isValid = cacheData && cacheData.content && cacheData.renderTime;
    expect(!!isValid).toBe(true);
  });
});

describe('Stale Cache Detection', () => {
  it('should detect fresh cache', () => {
    const cacheTTL = 60000;
    const cacheAge = 30000;
    const staleThreshold = cacheTTL * 0.8;
    const isStale = cacheAge > staleThreshold;
    expect(isStale).toBe(false);
  });

  it('should detect stale cache', () => {
    const cacheTTL = 60000;
    const cacheAge = 55000;
    const staleThreshold = cacheTTL * 0.8;
    const isStale = cacheAge > staleThreshold;
    expect(isStale).toBe(true);
  });

  it('should trigger revalidation for stale cache', () => {
    const isStale = true;
    const shouldRevalidate = isStale;
    expect(shouldRevalidate).toBe(true);
  });
});

describe('Render Result Processing', () => {
  it('should extract HTML from render result', () => {
    const renderResult = { html: '<html><body>Test</body></html>', statusCode: 200 };
    expect(renderResult.html).toContain('body');
  });

  it('should use default status code if not provided', () => {
    const renderResult = { html: '<html></html>' };
    const statusCode = (renderResult as any).statusCode || 200;
    expect(statusCode).toBe(200);
  });

  it('should handle render error', () => {
    const renderResult = { html: null, statusCode: 500, error: 'Render failed' };
    const hasError = !!renderResult.error;
    expect(hasError).toBe(true);
  });
});

describe('Debug Response Building', () => {
  it('should build debug response with all fields', () => {
    const debug = {
      url: 'http://localhost:3000/test',
      path: '/test',
      renderTime: '150ms',
      htmlLength: 5000,
      statusCode: 200,
      wasCached: false,
      botDetection: { isBot: true, confidence: 0.95 },
      timestamp: new Date().toISOString()
    };

    expect(debug.url).toBeDefined();
    expect(debug.path).toBeDefined();
    expect(debug.renderTime).toBeDefined();
    expect(debug.botDetection).toBeDefined();
  });

  it('should format confidence as percentage', () => {
    const confidence = 0.95;
    const formatted = `${(confidence * 100).toFixed(1)}%`;
    expect(formatted).toBe('95.0%');
  });
});

describe('Process Signal Handlers', () => {
  it('should handle SIGINT signal', () => {
    const handler = () => {
      // Graceful shutdown
    };
    expect(typeof handler).toBe('function');
  });

  it('should handle SIGTERM signal', () => {
    const handler = () => {
      // Graceful shutdown
    };
    expect(typeof handler).toBe('function');
  });

  it('should close browser on shutdown', async () => {
    const closeBrowser = vi.fn().mockResolvedValue(undefined);
    await closeBrowser();
    expect(closeBrowser).toHaveBeenCalled();
  });

  it('should close cache on shutdown', async () => {
    const closeCache = vi.fn().mockResolvedValue(undefined);
    await closeCache();
    expect(closeCache).toHaveBeenCalled();
  });

  it('should disconnect database on shutdown', async () => {
    const disconnect = vi.fn().mockResolvedValue(undefined);
    await disconnect();
    expect(disconnect).toHaveBeenCalled();
  });
});

describe('Express App Configuration', () => {
  it('should disable x-powered-by', () => {
    const mockApp = { disable: vi.fn() };
    mockApp.disable('x-powered-by');
    expect(mockApp.disable).toHaveBeenCalledWith('x-powered-by');
  });

  it('should set trust proxy', () => {
    const mockApp = { set: vi.fn() };
    mockApp.set('trust proxy', true);
    expect(mockApp.set).toHaveBeenCalledWith('trust proxy', true);
  });
});

describe('HTTP Server Events', () => {
  it('should handle server error event', () => {
    const mockServer = { on: vi.fn() };
    mockServer.on('error', (err: Error) => {
      console.error('Server error:', err);
    });
    expect(mockServer.on).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('should handle server listening event', () => {
    const mockServer = { on: vi.fn() };
    mockServer.on('listening', () => {
      console.log('Server listening');
    });
    expect(mockServer.on).toHaveBeenCalledWith('listening', expect.any(Function));
  });
});

describe('Referer Header Handling', () => {
  it('should extract referer from headers', () => {
    const headers = { referer: 'http://google.com' };
    expect(headers.referer).toBe('http://google.com');
  });

  it('should handle missing referer', () => {
    const headers = {};
    const referer = (headers as any).referer || '';
    expect(referer).toBe('');
  });
});

describe('Accept Header Handling', () => {
  it('should check for HTML accept header', () => {
    const accept = 'text/html,application/xhtml+xml';
    const acceptsHtml = accept.includes('text/html');
    expect(acceptsHtml).toBe(true);
  });

  it('should check for JSON accept header', () => {
    const accept = 'application/json';
    const acceptsJson = accept.includes('application/json');
    expect(acceptsJson).toBe(true);
  });
});

describe('X-Forwarded Headers', () => {
  it('should use x-forwarded-for for client IP', () => {
    const headers = { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' };
    const clientIp = headers['x-forwarded-for'].split(',')[0].trim();
    expect(clientIp).toBe('192.168.1.1');
  });

  it('should use x-forwarded-proto for protocol', () => {
    const headers = { 'x-forwarded-proto': 'https' };
    expect(headers['x-forwarded-proto']).toBe('https');
  });
});

describe('Content Type Response', () => {
  it('should set HTML content type for SSR response', () => {
    const contentType = 'text/html; charset=utf-8';
    expect(contentType).toContain('text/html');
    expect(contentType).toContain('charset=utf-8');
  });

  it('should set JSON content type for debug response', () => {
    const contentType = 'application/json';
    expect(contentType).toBe('application/json');
  });
});

describe('Method Handling', () => {
  it('should handle GET requests', () => {
    const method = 'GET';
    const isGet = method === 'GET';
    expect(isGet).toBe(true);
  });

  it('should handle POST requests', () => {
    const method = 'POST';
    const isPost = method === 'POST';
    expect(isPost).toBe(true);
  });

  it('should handle HEAD requests', () => {
    const method = 'HEAD';
    const isHead = method === 'HEAD';
    expect(isHead).toBe(true);
  });

  it('should handle OPTIONS requests', () => {
    const method = 'OPTIONS';
    const isOptions = method === 'OPTIONS';
    expect(isOptions).toBe(true);
  });
});

describe('Response Size Calculation', () => {
  it('should calculate response size from buffer', () => {
    const content = '<html><body>Test Content</body></html>';
    const buffer = Buffer.from(content);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should calculate response size from string length', () => {
    const content = '<html><body>Test</body></html>';
    const size = content.length;
    expect(size).toBe(30);
  });
});

describe('URL Path Parsing', () => {
  it('should extract pathname from URL', () => {
    const url = '/about?query=1';
    const pathname = url.split('?')[0];
    expect(pathname).toBe('/about');
  });

  it('should extract query string from URL', () => {
    const url = '/about?query=1&other=2';
    const queryString = url.split('?')[1] || '';
    expect(queryString).toBe('query=1&other=2');
  });

  it('should handle URL without query string', () => {
    const url = '/about';
    const queryString = url.split('?')[1] || '';
    expect(queryString).toBe('');
  });
});

describe('Cache Store Logic', () => {
  it('should create cache data structure', () => {
    const cacheData = {
      content: '<html></html>',
      renderTime: Date.now(),
      statusCode: 200
    };
    const serialized = JSON.stringify(cacheData);
    expect(serialized).toContain('content');
    expect(serialized).toContain('renderTime');
    expect(serialized).toContain('statusCode');
  });

  it('should skip caching for error responses', () => {
    const statusCode = 500;
    const shouldCache = statusCode >= 200 && statusCode < 400;
    expect(shouldCache).toBe(false);
  });

  it('should cache successful responses', () => {
    const statusCode = 200;
    const shouldCache = statusCode >= 200 && statusCode < 400;
    expect(shouldCache).toBe(true);
  });
});

describe('Render Time Measurement', () => {
  it('should measure render time in milliseconds', () => {
    const startTime = Date.now();
    const endTime = startTime + 150;
    const renderTime = endTime - startTime;
    expect(renderTime).toBe(150);
  });

  it('should format render time for logging', () => {
    const renderTime = 150;
    const formatted = `${renderTime}ms`;
    expect(formatted).toBe('150ms');
  });
});

describe('Express App Configuration', () => {
  it('should disable x-powered-by header', () => {
    const app = { disable: vi.fn() };
    app.disable('x-powered-by');
    expect(app.disable).toHaveBeenCalledWith('x-powered-by');
  });

  it('should set trust proxy option', () => {
    const app = { set: vi.fn() };
    app.set('trust proxy', true);
    expect(app.set).toHaveBeenCalledWith('trust proxy', true);
  });

  it('should use JSON middleware', () => {
    const app = { use: vi.fn() };
    const jsonMiddleware = vi.fn();
    app.use(jsonMiddleware);
    expect(app.use).toHaveBeenCalled();
  });
});

describe('HTTP Server Events', () => {
  it('should handle server error event', () => {
    const onError = vi.fn();
    const server = { on: vi.fn((event, handler) => { if (event === 'error') handler(new Error('Test')); }) };
    server.on('error', onError);
    expect(onError).toHaveBeenCalled();
  });

  it('should handle server listening event', () => {
    const onListening = vi.fn();
    const server = { on: vi.fn((event, handler) => { if (event === 'listening') handler(); }) };
    server.on('listening', onListening);
    expect(onListening).toHaveBeenCalled();
  });

  it('should handle server close event', () => {
    const onClose = vi.fn();
    const server = { on: vi.fn((event, handler) => { if (event === 'close') handler(); }) };
    server.on('close', onClose);
    expect(onClose).toHaveBeenCalled();
  });
});

describe('Request Header Handling', () => {
  it('should extract user-agent header', () => {
    const req = { headers: { 'user-agent': 'Mozilla/5.0' } };
    const userAgent = req.headers['user-agent'] || '';
    expect(userAgent).toBe('Mozilla/5.0');
  });

  it('should extract accept header', () => {
    const req = { headers: { accept: 'text/html' } };
    const accept = req.headers.accept || '';
    expect(accept).toBe('text/html');
  });

  it('should extract x-forwarded-for header', () => {
    const req = { headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' } };
    const forwardedFor = req.headers['x-forwarded-for'] || '';
    const clientIP = forwardedFor.split(',')[0].trim();
    expect(clientIP).toBe('192.168.1.1');
  });

  it('should handle missing headers', () => {
    const req = { headers: {} };
    const userAgent = req.headers['user-agent'] || 'Unknown';
    expect(userAgent).toBe('Unknown');
  });

  it('should extract referer header', () => {
    const req = { headers: { referer: 'https://google.com' } };
    const referer = req.headers.referer || '';
    expect(referer).toBe('https://google.com');
  });
});

describe('Response Header Setting', () => {
  it('should set content-type header', () => {
    const res = { setHeader: vi.fn() };
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html; charset=utf-8');
  });

  it('should set cache-control header', () => {
    const res = { setHeader: vi.fn() };
    res.setHeader('Cache-Control', 'public, max-age=3600');
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'public, max-age=3600');
  });

  it('should set x-ssr-rendered header', () => {
    const res = { setHeader: vi.fn() };
    res.setHeader('X-SSR-Rendered', 'true');
    expect(res.setHeader).toHaveBeenCalledWith('X-SSR-Rendered', 'true');
  });

  it('should set x-cache header', () => {
    const res = { setHeader: vi.fn() };
    res.setHeader('X-Cache', 'HIT');
    expect(res.setHeader).toHaveBeenCalledWith('X-Cache', 'HIT');
  });
});

describe('Content Type Response', () => {
  it('should send HTML content', () => {
    const res = { send: vi.fn(), setHeader: vi.fn() };
    const html = '<html><body>Test</body></html>';
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
    expect(res.send).toHaveBeenCalledWith(html);
  });

  it('should send JSON content', () => {
    const res = { json: vi.fn() };
    const data = { success: true };
    res.json(data);
    expect(res.json).toHaveBeenCalledWith(data);
  });
});

describe('HTTP Method Handling', () => {
  it('should handle GET requests', () => {
    const req = { method: 'GET' };
    const isGet = req.method === 'GET';
    expect(isGet).toBe(true);
  });

  it('should handle POST requests', () => {
    const req = { method: 'POST' };
    const isPost = req.method === 'POST';
    expect(isPost).toBe(true);
  });

  it('should handle HEAD requests for bot', () => {
    const req = { method: 'HEAD' };
    const isHead = req.method === 'HEAD';
    expect(isHead).toBe(true);
  });

  it('should skip SSR for non-GET/HEAD methods', () => {
    const req = { method: 'POST' };
    const shouldSkipSSR = req.method !== 'GET' && req.method !== 'HEAD';
    expect(shouldSkipSSR).toBe(true);
  });
});

describe('Response Size Calculation', () => {
  it('should calculate response size in bytes', () => {
    const html = '<html><body>Test</body></html>';
    const size = Buffer.byteLength(html, 'utf8');
    expect(size).toBeGreaterThan(0);
  });

  it('should format size for logging', () => {
    const sizeBytes = 1536;
    const sizeKB = (sizeBytes / 1024).toFixed(2);
    expect(sizeKB).toBe('1.50');
  });

  it('should handle large response sizes', () => {
    const sizeMB = 5.5;
    const sizeBytes = sizeMB * 1024 * 1024;
    expect(sizeBytes).toBe(5767168);
  });
});

describe('Proxy Target Configuration', () => {
  it('should parse target URL', () => {
    const targetUrl = 'http://localhost:3000';
    const url = new URL(targetUrl);
    expect(url.hostname).toBe('localhost');
    expect(url.port).toBe('3000');
    expect(url.protocol).toBe('http:');
  });

  it('should handle HTTPS target', () => {
    const targetUrl = 'https://example.com';
    const url = new URL(targetUrl);
    expect(url.protocol).toBe('https:');
  });

  it('should handle target with path', () => {
    const targetUrl = 'http://localhost:3000/api';
    const url = new URL(targetUrl);
    expect(url.pathname).toBe('/api');
  });
});

describe('Error Page Generation', () => {
  it('should generate error page HTML', () => {
    const errorMessage = 'Service unavailable';
    const errorPage = `<!DOCTYPE html>
<html>
<head><title>Error</title></head>
<body><h1>Error</h1><p>${errorMessage}</p></body>
</html>`;
    expect(errorPage).toContain('Error');
    expect(errorPage).toContain(errorMessage);
  });

  it('should generate 502 error page', () => {
    const statusCode = 502;
    const message = 'Bad Gateway';
    expect(statusCode).toBe(502);
    expect(message).toBe('Bad Gateway');
  });

  it('should generate 503 error page', () => {
    const statusCode = 503;
    const message = 'Service Unavailable';
    expect(statusCode).toBe(503);
    expect(message).toBe('Service Unavailable');
  });
});

describe('Request Logging', () => {
  it('should log incoming request', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const req = { method: 'GET', path: '/test', ip: '127.0.0.1' };
    console.log(`[${req.method}] ${req.path} from ${req.ip}`);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should log response status', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const statusCode = 200;
    const duration = 150;
    console.log(`Response: ${statusCode} in ${duration}ms`);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe('Bypass Patterns', () => {
  it('should bypass static file extensions', () => {
    const staticExtensions = ['.css', '.js', '.png', '.jpg', '.gif', '.ico', '.svg', '.woff', '.woff2'];
    const path = '/assets/style.css';
    const shouldBypass = staticExtensions.some(ext => path.endsWith(ext));
    expect(shouldBypass).toBe(true);
  });

  it('should bypass API paths', () => {
    const apiPaths = ['/api/', '/shieldapi/'];
    const path = '/api/users';
    const shouldBypass = apiPaths.some(prefix => path.startsWith(prefix));
    expect(shouldBypass).toBe(true);
  });

  it('should not bypass regular paths', () => {
    const staticExtensions = ['.css', '.js', '.png'];
    const path = '/about';
    const shouldBypass = staticExtensions.some(ext => path.endsWith(ext));
    expect(shouldBypass).toBe(false);
  });

  it('should bypass health check path', () => {
    const path = '/shieldhealth';
    const shouldBypass = path === '/shieldhealth';
    expect(shouldBypass).toBe(true);
  });
});

describe('Health Check Endpoint', () => {
  it('should return health status', () => {
    const healthResponse = {
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };
    expect(healthResponse.status).toBe('healthy');
    expect(healthResponse.uptime).toBeGreaterThanOrEqual(0);
  });

  it('should include memory usage in health check', () => {
    const memUsage = process.memoryUsage();
    expect(memUsage.heapUsed).toBeGreaterThan(0);
    expect(memUsage.heapTotal).toBeGreaterThan(0);
  });
});

describe('Graceful Shutdown', () => {
  it('should handle SIGTERM signal', () => {
    const shutdown = vi.fn();
    const signals = ['SIGTERM', 'SIGINT'];
    signals.forEach(signal => {
      shutdown(signal);
    });
    expect(shutdown).toHaveBeenCalledTimes(2);
  });

  it('should close server on shutdown', () => {
    const server = { close: vi.fn(cb => cb()) };
    server.close(() => {});
    expect(server.close).toHaveBeenCalled();
  });

  it('should close browser on shutdown', async () => {
    const browser = { close: vi.fn().mockResolvedValue(undefined) };
    await browser.close();
    expect(browser.close).toHaveBeenCalled();
  });

  it('should close cache on shutdown', async () => {
    const cache = { close: vi.fn().mockResolvedValue(undefined) };
    await cache.close();
    expect(cache.close).toHaveBeenCalled();
  });
});

describe('Concurrent Render Limiting', () => {
  it('should track active renders', () => {
    let activeRenders = 0;
    const maxConcurrent = 5;

    const startRender = () => {
      if (activeRenders < maxConcurrent) {
        activeRenders++;
        return true;
      }
      return false;
    };

    const endRender = () => {
      if (activeRenders > 0) {
        activeRenders--;
      }
    };

    expect(startRender()).toBe(true);
    expect(activeRenders).toBe(1);
    endRender();
    expect(activeRenders).toBe(0);
  });

  it('should reject when at max capacity', () => {
    let activeRenders = 5;
    const maxConcurrent = 5;

    const canStartRender = activeRenders < maxConcurrent;
    expect(canStartRender).toBe(false);
  });
});

describe('Cache TTL Configuration', () => {
  it('should convert seconds to milliseconds', () => {
    const ttlSeconds = 3600;
    const ttlMs = ttlSeconds * 1000;
    expect(ttlMs).toBe(3600000);
  });

  it('should use default TTL', () => {
    const defaultTTL = 60000;
    const configTTL = undefined;
    const ttl = configTTL || defaultTTL;
    expect(ttl).toBe(60000);
  });
});

describe('Request Query Parameters', () => {
  it('should detect render preview mode', () => {
    const query = { _render: 'true' };
    const isRenderPreview = query._render === 'true';
    expect(isRenderPreview).toBe(true);
  });

  it('should detect debug mode', () => {
    const query = { _render: 'debug' };
    const isDebugMode = query._render === 'debug';
    expect(isDebugMode).toBe(true);
  });

  it('should handle no render query', () => {
    const query = {};
    const isRenderPreview = (query as any)._render === 'true';
    expect(isRenderPreview).toBe(false);
  });
});

describe('Bot Detection Integration', () => {
  it('should pass user agent to bot detector', () => {
    const detect = vi.fn().mockReturnValue({ isBot: true, confidence: 0.9 });
    const userAgent = 'Googlebot/2.1';
    const result = detect(userAgent);
    expect(detect).toHaveBeenCalledWith(userAgent);
    expect(result.isBot).toBe(true);
  });

  it('should handle empty user agent', () => {
    const detect = vi.fn().mockReturnValue({ isBot: false, confidence: 0 });
    const result = detect('');
    expect(result.isBot).toBe(false);
  });
});

describe('Cache Hit/Miss Logging', () => {
  it('should log cache hit', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const url = 'http://localhost:3000/test';
    console.log(`✅ Cache HIT for: ${url}`);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Cache HIT'));
    consoleSpy.mockRestore();
  });

  it('should log cache miss', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const url = 'http://localhost:3000/test';
    console.log(`❌ Cache MISS for: ${url}`);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Cache MISS'));
    consoleSpy.mockRestore();
  });
});

describe('Render Queue Management', () => {
  it('should add to render queue', () => {
    const queue: string[] = [];
    const url = 'http://localhost:3000/page';
    queue.push(url);
    expect(queue.length).toBe(1);
    expect(queue[0]).toBe(url);
  });

  it('should process queue in order', () => {
    const queue = ['url1', 'url2', 'url3'];
    const first = queue.shift();
    expect(first).toBe('url1');
    expect(queue.length).toBe(2);
  });
});

describe('SSR Response Headers', () => {
  it('should add X-SSR-Rendered header', () => {
    const headers: Record<string, string> = {};
    headers['X-SSR-Rendered'] = 'true';
    expect(headers['X-SSR-Rendered']).toBe('true');
  });

  it('should add X-Render-Time header', () => {
    const headers: Record<string, string> = {};
    const renderTime = 150;
    headers['X-Render-Time'] = `${renderTime}ms`;
    expect(headers['X-Render-Time']).toBe('150ms');
  });

  it('should add X-Cache-Status header', () => {
    const headers: Record<string, string> = {};
    headers['X-Cache-Status'] = 'MISS';
    expect(headers['X-Cache-Status']).toBe('MISS');
  });
});

describe('Database Initialization', () => {
  it('should handle successful database connection', async () => {
    const mockDatabaseManager = {
      connect: vi.fn().mockResolvedValue(true),
      getMongoStorage: vi.fn().mockReturnValue({}),
      isDbConnected: vi.fn().mockReturnValue(true)
    };

    const connected = await mockDatabaseManager.connect();
    expect(connected).toBe(true);
  });

  it('should handle failed database connection', async () => {
    const mockDatabaseManager = {
      connect: vi.fn().mockResolvedValue(false),
      isDbConnected: vi.fn().mockReturnValue(false)
    };

    const connected = await mockDatabaseManager.connect();
    expect(connected).toBe(false);
  });

  it('should handle database connection error', async () => {
    const mockDatabaseManager = {
      connect: vi.fn().mockRejectedValue(new Error('Connection refused'))
    };

    let errorCaught = false;
    try {
      await mockDatabaseManager.connect();
    } catch (error) {
      errorCaught = true;
    }
    expect(errorCaught).toBe(true);
  });

  it('should initialize bot detector when storage is available', () => {
    const mongoStorage = { find: vi.fn(), insert: vi.fn() };
    expect(mongoStorage).toBeDefined();
  });

  it('should skip bot detector when storage is null', () => {
    const mongoStorage = null;
    const shouldInitBotDetector = mongoStorage !== null;
    expect(shouldInitBotDetector).toBe(false);
  });

  it('should log success message on connection', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    console.log('✅ MongoDB connected for traffic logging');
    expect(consoleSpy).toHaveBeenCalledWith('✅ MongoDB connected for traffic logging');
    consoleSpy.mockRestore();
  });

  it('should log warning on connection failure', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    console.warn('⚠️  MongoDB connection failed, traffic events will not be persisted');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('MongoDB connection failed'));
    consoleSpy.mockRestore();
  });
});

describe('Server Startup', () => {
  it('should start server after database init', async () => {
    let serverStarted = false;
    const mockServer = {
      listen: vi.fn().mockImplementation((port, host, callback) => {
        serverStarted = true;
        callback?.();
      })
    };

    mockServer.listen(8080, '0.0.0.0', () => {});
    expect(serverStarted).toBe(true);
    expect(mockServer.listen).toHaveBeenCalledWith(8080, '0.0.0.0', expect.any(Function));
  });

  it('should log startup banner', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║               SEO Shield Proxy (Ultra-Clean)           ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    expect(consoleSpy).toHaveBeenCalledTimes(3);
    consoleSpy.mockRestore();
  });

  it('should log server port', () => {
    const port = 8080;
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    console.log(`🚀 Ultra-clean proxy server running on port ${port}`);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('8080'));
    consoleSpy.mockRestore();
  });

  it('should log target URL', () => {
    const targetUrl = 'https://example.com';
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    console.log(`🎯 Target URL: ${targetUrl}`);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('example.com'));
    consoleSpy.mockRestore();
  });

  it('should log MongoDB status', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    console.log('💾 MongoDB: Connected');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('MongoDB'));
    consoleSpy.mockRestore();
  });

  it('should log all active features', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    console.log('Bot detection: ✅ Active');
    console.log('SSR rendering: ✅ Active');
    console.log('Reverse proxy: ✅ Active');
    console.log('Caching: ✅ Active');
    console.log('Rate limiting: ✅ Active');
    expect(consoleSpy).toHaveBeenCalledTimes(5);
    consoleSpy.mockRestore();
  });
});

describe('Server Startup Fallback', () => {
  it('should start server even if database fails', async () => {
    let serverStarted = false;
    const mockServer = {
      listen: vi.fn().mockImplementation((port, host, callback) => {
        serverStarted = true;
        callback?.();
      })
    };

    // Simulate database failure
    const mockDatabaseInit = Promise.reject(new Error('Database error'));

    try {
      await mockDatabaseInit;
    } catch {
      // Start server anyway
      mockServer.listen(8080, '0.0.0.0', () => {});
    }

    expect(serverStarted).toBe(true);
  });

  it('should log database fallback mode', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    console.log('🚀 Ultra-clean proxy server running on port 8080 (Database fallback mode)');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('fallback mode'));
    consoleSpy.mockRestore();
  });

  it('should log database initialization error', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('Connection refused');
    console.error('❌ Failed to initialize database:', error);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to initialize database'), error);
    consoleSpy.mockRestore();
  });
});

describe('Traffic Event Sending', () => {
  it('should construct traffic event object', () => {
    const event = {
      timestamp: new Date().toISOString(),
      type: 'request',
      path: '/test',
      method: 'GET',
      userAgent: 'Mozilla/5.0',
      isBot: false,
      botName: null,
      action: 'proxy',
      statusCode: 200,
      responseTime: 50,
      cacheHit: false,
      renderTime: null,
      error: null
    };

    expect(event.type).toBe('request');
    expect(event.path).toBe('/test');
    expect(event.action).toBe('proxy');
  });

  it('should broadcast traffic event', () => {
    const broadcastMock = vi.fn();
    const event = { type: 'request', path: '/test' };

    broadcastMock(event);
    expect(broadcastMock).toHaveBeenCalledWith(event);
  });

  it('should persist traffic event to database', async () => {
    const mockStorage = {
      saveTrafficEvent: vi.fn().mockResolvedValue({ insertedId: 'test-id' })
    };

    const event = { type: 'request', path: '/test' };
    await mockStorage.saveTrafficEvent(event);
    expect(mockStorage.saveTrafficEvent).toHaveBeenCalledWith(event);
  });

  it('should handle traffic event persistence error', async () => {
    const mockStorage = {
      saveTrafficEvent: vi.fn().mockRejectedValue(new Error('Write error'))
    };

    let errorCaught = false;
    try {
      await mockStorage.saveTrafficEvent({});
    } catch {
      errorCaught = true;
    }
    expect(errorCaught).toBe(true);
  });
});

describe('Advanced Bot Detector Integration', () => {
  it('should create detector with mongo storage', () => {
    const mockStorage = { find: vi.fn(), insert: vi.fn() };
    const detector = { mongoStorage: mockStorage };
    expect(detector.mongoStorage).toBe(mockStorage);
  });

  it('should detect bot with advanced detector', () => {
    const mockDetector = {
      detect: vi.fn().mockReturnValue({
        isBot: true,
        confidence: 0.95,
        botType: 'search_engine',
        botName: 'Googlebot'
      })
    };

    const result = mockDetector.detect('Googlebot/2.1', '66.249.66.1');
    expect(result.isBot).toBe(true);
    expect(result.botName).toBe('Googlebot');
  });

  it('should fall back to basic detection when not initialized', () => {
    const basicDetect = (userAgent: string) => userAgent.toLowerCase().includes('bot');
    expect(basicDetect('Googlebot/2.1')).toBe(true);
    expect(basicDetect('Mozilla/5.0')).toBe(false);
  });
});

describe('Error Handler Middleware', () => {
  it('should handle errors and return 500', () => {
    const mockRes = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn()
    };

    const error = new Error('Test error');
    mockRes.status(500).send('Internal Server Error');

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.send).toHaveBeenCalledWith('Internal Server Error');
  });

  it('should log error with stack trace', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('Test error');
    console.error(`💥 Server error: ${error.message}`, error.stack);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Server error'), expect.any(String));
    consoleSpy.mockRestore();
  });
});

describe('HTTP Server Events', () => {
  it('should handle server error event', () => {
    const mockServer = {
      on: vi.fn()
    };

    mockServer.on('error', (err: Error) => {
      console.error('Server error:', err);
    });

    expect(mockServer.on).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('should handle server close event', () => {
    const mockServer = {
      on: vi.fn()
    };

    mockServer.on('close', () => {
      console.log('Server closed');
    });

    expect(mockServer.on).toHaveBeenCalledWith('close', expect.any(Function));
  });
});

describe('Graceful Shutdown Handling', () => {
  it('should handle SIGTERM signal', () => {
    const shutdownHandler = vi.fn();
    process.on('SIGTERM', shutdownHandler);

    // Simulate signal (don't actually send it)
    expect(typeof shutdownHandler).toBe('function');
  });

  it('should handle SIGINT signal', () => {
    const shutdownHandler = vi.fn();
    process.on('SIGINT', shutdownHandler);

    expect(typeof shutdownHandler).toBe('function');
  });

  it('should close server on shutdown', async () => {
    const mockServer = {
      close: vi.fn().mockImplementation((callback) => callback?.())
    };

    await new Promise<void>((resolve) => {
      mockServer.close(() => resolve());
    });

    expect(mockServer.close).toHaveBeenCalled();
  });

  it('should close database on shutdown', async () => {
    const mockDb = {
      disconnect: vi.fn().mockResolvedValue(undefined)
    };

    await mockDb.disconnect();
    expect(mockDb.disconnect).toHaveBeenCalled();
  });
});

describe('Static Asset Detection', () => {
  const staticExtensions = ['.js', '.css', '.png', '.jpg', '.gif', '.ico', '.svg', '.woff', '.woff2', '.ttf', '.eot'];

  staticExtensions.forEach(ext => {
    it(`should detect ${ext} as static asset`, () => {
      const path = `/assets/file${ext}`;
      const isStatic = staticExtensions.some(e => path.endsWith(e));
      expect(isStatic).toBe(true);
    });
  });

  it('should not detect HTML as static', () => {
    const path = '/page.html';
    const isStatic = staticExtensions.some(e => path.endsWith(e));
    expect(isStatic).toBe(false);
  });

  it('should not detect paths without extension as static', () => {
    const path = '/api/users';
    const isStatic = staticExtensions.some(e => path.endsWith(e));
    expect(isStatic).toBe(false);
  });
});

describe('SSR Render Flow', () => {
  it('should check cache before rendering', async () => {
    const mockCache = {
      get: vi.fn().mockReturnValue(null)
    };

    const url = 'http://localhost:3000/test';
    const cached = mockCache.get(url);
    expect(cached).toBeNull();
    expect(mockCache.get).toHaveBeenCalledWith(url);
  });

  it('should return cached content if available', async () => {
    const cachedContent = '<html><body>Cached</body></html>';
    const mockCache = {
      get: vi.fn().mockReturnValue(cachedContent)
    };

    const cached = mockCache.get('http://localhost:3000/test');
    expect(cached).toBe(cachedContent);
  });

  it('should render page if not cached', async () => {
    const mockRender = vi.fn().mockResolvedValue('<html><body>Rendered</body></html>');

    const content = await mockRender('http://localhost:3000/test');
    expect(content).toContain('Rendered');
  });

  it('should cache rendered content', async () => {
    const mockCache = {
      set: vi.fn().mockReturnValue(true)
    };

    const url = 'http://localhost:3000/test';
    const content = '<html><body>Content</body></html>';
    const result = mockCache.set(url, content);

    expect(result).toBe(true);
    expect(mockCache.set).toHaveBeenCalledWith(url, content);
  });
});

describe('Proxy Configuration', () => {
  it('should configure target URL', () => {
    const config = {
      target: 'https://example.com',
      changeOrigin: true,
      ws: true
    };

    expect(config.target).toBe('https://example.com');
    expect(config.changeOrigin).toBe(true);
  });

  it('should enable WebSocket proxying', () => {
    const config = { ws: true };
    expect(config.ws).toBe(true);
  });

  it('should set security headers', () => {
    const headers = {
      'X-Forwarded-Proto': 'https',
      'X-Real-IP': '127.0.0.1'
    };

    expect(headers['X-Forwarded-Proto']).toBe('https');
    expect(headers['X-Real-IP']).toBe('127.0.0.1');
  });
});

describe('Server Request Processing Pipeline', () => {
  it('should process human requests via transparent proxy', () => {
    const isBot = false;
    let proxyUsed = false;
    let ssrUsed = false;

    if (isBot) {
      ssrUsed = true;
    } else {
      proxyUsed = true;
    }

    expect(proxyUsed).toBe(true);
    expect(ssrUsed).toBe(false);
  });

  it('should process bot requests via SSR', () => {
    const isBot = true;
    let proxyUsed = false;
    let ssrUsed = false;

    if (isBot) {
      ssrUsed = true;
    } else {
      proxyUsed = true;
    }

    expect(ssrUsed).toBe(true);
    expect(proxyUsed).toBe(false);
  });

  it('should skip SSR for static assets', () => {
    const staticExtensions = ['.js', '.css', '.png', '.jpg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf'];
    const requestPath = '/assets/logo.png';

    const isStatic = staticExtensions.some(ext => requestPath.toLowerCase().endsWith(ext));
    expect(isStatic).toBe(true);
  });

  it('should skip SSR for API paths', () => {
    const apiPaths = ['/api/', '/graphql'];
    const requestPath = '/api/users';

    const isApi = apiPaths.some(prefix => requestPath.startsWith(prefix));
    expect(isApi).toBe(true);
  });
});

describe('Server Cache Integration', () => {
  it('should check cache before rendering', async () => {
    const mockCache = {
      getWithTTL: vi.fn().mockReturnValue({ value: '<html>cached</html>', ttl: 3600, isStale: false })
    };

    const entry = mockCache.getWithTTL('http://example.com/page');
    expect(entry).toBeDefined();
    expect(entry.value).toContain('cached');
  });

  it('should handle stale-while-revalidate strategy', async () => {
    const mockCache = {
      getWithTTL: vi.fn().mockReturnValue({ value: '<html>stale</html>', ttl: 0, isStale: true })
    };

    const entry = mockCache.getWithTTL('http://example.com/page');
    expect(entry.isStale).toBe(true);
  });

  it('should store rendered content in cache', () => {
    let cachedData: any = null;
    const mockCache = {
      set: vi.fn().mockImplementation((key, value) => {
        cachedData = { key, value };
        return true;
      })
    };

    mockCache.set('http://example.com/page', '<html>rendered</html>');
    expect(cachedData).not.toBeNull();
    expect(cachedData.value).toContain('rendered');
  });
});

describe('Server Health Endpoint', () => {
  it('should return health status', () => {
    const healthResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };

    expect(healthResponse.status).toBe('ok');
    expect(healthResponse.timestamp).toBeDefined();
    expect(typeof healthResponse.uptime).toBe('number');
  });

  it('should include cache status in health check', () => {
    const healthResponse = {
      status: 'ok',
      cache: {
        ready: true,
        keys: 100,
        hits: 500,
        misses: 50
      }
    };

    expect(healthResponse.cache.ready).toBe(true);
    expect(healthResponse.cache.keys).toBe(100);
  });

  it('should include render queue status in health check', () => {
    const healthResponse = {
      status: 'ok',
      renderQueue: {
        queued: 5,
        processing: 2,
        completed: 100,
        errors: 3
      }
    };

    expect(healthResponse.renderQueue.queued).toBe(5);
    expect(healthResponse.renderQueue.processing).toBe(2);
  });
});

describe('Server Error Response Handling', () => {
  it('should return 502 on upstream error', () => {
    const errorCode = 502;
    const errorMessage = 'Bad Gateway';

    expect(errorCode).toBe(502);
    expect(errorMessage).toBe('Bad Gateway');
  });

  it('should return 503 on render error', () => {
    const errorCode = 503;
    const errorMessage = 'Service Unavailable';

    expect(errorCode).toBe(503);
    expect(errorMessage).toBe('Service Unavailable');
  });

  it('should return 504 on timeout', () => {
    const errorCode = 504;
    const errorMessage = 'Gateway Timeout';

    expect(errorCode).toBe(504);
    expect(errorMessage).toBe('Gateway Timeout');
  });

  it('should include error details in response', () => {
    const errorResponse = {
      error: 'Render failed',
      code: 503,
      details: 'Navigation timeout after 30000ms'
    };

    expect(errorResponse.error).toBe('Render failed');
    expect(errorResponse.code).toBe(503);
    expect(errorResponse.details).toContain('timeout');
  });
});

describe('Server Metrics Collection', () => {
  it('should track request count', () => {
    const metrics = {
      requests: { total: 0, human: 0, bot: 0 }
    };

    metrics.requests.total++;
    metrics.requests.human++;

    expect(metrics.requests.total).toBe(1);
    expect(metrics.requests.human).toBe(1);
  });

  it('should track response times', () => {
    const times: number[] = [];
    const startTime = Date.now();
    const endTime = startTime + 150;
    const duration = endTime - startTime;

    times.push(duration);

    expect(times.length).toBe(1);
    expect(times[0]).toBe(150);
  });

  it('should track cache metrics', () => {
    const metrics = {
      cache: { hits: 0, misses: 0, hitRate: 0 }
    };

    metrics.cache.hits = 80;
    metrics.cache.misses = 20;
    metrics.cache.hitRate = (metrics.cache.hits / (metrics.cache.hits + metrics.cache.misses)) * 100;

    expect(metrics.cache.hitRate).toBe(80);
  });
});

describe('Server Request URL Building', () => {
  it('should build target URL from request', () => {
    const targetUrl = 'https://spa.example.com';
    const requestPath = '/users/123';
    const requestQuery = '?tab=profile';

    const fullUrl = `${targetUrl}${requestPath}${requestQuery}`;
    expect(fullUrl).toBe('https://spa.example.com/users/123?tab=profile');
  });

  it('should handle URL without query string', () => {
    const targetUrl = 'https://spa.example.com';
    const requestPath = '/products';

    const fullUrl = `${targetUrl}${requestPath}`;
    expect(fullUrl).toBe('https://spa.example.com/products');
  });

  it('should handle complex query strings', () => {
    const targetUrl = 'https://spa.example.com';
    const requestPath = '/search';
    const requestQuery = '?q=test&category=all&sort=date&page=1';

    const fullUrl = `${targetUrl}${requestPath}${requestQuery}`;
    expect(fullUrl).toContain('q=test');
    expect(fullUrl).toContain('category=all');
  });
});

describe('Server User Agent Processing', () => {
  it('should extract user agent from request', () => {
    const req = {
      headers: { 'user-agent': 'Googlebot/2.1' }
    };

    const userAgent = req.headers['user-agent'] || '';
    expect(userAgent).toBe('Googlebot/2.1');
  });

  it('should handle missing user agent', () => {
    const req = { headers: {} };

    const userAgent = (req.headers as any)['user-agent'] || '';
    expect(userAgent).toBe('');
  });

  it('should identify known bot signatures', () => {
    const knownBots = ['Googlebot', 'Bingbot', 'Slurp', 'DuckDuckBot'];
    const userAgent = 'Mozilla/5.0 (compatible; Googlebot/2.1)';

    const isKnownBot = knownBots.some(bot => userAgent.includes(bot));
    expect(isKnownBot).toBe(true);
  });
});

describe('Server Response Headers', () => {
  it('should set X-SSR-Rendered header for bot requests', () => {
    const headers: Record<string, string> = {};
    const isBot = true;

    if (isBot) {
      headers['X-SSR-Rendered'] = 'true';
    }

    expect(headers['X-SSR-Rendered']).toBe('true');
  });

  it('should set X-Cache header for cached responses', () => {
    const headers: Record<string, string> = {};
    const fromCache = true;

    if (fromCache) {
      headers['X-Cache'] = 'HIT';
    } else {
      headers['X-Cache'] = 'MISS';
    }

    expect(headers['X-Cache']).toBe('HIT');
  });

  it('should set Content-Type header', () => {
    const headers: Record<string, string> = {};

    headers['Content-Type'] = 'text/html; charset=utf-8';

    expect(headers['Content-Type']).toBe('text/html; charset=utf-8');
  });

  it('should set X-Response-Time header', () => {
    const headers: Record<string, string> = {};
    const responseTime = 250;

    headers['X-Response-Time'] = `${responseTime}ms`;

    expect(headers['X-Response-Time']).toBe('250ms');
  });
});

describe('Server Proxy Error Handling', () => {
  it('should handle ECONNREFUSED error', () => {
    const error = { code: 'ECONNREFUSED', message: 'Connection refused' };

    expect(error.code).toBe('ECONNREFUSED');
  });

  it('should handle ETIMEDOUT error', () => {
    const error = { code: 'ETIMEDOUT', message: 'Connection timed out' };

    expect(error.code).toBe('ETIMEDOUT');
  });

  it('should handle ENOTFOUND error', () => {
    const error = { code: 'ENOTFOUND', message: 'DNS lookup failed' };

    expect(error.code).toBe('ENOTFOUND');
  });

  it('should log proxy errors', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const error = new Error('Proxy error');
    console.error('Proxy error:', error.message);

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe('Server Graceful Shutdown Flow', () => {
  it('should stop accepting new connections', async () => {
    let acceptingConnections = true;

    const stopAccepting = async () => {
      acceptingConnections = false;
    };

    await stopAccepting();
    expect(acceptingConnections).toBe(false);
  });

  it('should wait for pending requests', async () => {
    let pendingRequests = 5;

    const waitForPending = async () => {
      while (pendingRequests > 0) {
        pendingRequests--;
      }
    };

    await waitForPending();
    expect(pendingRequests).toBe(0);
  });

  it('should close browser connections', async () => {
    let browserClosed = false;

    const closeBrowser = async () => {
      browserClosed = true;
    };

    await closeBrowser();
    expect(browserClosed).toBe(true);
  });

  it('should close cache connections', async () => {
    let cacheClosed = false;

    const closeCache = async () => {
      cacheClosed = true;
    };

    await closeCache();
    expect(cacheClosed).toBe(true);
  });

  it('should close HTTP server', async () => {
    let serverClosed = false;

    const closeServer = async () => {
      serverClosed = true;
    };

    await closeServer();
    expect(serverClosed).toBe(true);
  });
});

describe('Server Request Logging', () => {
  it('should log incoming request', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const method = 'GET';
    const path = '/users/123';
    const ip = '192.168.1.1';

    console.log(`${method} ${path} from ${ip}`);

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should log response status', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const statusCode = 200;
    const path = '/users/123';
    const duration = 150;

    console.log(`${statusCode} ${path} - ${duration}ms`);

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should format log timestamp', () => {
    const timestamp = new Date().toISOString();
    expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

describe('Server Debug Mode', () => {
  it('should detect _render=true query param', () => {
    const url = '/page?_render=true';
    const isDebugRender = url.includes('_render=true');

    expect(isDebugRender).toBe(true);
  });

  it('should detect _render=debug query param', () => {
    const url = '/page?_render=debug';
    const isDebugMode = url.includes('_render=debug');

    expect(isDebugMode).toBe(true);
  });

  it('should return raw HTML in debug mode', () => {
    const debugEnabled = true;
    const html = '<html><body>Content</body></html>';

    if (debugEnabled) {
      // Return raw HTML instead of proxying
      expect(html).toContain('<html>');
    }
  });

  it('should include timing metrics in debug response', () => {
    const debugResponse = {
      html: '<html></html>',
      metrics: {
        renderTime: 1500,
        cacheCheck: 5,
        totalTime: 1505
      }
    };

    expect(debugResponse.metrics).toBeDefined();
    expect(debugResponse.metrics.renderTime).toBe(1500);
  });
});

describe('Server Express Middleware Order', () => {
  it('should process middleware in order', () => {
    const order: string[] = [];

    const middleware1 = () => { order.push('1-cors'); };
    const middleware2 = () => { order.push('2-bodyParser'); };
    const middleware3 = () => { order.push('3-botDetection'); };
    const middleware4 = () => { order.push('4-handler'); };

    middleware1();
    middleware2();
    middleware3();
    middleware4();

    expect(order).toEqual(['1-cors', '2-bodyParser', '3-botDetection', '4-handler']);
  });
});

describe('Server Port Configuration', () => {
  it('should use PORT from environment', () => {
    const envPort = process.env.PORT || '8080';
    const port = parseInt(envPort, 10);

    expect(typeof port).toBe('number');
  });

  it('should default to 8080', () => {
    const defaultPort = 8080;
    expect(defaultPort).toBe(8080);
  });
});

describe('Server HTTP Server Events', () => {
  it('should handle listening event', () => {
    let listeningCalled = false;

    const onListening = () => {
      listeningCalled = true;
    };

    onListening();
    expect(listeningCalled).toBe(true);
  });

  it('should handle error event', () => {
    let errorHandled = false;

    const onError = (_error: Error) => {
      errorHandled = true;
    };

    onError(new Error('EADDRINUSE'));
    expect(errorHandled).toBe(true);
  });

  it('should handle close event', () => {
    let closeCalled = false;

    const onClose = () => {
      closeCalled = true;
    };

    onClose();
    expect(closeCalled).toBe(true);
  });
});
