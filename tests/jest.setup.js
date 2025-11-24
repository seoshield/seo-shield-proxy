/**
 * Jest Setup File
 * Configure mocks and handle ES module compatibility
 */

// Mock ES module imports that cause issues
jest.mock('../src/admin/config-manager', () => {
  return {
    default: {
      config: {
        server: {
          port: 8080,
          targetUrl: 'http://localhost:3000'
        },
        cache: {
          ttl: 60000,
          maxSize: 1000
        },
        browser: {
          timeout: 10000
        }
      },
      get: jest.fn((key) => {
        const defaults = {
          'server.port': 8080,
          'server.targetUrl': 'http://localhost:3000',
          'cache.ttl': 60000,
          'cache.maxSize': 1000,
          'browser.timeout': 10000
        };
        return defaults[key] || null;
      }),
      set: jest.fn(),
      watch: jest.fn(),
      load: jest.fn(),
      save: jest.fn()
    }
  };
});

// Mock Puppeteer to avoid cosmiconfig issues
jest.mock('puppeteer', () => ({
  default: {
    create: jest.fn(() => Promise.resolve({
      newPage: jest.fn(() => Promise.resolve({
        goto: jest.fn(() => Promise.resolve({ status: 200 })),
        close: jest.fn(),
        setContent: jest.fn(),
        content: jest.fn(() => Promise.resolve('<html><body>Mock content</body></html>')),
        waitForSelector: jest.fn(),
        evaluate: jest.fn(),
        emulateMedia: jest.fn(),
        setViewport: jest.fn(),
        screenshot: jest.fn()
      })),
      close: jest.fn(() => Promise.resolve()),
      pages: jest.fn(() => Promise.resolve([])),
      version: jest.fn(() => Promise.resolve('Mock version'))
    })),
    executablePath: jest.fn(() => 'mock/path')
  }
}));

// Mock bullmq
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn(),
    getJobs: jest.fn(),
    pause: jest.fn(),
    close: jest.fn()
  })),
  Worker: jest.fn(),
  Job: jest.fn(),
  QueueEvents: jest.fn()
}));

// Mock ioredis
jest.mock('ioredis', () => ({
  default: jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
    flushall: jest.fn(),
    quit: jest.fn()
  }))
}));

// Mock other admin modules
jest.mock('../src/admin/metrics-collector', () => {
  return {
    default: {
      log: jest.fn(),
      getMetrics: jest.fn(() => ({
        requests: 0,
        hits: 0,
        misses: 0,
        hitRate: 0,
        averageResponseTime: 0,
        botDetections: 0,
        errors: 0
      })),
      getURLStats: jest.fn(() => []),
      cleanup: jest.fn()
    }
  };
});

// Mock browser module
jest.mock('../src/browser', () => {
  return {
    default: {
      renderPage: jest.fn(async (url, options) => {
        return {
          html: `<html><body><h1>Mocked render for ${url}</h1></body></html>`,
          screenshot: null,
          status: 200,
          headers: {},
          renderTime: 100
        };
      }),
      close: jest.fn(),
      getBrowserInstance: jest.fn(),
      healthCheck: jest.fn(() => true)
    }
  };
});

// Mock cache modules
jest.mock('../src/cache', () => {
  return {
    default: {
      get: jest.fn(),
      set: jest.fn(),
      has: jest.fn(() => false),
      delete: jest.fn(),
      clear: jest.fn(),
      getStats: jest.fn(() => ({
        keys: 0,
        hits: 0,
        misses: 0,
        hitRate: 0
      }))
    }
  };
});

// Mock fs and path modules that might cause issues
jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    readFileSync: jest.fn(),
    writeFileSync: jest.fn(),
    existsSync: jest.fn(() => true),
    mkdirSync: jest.fn(),
  };
});

// Mock global console methods to reduce noise in tests
const originalConsole = global.console;

beforeAll(() => {
  global.console = {
    ...originalConsole,
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
});

afterAll(() => {
  global.console = originalConsole;
});

// Mock dist folder modules to prevent import.meta issues
jest.mock('../dist/admin/config-manager', () => {
  return {
    default: {
      config: {
        server: { port: 8080, targetUrl: 'http://localhost:3000' },
        cache: { ttl: 60000, maxSize: 1000 },
        browser: { timeout: 10000 }
      },
      get: jest.fn(),
      set: jest.fn(),
      watch: jest.fn(),
      load: jest.fn(),
      save: jest.fn()
    }
  };
});

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.TARGET_URL = 'http://localhost:3000';
process.env.CACHE_TTL = '2000';
process.env.MAX_CONCURRENT_RENDERS = '2';

// Increase timeout for async operations
jest.setTimeout(30000);