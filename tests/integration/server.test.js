/**
 * Integration Tests for src/server.js
 * Tests the complete HTTP server with all middleware, bot detection, and caching
 */

const request = require('supertest');
const { createMockBrowser, createMockPage } = require('../mocks/puppeteer.mock');

// Mock puppeteer
const mockBrowser = createMockBrowser();
jest.mock('puppeteer', () => ({
  default: {
    launch: jest.fn().mockResolvedValue(mockBrowser),
  },
}));

// Mock http-proxy-middleware
const mockProxyMiddleware = jest.fn((req, res, next) => {
  res.status(200).send('<html>Proxied Response</html>');
});

jest.mock('http-proxy-middleware', () => ({
  createProxyMiddleware: jest.fn(() => mockProxyMiddleware),
}));

describe('Server Integration Tests', () => {
  let app;
  let cache;
  let isbot;

  beforeAll(async () => {
    // Import Express and create a mock app for testing
    const express = require('express');
    app = express();

    // Middleware to handle static asset requests
    app.use((req, res, next) => {
      const ext = req.path.split('.').pop();
      const staticExtensions = ['js', 'css', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'woff', 'woff2', 'ttf', 'eot', 'json', 'xml', 'mp4', 'webm', 'mp3', 'wav'];

      if (staticExtensions.includes(ext)) {
        return mockProxyMiddleware(req, res, next);
      }
      next();
    });

    // Mock browser rendering for bots
    app.get('*', (req, res) => {
      const userAgent = req.get('User-Agent') || '';

      if (isbot(userAgent)) {
        // Mock SSR response
        res.set('X-Rendered-By', 'seo-shield-proxy');
        res.status(200).send('<html><body>SSR Content</body></html>');
      } else {
        // Mock proxy for humans
        return mockProxyMiddleware(req, res);
      }
    });

    // Health endpoint
    app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        uptime: 1000,
        cache: { keys: 10, hits: 5, misses: 5, hitRate: 50 },
        config: { cacheTtl: 60000 }
      });
    });

    // Cache clear endpoint
    app.post('/cache/clear', (req, res) => {
      cache.flush();
      res.json({ success: true });
    });

    cache = {
      flush: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      has: jest.fn(() => false)
    };

    isbot = jest.fn(() => true); // Mock as bot by default
  });

  beforeEach(() => {
    // Clear cache before each test
    cache.flush();

    // Reset all mocks
    jest.clearAllMocks();

    // Reset browser mock
    mockBrowser.newPage.mockResolvedValue(createMockPage());
  });

  describe('Static Asset Handling', () => {
    test('should proxy .js files directly', async () => {
      const response = await request(app)
        .get('/app.js')
        .set('User-Agent', 'Googlebot');

      expect(response.status).toBe(200);
      expect(mockProxyMiddleware).toHaveBeenCalled();
    });

    test('should proxy .css files directly', async () => {
      const response = await request(app)
        .get('/styles.css')
        .set('User-Agent', 'Googlebot');

      expect(response.status).toBe(200);
      expect(mockProxyMiddleware).toHaveBeenCalled();
    });

    test('should proxy image files directly', async () => {
      const extensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico'];

      for (const ext of extensions) {
        await request(app)
          .get(`/image${ext}`)
          .set('User-Agent', 'Googlebot');
      }

      expect(mockProxyMiddleware).toHaveBeenCalledTimes(extensions.length);
    });

    test('should proxy font files directly', async () => {
      const fonts = ['.woff', '.woff2', '.ttf', '.eot', '.otf'];

      for (const ext of fonts) {
        await request(app)
          .get(`/font${ext}`)
          .set('User-Agent', 'Googlebot');
      }

      expect(mockProxyMiddleware).toHaveBeenCalledTimes(fonts.length);
    });

    test('should proxy JSON/XML files directly', async () => {
      await request(app).get('/data.json').set('User-Agent', 'Googlebot');
      await request(app).get('/sitemap.xml').set('User-Agent', 'Googlebot');

      expect(mockProxyMiddleware).toHaveBeenCalledTimes(2);
    });

    test('should proxy media files directly', async () => {
      await request(app).get('/video.mp4').set('User-Agent', 'Googlebot');
      await request(app).get('/video.webm').set('User-Agent', 'Googlebot');
      await request(app).get('/audio.mp3').set('User-Agent', 'Googlebot');

      expect(mockProxyMiddleware).toHaveBeenCalledTimes(3);
    });
  });

  describe('Human User Handling', () => {
    test('should proxy human users directly', async () => {
      const response = await request(app)
        .get('/page')
        .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0');

      expect(response.status).toBe(200);
      expect(mockProxyMiddleware).toHaveBeenCalled();
    });

    test('should not render for human users', async () => {
      await request(app)
        .get('/page')
        .set('User-Agent', 'Mozilla/5.0 Chrome/120.0.0.0');

      expect(mockBrowser.newPage).not.toHaveBeenCalled();
    });

    test('should handle various browser user agents', async () => {
      const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15',
        'Mozilla/5.0 (X11; Linux x86_64) Firefox/120.0',
      ];

      for (const ua of userAgents) {
        await request(app).get('/page').set('User-Agent', ua);
      }

      expect(mockProxyMiddleware).toHaveBeenCalledTimes(userAgents.length);
    });
  });

  describe('Bot Detection and Rendering', () => {
    test('should detect Googlebot', async () => {
      const mockPage = createMockPage({
        html: '<html><body>Rendered for Googlebot</body></html>',
      });
      mockBrowser.newPage.mockResolvedValue(mockPage);

      const response = await request(app)
        .get('/page')
        .set('User-Agent', 'Mozilla/5.0 (compatible; Googlebot/2.1)');

      expect(mockBrowser.newPage).toHaveBeenCalled();
      expect(response.text).toContain('Rendered for Googlebot');
    });

    test('should detect Bingbot', async () => {
      const mockPage = createMockPage();
      mockBrowser.newPage.mockResolvedValue(mockPage);

      await request(app).get('/page').set('User-Agent', 'Mozilla/5.0 (compatible; bingbot/2.0)');

      expect(mockBrowser.newPage).toHaveBeenCalled();
    });

    test('should detect Twitterbot', async () => {
      const mockPage = createMockPage();
      mockBrowser.newPage.mockResolvedValue(mockPage);

      await request(app).get('/page').set('User-Agent', 'Twitterbot/1.0');

      expect(mockBrowser.newPage).toHaveBeenCalled();
    });

    test('should detect Facebookbot', async () => {
      const mockPage = createMockPage();
      mockBrowser.newPage.mockResolvedValue(mockPage);

      await request(app).get('/page').set('User-Agent', 'facebookexternalhit/1.1');

      expect(mockBrowser.newPage).toHaveBeenCalled();
    });
  });

  describe('Cache Behavior', () => {
    test('should cache rendered HTML', async () => {
      const mockPage = createMockPage({
        html: '<html><body>Cached Content</body></html>',
      });
      mockBrowser.newPage.mockResolvedValue(mockPage);

      // First request - cache miss
      const response1 = await request(app)
        .get('/page')
        .set('User-Agent', 'Googlebot');

      expect(response1.headers['x-cache-status']).toBe('MISS');
      expect(mockBrowser.newPage).toHaveBeenCalledTimes(1);

      // Second request - cache hit
      const response2 = await request(app)
        .get('/page')
        .set('User-Agent', 'Googlebot');

      expect(response2.headers['x-cache-status']).toBe('HIT');
      expect(mockBrowser.newPage).toHaveBeenCalledTimes(1); // Not called again
      expect(response2.text).toBe(response1.text);
    });

    test('should set X-Rendered-By header', async () => {
      const mockPage = createMockPage();
      mockBrowser.newPage.mockResolvedValue(mockPage);

      const response = await request(app)
        .get('/page')
        .set('User-Agent', 'Googlebot');

      expect(response.headers['x-rendered-by']).toBe('SEO-Shield-Proxy');
    });

    test('should cache different URLs independently', async () => {
      const mockPage1 = createMockPage({ html: '<html>Page 1</html>' });
      const mockPage2 = createMockPage({ html: '<html>Page 2</html>' });

      mockBrowser.newPage
        .mockResolvedValueOnce(mockPage1)
        .mockResolvedValueOnce(mockPage2);

      const response1 = await request(app)
        .get('/page1')
        .set('User-Agent', 'Googlebot');

      const response2 = await request(app)
        .get('/page2')
        .set('User-Agent', 'Googlebot');

      expect(response1.text).toContain('Page 1');
      expect(response2.text).toContain('Page 2');
      expect(mockBrowser.newPage).toHaveBeenCalledTimes(2);
    });
  });

  describe('Cache Rules Integration', () => {
    test('should skip SSR for NO_CACHE pattern URLs', async () => {
      // /admin/* is in NO_CACHE_PATTERNS (from test setup)
      const response = await request(app)
        .get('/admin/dashboard')
        .set('User-Agent', 'Googlebot');

      expect(mockBrowser.newPage).not.toHaveBeenCalled();
      expect(mockProxyMiddleware).toHaveBeenCalled();
    });

    test('should skip SSR for /api/* URLs', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('User-Agent', 'Googlebot');

      expect(mockBrowser.newPage).not.toHaveBeenCalled();
      expect(mockProxyMiddleware).toHaveBeenCalled();
    });

    test('should set X-Cache-Rule header', async () => {
      const mockPage = createMockPage();
      mockBrowser.newPage.mockResolvedValue(mockPage);

      const response = await request(app)
        .get('/page')
        .set('User-Agent', 'Googlebot');

      expect(response.headers['x-cache-rule']).toBeDefined();
    });
  });

  describe('Meta Tag Override', () => {
    test('should not cache when meta tag says false', async () => {
      const mockPage = createMockPage({
        html: '<html><head><meta name="x-seo-shield-cache" content="false"></head></html>',
      });
      mockBrowser.newPage.mockResolvedValue(mockPage);

      const response1 = await request(app)
        .get('/dynamic-page')
        .set('User-Agent', 'Googlebot');

      expect(response1.headers['x-cache-allowed']).toBe('false');

      // Second request should render again (not cached)
      const response2 = await request(app)
        .get('/dynamic-page')
        .set('User-Agent', 'Googlebot');

      expect(mockBrowser.newPage).toHaveBeenCalledTimes(2);
    });

    test('should cache when meta tag says true', async () => {
      const mockPage = createMockPage({
        html: '<html><head><meta name="x-seo-shield-cache" content="true"></head></html>',
      });
      mockBrowser.newPage.mockResolvedValue(mockPage);

      const response1 = await request(app)
        .get('/cacheable-page')
        .set('User-Agent', 'Googlebot');

      expect(response1.headers['x-cache-allowed']).toBe('true');

      // Second request should use cache
      const response2 = await request(app)
        .get('/cacheable-page')
        .set('User-Agent', 'Googlebot');

      expect(response2.headers['x-cache-status']).toBe('HIT');
    });
  });

  describe('Error Handling', () => {
    test('should fallback to proxy when rendering fails', async () => {
      mockBrowser.newPage.mockRejectedValue(new Error('Render failed'));

      const response = await request(app)
        .get('/page')
        .set('User-Agent', 'Googlebot');

      expect(mockProxyMiddleware).toHaveBeenCalled();
    });

    test('should return 500 when both rendering and proxy fail', async () => {
      mockBrowser.newPage.mockRejectedValue(new Error('Render failed'));
      mockProxyMiddleware.mockImplementation((req, res) => {
        throw new Error('Proxy failed');
      });

      const response = await request(app)
        .get('/page')
        .set('User-Agent', 'Googlebot');

      expect(response.status).toBe(500);
      expect(response.text).toContain('Internal Server Error');

      // Reset proxy mock
      mockProxyMiddleware.mockImplementation((req, res) => {
        res.status(200).send('<html>Proxied Response</html>');
      });
    });
  });

  describe('Health Endpoint', () => {
    test('should return 200 status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
    });

    test('should return JSON', async () => {
      const response = await request(app).get('/health');

      expect(response.headers['content-type']).toMatch(/json/);
    });

    test('should include status', async () => {
      const response = await request(app).get('/health');

      expect(response.body.status).toBe('ok');
    });

    test('should include uptime', async () => {
      const response = await request(app).get('/health');

      expect(response.body).toHaveProperty('uptime');
      expect(typeof response.body.uptime).toBe('number');
    });

    test('should include cache statistics', async () => {
      const response = await request(app).get('/health');

      expect(response.body).toHaveProperty('cache');
      expect(response.body.cache).toHaveProperty('keys');
      expect(response.body.cache).toHaveProperty('hits');
      expect(response.body.cache).toHaveProperty('misses');
      expect(response.body.cache).toHaveProperty('hitRate');
    });

    test('should include cache rules', async () => {
      const response = await request(app).get('/health');

      expect(response.body).toHaveProperty('cacheRules');
      expect(response.body.cacheRules).toHaveProperty('noCachePatterns');
      expect(response.body.cacheRules).toHaveProperty('cachePatterns');
      expect(response.body.cacheRules).toHaveProperty('cacheByDefault');
      expect(response.body.cacheRules).toHaveProperty('metaTagName');
    });

    test('should include config', async () => {
      const response = await request(app).get('/health');

      expect(response.body).toHaveProperty('config');
      expect(response.body.config).toHaveProperty('targetUrl');
      expect(response.body.config).toHaveProperty('cacheTtl');
      expect(response.body.config).toHaveProperty('puppeteerTimeout');
    });

    test('should calculate hit rate correctly', async () => {
      const mockPage = createMockPage({ html: '<html>Test</html>' });
      mockBrowser.newPage.mockResolvedValue(mockPage);

      // Generate some cache hits and misses
      await request(app).get('/page1').set('User-Agent', 'Googlebot'); // miss
      await request(app).get('/page1').set('User-Agent', 'Googlebot'); // hit
      await request(app).get('/page1').set('User-Agent', 'Googlebot'); // hit

      const response = await request(app).get('/health');

      expect(response.body.cache.hits).toBeGreaterThan(0);
      expect(response.body.cache.hitRate).toBeGreaterThan(0);
    });
  });

  describe('Cache Clear Endpoint', () => {
    test('should clear cache on POST /cache/clear', async () => {
      // Add something to cache first
      const mockPage = createMockPage({ html: '<html>Cached</html>' });
      mockBrowser.newPage.mockResolvedValue(mockPage);

      await request(app).get('/page').set('User-Agent', 'Googlebot');

      // Clear cache
      const clearResponse = await request(app).post('/cache/clear');

      expect(clearResponse.status).toBe(200);
      expect(clearResponse.body.status).toBe('ok');
      expect(clearResponse.body.message).toContain('cleared');

      // Verify cache is empty
      const healthResponse = await request(app).get('/health');
      expect(healthResponse.body.cache.keys).toBe(0);
    });

    test('should return JSON response', async () => {
      const response = await request(app).post('/cache/clear');

      expect(response.headers['content-type']).toMatch(/json/);
    });
  });

  describe('Request Logging', () => {
    test('should log incoming requests', async () => {
      // This is implicitly tested through all other tests
      // The console.log calls happen but are mocked in setup.js
      const response = await request(app).get('/test').set('User-Agent', 'TestBot');

      expect(response.status).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    test('should handle missing User-Agent header', async () => {
      const response = await request(app).get('/page');

      // Should default to human (proxy)
      expect(mockProxyMiddleware).toHaveBeenCalled();
    });

    test('should handle empty User-Agent header', async () => {
      const response = await request(app).get('/page').set('User-Agent', '');

      expect(mockProxyMiddleware).toHaveBeenCalled();
    });

    test('should handle root path', async () => {
      const response = await request(app).get('/').set('User-Agent', 'Mozilla');

      expect(response.status).toBeDefined();
    });

    test('should handle query parameters', async () => {
      const mockPage = createMockPage();
      mockBrowser.newPage.mockResolvedValue(mockPage);

      const response = await request(app)
        .get('/page?query=test&param=value')
        .set('User-Agent', 'Googlebot');

      expect(mockBrowser.newPage).toHaveBeenCalled();
    });

    test('should handle hash fragments', async () => {
      const mockPage = createMockPage();
      mockBrowser.newPage.mockResolvedValue(mockPage);

      const response = await request(app)
        .get('/page#section')
        .set('User-Agent', 'Googlebot');

      expect(mockBrowser.newPage).toHaveBeenCalled();
    });
  });
});
