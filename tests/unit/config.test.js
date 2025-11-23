/**
 * Unit Tests for src/config.js
 * Tests configuration loading, validation, and defaults
 */

import { jest } from '@jest/globals';

describe('Config Module', () => {
  let originalEnv;
  let originalExit;
  let originalConsole;
  let consoleErrorSpy;
  let processExitSpy;

  beforeEach(() => {
    // Save original environment
    originalEnv = process.env;
    originalExit = process.exit;
    originalConsole = console.error;

    // Mock process.exit to prevent test termination
    processExitSpy = jest.fn();
    process.exit = processExitSpy;

    // Mock console.error
    consoleErrorSpy = jest.fn();
    console.error = consoleErrorSpy;

    // Clear module cache to reload config
    jest.resetModules();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    process.exit = originalExit;
    console.error = originalConsole;
  });

  describe('Required Configuration', () => {
    test('should fail if TARGET_URL is missing', async () => {
      // Arrange
      process.env = {
        ...originalEnv,
        TARGET_URL: undefined,
      };

      // Act
      await import('../../src/config.js');

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ ERROR: TARGET_URL environment variable is required'
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    test('should fail if TARGET_URL is empty string', async () => {
      // Arrange
      process.env = {
        ...originalEnv,
        TARGET_URL: '',
      };

      // Act
      await import('../../src/config.js');

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    test('should fail if TARGET_URL is invalid URL format', async () => {
      // Arrange
      process.env = {
        ...originalEnv,
        TARGET_URL: 'not-a-valid-url',
      };

      // Act
      await import('../../src/config.js');

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ ERROR: TARGET_URL must be a valid URL (e.g., https://example.com)'
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    test('should accept valid TARGET_URL', async () => {
      // Arrange
      process.env = {
        ...originalEnv,
        TARGET_URL: 'https://example.com',
      };

      // Act
      const { default: config } = await import('../../src/config.js');

      // Assert
      expect(config.TARGET_URL).toBe('https://example.com');
      expect(processExitSpy).not.toHaveBeenCalled();
    });
  });

  describe('Default Values', () => {
    beforeEach(() => {
      // Only set TARGET_URL, let others use defaults
      process.env = {
        NODE_PATH: originalEnv.NODE_PATH,
        PATH: originalEnv.PATH,
        TARGET_URL: 'https://test.com',
      };
    });

    test('should use default PORT (8080)', async () => {
      const { default: config } = await import('../../src/config.js');
      expect(config.PORT).toBe(8080);
    });

    test('should use default CACHE_TTL (3600)', async () => {
      const { default: config } = await import('../../src/config.js');
      expect(config.CACHE_TTL).toBe(3600);
    });

    test('should use default PUPPETEER_TIMEOUT (30000)', async () => {
      const { default: config } = await import('../../src/config.js');
      expect(config.PUPPETEER_TIMEOUT).toBe(30000);
    });

    test('should use default NODE_ENV (production)', async () => {
      const { default: config } = await import('../../src/config.js');
      expect(config.NODE_ENV).toBe('production');
    });

    test('should use default CACHE_BY_DEFAULT (true)', async () => {
      const { default: config } = await import('../../src/config.js');
      expect(config.CACHE_BY_DEFAULT).toBe('true');
    });

    test('should use default CACHE_META_TAG', async () => {
      const { default: config } = await import('../../src/config.js');
      expect(config.CACHE_META_TAG).toBe('x-seo-shield-cache');
    });

    test('should use empty string for NO_CACHE_PATTERNS by default', async () => {
      const { default: config } = await import('../../src/config.js');
      expect(config.NO_CACHE_PATTERNS).toBe('');
    });

    test('should use empty string for CACHE_PATTERNS by default', async () => {
      const { default: config } = await import('../../src/config.js');
      expect(config.CACHE_PATTERNS).toBe('');
    });
  });

  describe('Custom Configuration', () => {
    test('should parse custom PORT', async () => {
      process.env = {
        ...originalEnv,
        TARGET_URL: 'https://test.com',
        PORT: '3000',
      };

      const { default: config } = await import('../../src/config.js');
      expect(config.PORT).toBe(3000);
    });

    test('should parse custom CACHE_TTL', async () => {
      process.env = {
        ...originalEnv,
        TARGET_URL: 'https://test.com',
        CACHE_TTL: '7200',
      };

      const { default: config } = await import('../../src/config.js');
      expect(config.CACHE_TTL).toBe(7200);
    });

    test('should parse custom PUPPETEER_TIMEOUT', async () => {
      process.env = {
        ...originalEnv,
        TARGET_URL: 'https://test.com',
        PUPPETEER_TIMEOUT: '60000',
      };

      const { default: config } = await import('../../src/config.js');
      expect(config.PUPPETEER_TIMEOUT).toBe(60000);
    });

    test('should accept custom NODE_ENV', async () => {
      process.env = {
        ...originalEnv,
        TARGET_URL: 'https://test.com',
        NODE_ENV: 'development',
      };

      const { default: config } = await import('../../src/config.js');
      expect(config.NODE_ENV).toBe('development');
    });

    test('should accept custom NO_CACHE_PATTERNS', async () => {
      process.env = {
        ...originalEnv,
        TARGET_URL: 'https://test.com',
        NO_CACHE_PATTERNS: '/admin/*,/api/*',
      };

      const { default: config } = await import('../../src/config.js');
      expect(config.NO_CACHE_PATTERNS).toBe('/admin/*,/api/*');
    });

    test('should accept custom CACHE_PATTERNS', async () => {
      process.env = {
        ...originalEnv,
        TARGET_URL: 'https://test.com',
        CACHE_PATTERNS: '/blog/*,/products/*',
      };

      const { default: config } = await import('../../src/config.js');
      expect(config.CACHE_PATTERNS).toBe('/blog/*,/products/*');
    });

    test('should accept custom CACHE_BY_DEFAULT', async () => {
      process.env = {
        ...originalEnv,
        TARGET_URL: 'https://test.com',
        CACHE_BY_DEFAULT: 'false',
      };

      const { default: config } = await import('../../src/config.js');
      expect(config.CACHE_BY_DEFAULT).toBe('false');
    });

    test('should accept custom CACHE_META_TAG', async () => {
      process.env = {
        ...originalEnv,
        TARGET_URL: 'https://test.com',
        CACHE_META_TAG: 'custom-cache-tag',
      };

      const { default: config } = await import('../../src/config.js');
      expect(config.CACHE_META_TAG).toBe('custom-cache-tag');
    });
  });

  describe('Type Conversion', () => {
    test('should convert PORT to integer', async () => {
      process.env = {
        ...originalEnv,
        TARGET_URL: 'https://test.com',
        PORT: '9000',
      };

      const { default: config } = await import('../../src/config.js');
      expect(typeof config.PORT).toBe('number');
      expect(config.PORT).toBe(9000);
    });

    test('should handle invalid PORT gracefully (use default)', async () => {
      process.env = {
        ...originalEnv,
        TARGET_URL: 'https://test.com',
        PORT: 'invalid',
      };

      const { default: config } = await import('../../src/config.js');
      expect(config.PORT).toBe(8080); // Default fallback
    });

    test('should convert CACHE_TTL to integer', async () => {
      process.env = {
        ...originalEnv,
        TARGET_URL: 'https://test.com',
        CACHE_TTL: '1800',
      };

      const { default: config } = await import('../../src/config.js');
      expect(typeof config.CACHE_TTL).toBe('number');
      expect(config.CACHE_TTL).toBe(1800);
    });

    test('should convert PUPPETEER_TIMEOUT to integer', async () => {
      process.env = {
        ...originalEnv,
        TARGET_URL: 'https://test.com',
        PUPPETEER_TIMEOUT: '45000',
      };

      const { default: config } = await import('../../src/config.js');
      expect(typeof config.PUPPETEER_TIMEOUT).toBe('number');
      expect(config.PUPPETEER_TIMEOUT).toBe(45000);
    });
  });

  describe('URL Validation', () => {
    test('should accept https URL', async () => {
      process.env = {
        ...originalEnv,
        TARGET_URL: 'https://example.com',
      };

      const { default: config } = await import('../../src/config.js');
      expect(config.TARGET_URL).toBe('https://example.com');
      expect(processExitSpy).not.toHaveBeenCalled();
    });

    test('should accept http URL', async () => {
      process.env = {
        ...originalEnv,
        TARGET_URL: 'http://localhost:3000',
      };

      const { default: config } = await import('../../src/config.js');
      expect(config.TARGET_URL).toBe('http://localhost:3000');
      expect(processExitSpy).not.toHaveBeenCalled();
    });

    test('should accept URL with path', async () => {
      process.env = {
        ...originalEnv,
        TARGET_URL: 'https://example.com/app',
      };

      const { default: config } = await import('../../src/config.js');
      expect(config.TARGET_URL).toBe('https://example.com/app');
      expect(processExitSpy).not.toHaveBeenCalled();
    });

    test('should accept URL with port', async () => {
      process.env = {
        ...originalEnv,
        TARGET_URL: 'https://example.com:8080',
      };

      const { default: config } = await import('../../src/config.js');
      expect(config.TARGET_URL).toBe('https://example.com:8080');
      expect(processExitSpy).not.toHaveBeenCalled();
    });
  });
});
