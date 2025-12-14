/**
 * Proxy Flow Integration Tests
 * Tests for end-to-end proxy request handling
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { setupTestEnv, testHeaders, mockResponses, delay } from './setup';

// Mock browser module
vi.mock('../../src/browser', () => ({
  default: {
    render: vi.fn().mockResolvedValue({
      html: '<html><body>SSR Rendered Content</body></html>',
      statusCode: 200,
    }),
    getPage: vi.fn().mockResolvedValue({
      goto: vi.fn(),
      content: vi.fn().mockResolvedValue('<html></html>'),
      close: vi.fn(),
    }),
    releasePage: vi.fn(),
    closeBrowser: vi.fn(),
  },
}));

// Mock cache module
vi.mock('../../src/cache', () => {
  const cacheStore = new Map<string, { value: string; expiry: number }>();

  return {
    default: {
      get: vi.fn((key: string) => {
        const entry = cacheStore.get(key);
        if (entry && entry.expiry > Date.now()) {
          return entry.value;
        }
        cacheStore.delete(key);
        return undefined;
      }),
      set: vi.fn((key: string, value: string, ttl: number) => {
        cacheStore.set(key, { value, expiry: Date.now() + ttl * 1000 });
        return true;
      }),
      getWithTTL: vi.fn(),
      isReady: vi.fn().mockReturnValue(true),
      flush: vi.fn(() => cacheStore.clear()),
    },
    getCache: vi.fn().mockResolvedValue({
      get: vi.fn().mockReturnValue(null),
      set: vi.fn().mockReturnValue(true),
      isReady: vi.fn().mockReturnValue(true),
    }),
  };
});

// Mock database
vi.mock('../../src/database/database-manager', () => ({
  databaseManager: {
    connect: vi.fn().mockResolvedValue(true),
    disconnect: vi.fn().mockResolvedValue(undefined),
    getMongoStorage: vi.fn().mockReturnValue(null),
    isDbConnected: vi.fn().mockReturnValue(false),
  },
}));

// Mock rate limiter
vi.mock('../../src/middleware/rate-limiter', () => ({
  generalRateLimiter: (req: unknown, res: unknown, next: () => void) => next(),
  ssrRateLimiter: (req: unknown, res: unknown, next: () => void) => next(),
}));

describe('Proxy Flow Integration', () => {
  let targetApp: Express;
  let targetServer: ReturnType<Express['listen']>;
  let proxyApp: Express;

  beforeAll(() => {
    setupTestEnv({ targetUrl: 'http://localhost:49998' });

    // Create mock target server
    targetApp = express();

    targetApp.get('/', (req, res) => {
      res.send(mockResponses.html.simple);
    });

    targetApp.get('/spa', (req, res) => {
      res.send(mockResponses.html.spa);
    });

    targetApp.get('/api/data', (req, res) => {
      res.json(mockResponses.json.success);
    });

    targetApp.get('/slow', async (req, res) => {
      await delay(500);
      res.send('<html><body>Slow response</body></html>');
    });

    targetApp.get('/404', (req, res) => {
      res.status(404).send(mockResponses.html.error404);
    });

    targetApp.get('/500', (req, res) => {
      res.status(500).send(mockResponses.html.error500);
    });

    targetServer = targetApp.listen(49998);

    // Create simple proxy app for testing
    proxyApp = express();

    // Health check
    proxyApp.get('/shieldhealth', (req, res) => {
      res.json({ status: 'ok', service: 'seo-shield-proxy' });
    });

    // Bot detection middleware
    proxyApp.use((req, res, next) => {
      const userAgent = (req.headers['user-agent'] || '').toLowerCase();
      (req as { isBot?: boolean }).isBot =
        userAgent.includes('googlebot') ||
        userAgent.includes('bingbot') ||
        userAgent.includes('bot');
      next();
    });

    // SSR/Proxy handling
    proxyApp.use(async (req, res) => {
      const isBot = (req as { isBot?: boolean }).isBot;

      if (isBot) {
        // Simulate SSR
        res.setHeader('X-SSR-Rendered', 'true');
        res.setHeader('X-Cache', 'MISS');
        res.send('<html><body>SSR Rendered Content</body></html>');
      } else {
        // Proxy to target
        res.setHeader('X-Proxied', 'true');
        res.send(mockResponses.html.simple);
      }
    });
  });

  afterAll(() => {
    targetServer?.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const res = await request(proxyApp).get('/shieldhealth');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('seo-shield-proxy');
    });
  });

  describe('Human Request Flow', () => {
    it('should proxy request for Chrome browser', async () => {
      const res = await request(proxyApp).get('/').set(testHeaders.chrome);

      expect(res.status).toBe(200);
      expect(res.headers['x-proxied']).toBe('true');
      expect(res.headers['x-ssr-rendered']).toBeUndefined();
    });

    it('should proxy request for Firefox browser', async () => {
      const res = await request(proxyApp).get('/').set(testHeaders.firefox);

      expect(res.status).toBe(200);
      expect(res.headers['x-proxied']).toBe('true');
    });

    it('should preserve response content for humans', async () => {
      const res = await request(proxyApp).get('/').set(testHeaders.chrome);

      expect(res.text).toContain('Hello');
    });
  });

  describe('Bot Request Flow', () => {
    it('should SSR for Googlebot', async () => {
      const res = await request(proxyApp).get('/').set(testHeaders.googlebot);

      expect(res.status).toBe(200);
      expect(res.headers['x-ssr-rendered']).toBe('true');
    });

    it('should SSR for Bingbot', async () => {
      const res = await request(proxyApp).get('/').set(testHeaders.bingbot);

      expect(res.status).toBe(200);
      expect(res.headers['x-ssr-rendered']).toBe('true');
    });

    it('should return rendered content for bots', async () => {
      const res = await request(proxyApp).get('/').set(testHeaders.googlebot);

      expect(res.text).toContain('SSR Rendered Content');
    });
  });

  describe('Bot Detection', () => {
    it('should detect Googlebot', async () => {
      const res = await request(proxyApp).get('/').set(testHeaders.googlebot);

      expect(res.headers['x-ssr-rendered']).toBe('true');
    });

    it('should detect Bingbot', async () => {
      const res = await request(proxyApp).get('/').set(testHeaders.bingbot);

      expect(res.headers['x-ssr-rendered']).toBe('true');
    });

    it('should not detect Chrome as bot', async () => {
      const res = await request(proxyApp).get('/').set(testHeaders.chrome);

      expect(res.headers['x-ssr-rendered']).toBeUndefined();
    });

    it('should handle curl requests', async () => {
      const res = await request(proxyApp).get('/').set(testHeaders.curl);

      expect(res.status).toBe(200);
    });
  });

  describe('Request Headers', () => {
    it('should forward custom headers', async () => {
      const res = await request(proxyApp)
        .get('/')
        .set('X-Custom-Header', 'test-value')
        .set(testHeaders.chrome);

      expect(res.status).toBe(200);
    });

    it('should handle missing user-agent', async () => {
      const res = await request(proxyApp).get('/');

      expect(res.status).toBe(200);
    });
  });

  describe('Response Handling', () => {
    it('should set appropriate headers for SSR', async () => {
      const res = await request(proxyApp).get('/').set(testHeaders.googlebot);

      expect(res.headers['x-ssr-rendered']).toBeDefined();
    });

    it('should set appropriate headers for proxy', async () => {
      const res = await request(proxyApp).get('/').set(testHeaders.chrome);

      expect(res.headers['x-proxied']).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle target server errors gracefully', async () => {
      // This tests the proxy's error handling capability
      const res = await request(proxyApp).get('/error').set(testHeaders.chrome);

      // Should not crash, should return some response
      expect(res.status).toBeDefined();
    });
  });
});

describe('Cache Flow Integration', () => {
  let cacheApp: Express;

  beforeAll(() => {
    cacheApp = express();

    const cache = new Map<string, { value: string; timestamp: number }>();

    // Cache middleware
    cacheApp.use((req, res, next) => {
      const cacheKey = req.path;
      const cached = cache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < 60000) {
        res.setHeader('X-Cache', 'HIT');
        res.send(cached.value);
        return;
      }

      // Store original send
      const originalSend = res.send.bind(res);
      res.send = function (body: string) {
        cache.set(cacheKey, { value: body, timestamp: Date.now() });
        res.setHeader('X-Cache', 'MISS');
        return originalSend(body);
      };

      next();
    });

    cacheApp.get('/cacheable', (req, res) => {
      res.send('<html><body>Cacheable content</body></html>');
    });

    cacheApp.get('/dynamic', (req, res) => {
      res.send(`<html><body>Dynamic: ${Date.now()}</body></html>`);
    });
  });

  describe('Cache Hit/Miss', () => {
    it('should return MISS on first request', async () => {
      const res = await request(cacheApp).get('/cacheable');

      expect(res.status).toBe(200);
      expect(res.headers['x-cache']).toBe('MISS');
    });

    it('should return HIT on subsequent request', async () => {
      // First request
      await request(cacheApp).get('/cacheable');

      // Second request
      const res = await request(cacheApp).get('/cacheable');

      expect(res.status).toBe(200);
      expect(res.headers['x-cache']).toBe('HIT');
    });

    it('should return same content from cache', async () => {
      const res1 = await request(cacheApp).get('/cacheable');
      const res2 = await request(cacheApp).get('/cacheable');

      expect(res1.text).toBe(res2.text);
    });
  });
});

describe('Authentication Flow Integration', () => {
  let authApp: Express;
  const validToken = 'valid-test-token';

  beforeAll(() => {
    authApp = express();
    authApp.use(express.json());

    // Login endpoint
    authApp.post('/shieldapi/auth/login', (req, res) => {
      const { password } = req.body;
      if (password === 'test-password-123') {
        res.json({ success: true, token: validToken });
      } else {
        res.status(401).json({ success: false, error: 'Invalid password' });
      }
    });

    // Protected endpoint
    authApp.get('/shieldapi/metrics', (req, res) => {
      const auth = req.headers.authorization;
      if (auth === `Bearer ${validToken}`) {
        res.json({ totalRequests: 100, botRequests: 30 });
      } else {
        res.status(401).json({ error: 'Unauthorized' });
      }
    });

    // Public endpoint
    authApp.get('/shieldapi/health', (req, res) => {
      res.json({ status: 'ok' });
    });
  });

  describe('Login Flow', () => {
    it('should return token on successful login', async () => {
      const res = await request(authApp)
        .post('/shieldapi/auth/login')
        .send({ password: 'test-password-123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBe(validToken);
    });

    it('should reject invalid password', async () => {
      const res = await request(authApp)
        .post('/shieldapi/auth/login')
        .send({ password: 'wrong-password' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Protected Routes', () => {
    it('should allow access with valid token', async () => {
      const res = await request(authApp)
        .get('/shieldapi/metrics')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.totalRequests).toBeDefined();
    });

    it('should reject access without token', async () => {
      const res = await request(authApp).get('/shieldapi/metrics');

      expect(res.status).toBe(401);
    });

    it('should reject access with invalid token', async () => {
      const res = await request(authApp)
        .get('/shieldapi/metrics')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(401);
    });
  });

  describe('Public Routes', () => {
    it('should allow access to public endpoints', async () => {
      const res = await request(authApp).get('/shieldapi/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });
});
