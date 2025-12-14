/**
 * Integration Test Setup
 * Shared setup and teardown for integration tests
 */

import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';

// Test environment configuration
export interface TestEnvironment {
  mongoUrl?: string;
  redisUrl?: string;
  targetUrl?: string;
  adminPassword: string;
}

// Default test environment
const defaultTestEnv: TestEnvironment = {
  adminPassword: 'test-password-123',
  targetUrl: 'http://localhost:9999',
};

/**
 * Setup test environment variables
 */
export function setupTestEnv(overrides: Partial<TestEnvironment> = {}): TestEnvironment {
  const env = { ...defaultTestEnv, ...overrides };

  process.env.NODE_ENV = 'test';
  process.env.ADMIN_PASSWORD = env.adminPassword;
  process.env.CACHE_TYPE = 'memory';
  process.env.TARGET_URL = env.targetUrl || 'http://localhost:9999';

  if (env.mongoUrl) {
    process.env.MONGODB_URL = env.mongoUrl;
  }

  if (env.redisUrl) {
    process.env.REDIS_URL = env.redisUrl;
  }

  return env;
}

/**
 * Clean up test environment
 */
export function cleanupTestEnv(): void {
  delete process.env.MONGODB_URL;
  delete process.env.REDIS_URL;
}

/**
 * Create a test server helper
 */
export function createTestServerHelper() {
  let servers: Array<{ close: () => void }> = [];

  return {
    register(server: { close: () => void }) {
      servers.push(server);
    },
    closeAll() {
      servers.forEach((server) => {
        try {
          server.close();
        } catch {
          // Ignore close errors
        }
      });
      servers = [];
    },
  };
}

/**
 * Wait for server to be ready
 */
export async function waitForServer(
  checkFn: () => Promise<boolean>,
  timeout = 5000,
  interval = 100
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      if (await checkFn()) {
        return;
      }
    } catch {
      // Continue waiting
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`Server did not become ready within ${timeout}ms`);
}

/**
 * Generate test request headers
 */
export const testHeaders = {
  googlebot: {
    'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  },
  bingbot: {
    'User-Agent': 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  },
  chrome: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  },
  firefox: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  },
  curl: {
    'User-Agent': 'curl/7.88.1',
  },
};

/**
 * Create mock target server responses
 */
export const mockResponses = {
  html: {
    simple: '<html><head><title>Test Page</title></head><body><h1>Hello</h1></body></html>',
    withMeta:
      '<html><head><title>Test</title><meta name="description" content="Test description"></head><body><h1>Hello</h1></body></html>',
    spa: '<html><head><title>SPA</title></head><body><div id="app"></div><script src="/app.js"></script></body></html>',
    error404: '<html><head><title>Not Found</title></head><body><h1>404 - Page Not Found</h1></body></html>',
    error500: '<html><head><title>Error</title></head><body><h1>Internal Server Error</h1></body></html>',
  },
  json: {
    success: { success: true, data: 'test' },
    error: { success: false, error: 'Test error' },
    metrics: { totalRequests: 100, botRequests: 30, cacheHits: 70 },
  },
};

/**
 * Mock fetch for external requests
 */
export function mockFetch(responses: Record<string, unknown>): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url: string) => {
      const response = responses[url];
      if (response) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(response),
          text: () => Promise.resolve(JSON.stringify(response)),
        });
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Not found' }),
        text: () => Promise.resolve('Not found'),
      });
    })
  );
}

/**
 * Restore fetch
 */
export function restoreFetch(): void {
  vi.unstubAllGlobals();
}

/**
 * Integration test suite setup helper
 */
export function setupIntegrationSuite(config: {
  env?: Partial<TestEnvironment>;
  beforeAllFn?: () => Promise<void>;
  afterAllFn?: () => Promise<void>;
}) {
  const serverHelper = createTestServerHelper();
  let env: TestEnvironment;

  beforeAll(async () => {
    env = setupTestEnv(config.env);
    if (config.beforeAllFn) {
      await config.beforeAllFn();
    }
  });

  afterAll(async () => {
    serverHelper.closeAll();
    cleanupTestEnv();
    if (config.afterAllFn) {
      await config.afterAllFn();
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up any test-specific resources
  });

  return { serverHelper, getEnv: () => env };
}

/**
 * Create a delay promise
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function until it succeeds or max attempts reached
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  delayMs = 100
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts) {
        await delay(delayMs);
      }
    }
  }

  throw lastError;
}
