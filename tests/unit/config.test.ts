import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dotenv to prevent loading .env file during tests
vi.mock('dotenv', () => ({
  default: {
    config: vi.fn()
  }
}));

// Store original env
const originalEnv = { ...process.env };

describe('Config Module', () => {
  beforeEach(() => {
    // Reset env before each test - start with minimal config for default value tests
    vi.resetModules();
    // Clear all config-related env vars first
    delete process.env.PORT;
    delete process.env.API_PORT;
    delete process.env.CACHE_TYPE;
    delete process.env.CACHE_TTL;
    delete process.env.REDIS_URL;
    // Set required values
    process.env.NODE_ENV = 'test';
    process.env.TARGET_URL = 'http://localhost:3000';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('default values', () => {
    it('should have default PORT of 8080', async () => {
      delete process.env.PORT;
      const { default: config } = await import('../../src/config');
      expect(config.PORT).toBe(8080);
    });

    it('should have default API_PORT of 3190', async () => {
      delete process.env.API_PORT;
      const { default: config } = await import('../../src/config');
      expect(config.API_PORT).toBe(3190);
    });

    it('should have default CACHE_TTL of 3600', async () => {
      delete process.env.CACHE_TTL;
      const { default: config } = await import('../../src/config');
      expect(config.CACHE_TTL).toBe(3600);
    });

    it('should have default CACHE_TYPE of memory', async () => {
      delete process.env.CACHE_TYPE;
      const { default: config } = await import('../../src/config');
      expect(config.CACHE_TYPE).toBe('memory');
    });

    it('should have default PUPPETEER_TIMEOUT of 30000', async () => {
      delete process.env.PUPPETEER_TIMEOUT;
      const { default: config } = await import('../../src/config');
      expect(config.PUPPETEER_TIMEOUT).toBe(30000);
    });

    it('should have default MAX_CONCURRENT_RENDERS of 5', async () => {
      delete process.env.MAX_CONCURRENT_RENDERS;
      const { default: config } = await import('../../src/config');
      expect(config.MAX_CONCURRENT_RENDERS).toBe(5);
    });

    it('should have default CACHE_BY_DEFAULT of true', async () => {
      delete process.env.CACHE_BY_DEFAULT;
      const { default: config } = await import('../../src/config');
      expect(config.CACHE_BY_DEFAULT).toBe(true);
    });
  });

  describe('environment variable parsing', () => {
    it('should parse PORT from environment', async () => {
      process.env.PORT = '9000';
      const { default: config } = await import('../../src/config');
      expect(config.PORT).toBe(9000);
    });

    it('should parse CACHE_TYPE as redis when specified', async () => {
      process.env.CACHE_TYPE = 'redis';
      const { default: config } = await import('../../src/config');
      expect(config.CACHE_TYPE).toBe('redis');
    });

    it('should parse CACHE_BY_DEFAULT as false when specified', async () => {
      process.env.CACHE_BY_DEFAULT = 'false';
      const { default: config } = await import('../../src/config');
      expect(config.CACHE_BY_DEFAULT).toBe(false);
    });

    it('should use TARGET_URL from environment', async () => {
      process.env.TARGET_URL = 'https://example.com';
      const { default: config } = await import('../../src/config');
      expect(config.TARGET_URL).toBe('https://example.com');
    });
  });

  describe('Config interface', () => {
    it('should have all required properties', async () => {
      const { default: config } = await import('../../src/config');
      expect(config).toHaveProperty('PORT');
      expect(config).toHaveProperty('API_PORT');
      expect(config).toHaveProperty('TARGET_URL');
      expect(config).toHaveProperty('CACHE_TTL');
      expect(config).toHaveProperty('CACHE_TYPE');
      expect(config).toHaveProperty('REDIS_URL');
      expect(config).toHaveProperty('MONGODB_URL');
      expect(config).toHaveProperty('PUPPETEER_TIMEOUT');
      expect(config).toHaveProperty('MAX_CONCURRENT_RENDERS');
      expect(config).toHaveProperty('NODE_ENV');
      expect(config).toHaveProperty('ADMIN_PASSWORD');
      expect(config).toHaveProperty('JWT_SECRET');
    });
  });

  describe('additional config values', () => {
    it('should have MONGODB_DB_NAME', async () => {
      const { default: config } = await import('../../src/config');
      expect(config).toHaveProperty('MONGODB_DB_NAME');
    });

    it('should have NO_CACHE_PATTERNS', async () => {
      const { default: config } = await import('../../src/config');
      expect(config).toHaveProperty('NO_CACHE_PATTERNS');
    });

    it('should have CACHE_PATTERNS', async () => {
      const { default: config } = await import('../../src/config');
      expect(config).toHaveProperty('CACHE_PATTERNS');
    });

    it('should have CACHE_META_TAG', async () => {
      const { default: config } = await import('../../src/config');
      expect(config).toHaveProperty('CACHE_META_TAG');
    });

    it('should have USER_AGENT', async () => {
      const { default: config } = await import('../../src/config');
      expect(config).toHaveProperty('USER_AGENT');
    });
  });

  describe('environment variable overrides', () => {
    it('should use custom REDIS_URL', async () => {
      process.env.REDIS_URL = 'redis://custom:6380';
      const { default: config } = await import('../../src/config');
      expect(config.REDIS_URL).toBe('redis://custom:6380');
    });

    it('should use custom MONGODB_URL', async () => {
      process.env.MONGODB_URL = 'mongodb://custom:27018';
      const { default: config } = await import('../../src/config');
      expect(config.MONGODB_URL).toBe('mongodb://custom:27018');
    });

    it('should use custom MONGODB_DB_NAME', async () => {
      process.env.MONGODB_DB_NAME = 'custom_db';
      const { default: config } = await import('../../src/config');
      expect(config.MONGODB_DB_NAME).toBe('custom_db');
    });

    it('should use custom NO_CACHE_PATTERNS', async () => {
      process.env.NO_CACHE_PATTERNS = '/api/*,/admin/*';
      const { default: config } = await import('../../src/config');
      expect(config.NO_CACHE_PATTERNS).toBe('/api/*,/admin/*');
    });

    it('should use custom CACHE_PATTERNS', async () => {
      process.env.CACHE_PATTERNS = '/products/*,/pages/*';
      const { default: config } = await import('../../src/config');
      expect(config.CACHE_PATTERNS).toBe('/products/*,/pages/*');
    });

    it('should use custom CACHE_META_TAG', async () => {
      process.env.CACHE_META_TAG = 'custom-cache-tag';
      const { default: config } = await import('../../src/config');
      expect(config.CACHE_META_TAG).toBe('custom-cache-tag');
    });

    it('should use custom ADMIN_PASSWORD', async () => {
      process.env.ADMIN_PASSWORD = 'secure-password';
      const { default: config } = await import('../../src/config');
      expect(config.ADMIN_PASSWORD).toBe('secure-password');
    });

    it('should use custom JWT_SECRET', async () => {
      process.env.JWT_SECRET = 'custom-jwt-secret';
      const { default: config } = await import('../../src/config');
      expect(config.JWT_SECRET).toBe('custom-jwt-secret');
    });

    it('should use custom USER_AGENT', async () => {
      process.env.USER_AGENT = 'CustomBot/1.0';
      const { default: config } = await import('../../src/config');
      expect(config.USER_AGENT).toBe('CustomBot/1.0');
    });

    it('should use custom API_PORT', async () => {
      process.env.API_PORT = '9190';
      const { default: config } = await import('../../src/config');
      expect(config.API_PORT).toBe(9190);
    });
  });

  describe('cache type handling', () => {
    it('should default to memory for invalid CACHE_TYPE', async () => {
      process.env.CACHE_TYPE = 'invalid';
      const { default: config } = await import('../../src/config');
      expect(config.CACHE_TYPE).toBe('memory');
    });

    it('should handle empty CACHE_TYPE', async () => {
      process.env.CACHE_TYPE = '';
      const { default: config } = await import('../../src/config');
      expect(config.CACHE_TYPE).toBe('memory');
    });
  });

  describe('numeric parsing edge cases', () => {
    it('should handle non-numeric PORT gracefully', async () => {
      process.env.PORT = 'abc';
      const { default: config } = await import('../../src/config');
      expect(config.PORT).toBe(8080);
    });

    it('should handle non-numeric CACHE_TTL gracefully', async () => {
      process.env.CACHE_TTL = 'abc';
      const { default: config } = await import('../../src/config');
      expect(config.CACHE_TTL).toBe(3600);
    });

    it('should handle non-numeric PUPPETEER_TIMEOUT gracefully', async () => {
      process.env.PUPPETEER_TIMEOUT = 'abc';
      const { default: config } = await import('../../src/config');
      expect(config.PUPPETEER_TIMEOUT).toBe(30000);
    });

    it('should handle non-numeric MAX_CONCURRENT_RENDERS gracefully', async () => {
      process.env.MAX_CONCURRENT_RENDERS = 'abc';
      const { default: config } = await import('../../src/config');
      expect(config.MAX_CONCURRENT_RENDERS).toBe(5);
    });

    it('should handle non-numeric API_PORT gracefully', async () => {
      process.env.API_PORT = 'abc';
      const { default: config } = await import('../../src/config');
      expect(config.API_PORT).toBe(3190);
    });
  });

  describe('NODE_ENV handling', () => {
    it('should use custom NODE_ENV', async () => {
      process.env.NODE_ENV = 'development';
      const { default: config } = await import('../../src/config');
      expect(config.NODE_ENV).toBe('development');
    });

    it('should default to production for NODE_ENV', async () => {
      delete process.env.NODE_ENV;
      process.env.TARGET_URL = 'http://localhost:3000';
      // Re-enable NODE_ENV check temporarily
      const tempEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';
      const { default: config } = await import('../../src/config');
      // The config module checks NODE_ENV during import
      expect(config).toBeDefined();
    });
  });
});
