/**
 * Browser Mock Helpers
 * Mocks for Puppeteer browser and page objects for SSR testing
 */

import { vi } from 'vitest';

/**
 * Create a mock Puppeteer HTTPResponse
 */
export const createMockResponse = (statusCode = 200) => ({
  status: vi.fn().mockReturnValue(statusCode),
  headers: vi.fn().mockReturnValue({}),
  ok: vi.fn().mockReturnValue(statusCode >= 200 && statusCode < 300),
  url: vi.fn().mockReturnValue('https://example.com'),
});

/**
 * Create a mock Puppeteer page with configurable behavior
 */
export const createMockPage = (options: {
  html?: string;
  statusCode?: number;
  shouldTimeout?: boolean;
  shouldCrash?: boolean;
  networkError?: string;
  title?: string;
} = {}) => {
  const {
    html = '<html><head><title>Test</title></head><body>Content</body></html>',
    statusCode = 200,
    shouldTimeout = false,
    shouldCrash = false,
    networkError,
    title = 'Test Page',
  } = options;

  const mockResponse = createMockResponse(statusCode);

  const page = {
    goto: vi.fn().mockImplementation(async () => {
      if (shouldTimeout) {
        throw new Error('Navigation timeout of 30000 ms exceeded');
      }
      if (shouldCrash) {
        throw new Error('Page crashed!');
      }
      if (networkError) {
        throw new Error(networkError);
      }
      return mockResponse;
    }),
    content: vi.fn().mockResolvedValue(html),
    title: vi.fn().mockResolvedValue(title),
    url: vi.fn().mockReturnValue('https://example.com'),
    evaluate: vi.fn().mockResolvedValue({}),
    $eval: vi.fn().mockResolvedValue(''),
    $$eval: vi.fn().mockResolvedValue([]),
    $: vi.fn().mockResolvedValue(null),
    $$: vi.fn().mockResolvedValue([]),
    setViewport: vi.fn().mockResolvedValue(undefined),
    setUserAgent: vi.fn().mockResolvedValue(undefined),
    setRequestInterception: vi.fn().mockResolvedValue(undefined),
    setExtraHTTPHeaders: vi.fn().mockResolvedValue(undefined),
    setCacheEnabled: vi.fn().mockResolvedValue(undefined),
    setJavaScriptEnabled: vi.fn().mockResolvedValue(undefined),
    waitForSelector: vi.fn().mockResolvedValue({}),
    waitForNavigation: vi.fn().mockResolvedValue(undefined),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    waitForFunction: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    off: vi.fn(),
    once: vi.fn(),
    removeListener: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
    isClosed: vi.fn().mockReturnValue(false),
    screenshot: vi.fn().mockResolvedValue(Buffer.from('mock-screenshot')),
    pdf: vi.fn().mockResolvedValue(Buffer.from('mock-pdf')),
    metrics: vi.fn().mockResolvedValue({
      Timestamp: Date.now(),
      Documents: 1,
      Frames: 1,
      JSEventListeners: 10,
      Nodes: 100,
      LayoutCount: 5,
      RecalcStyleCount: 5,
      LayoutDuration: 0.1,
      RecalcStyleDuration: 0.05,
      ScriptDuration: 0.5,
      TaskDuration: 1,
      JSHeapUsedSize: 10000000,
      JSHeapTotalSize: 20000000,
    }),
  };

  return page;
};

/**
 * Create a mock Puppeteer browser
 */
export const createMockBrowser = (options: {
  shouldCrash?: boolean;
  maxPages?: number;
} = {}) => {
  const { shouldCrash = false, maxPages = 10 } = options;
  let pageCount = 0;

  const browser = {
    newPage: vi.fn().mockImplementation(async () => {
      if (shouldCrash) {
        throw new Error('Browser crashed!');
      }
      if (pageCount >= maxPages) {
        throw new Error('Browser pool exhausted');
      }
      pageCount++;
      return createMockPage();
    }),
    close: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    pages: vi.fn().mockResolvedValue([]),
    isConnected: vi.fn().mockReturnValue(!shouldCrash),
    version: vi.fn().mockResolvedValue('HeadlessChrome/120.0.0.0'),
    process: vi.fn().mockReturnValue({ pid: 12345 }),
    target: vi.fn().mockReturnValue({ url: vi.fn().mockReturnValue('about:blank') }),
    on: vi.fn(),
    off: vi.fn(),
    once: vi.fn(),
    removeListener: vi.fn(),
  };

  return browser;
};

/**
 * Create a mock Puppeteer cluster
 */
export const createMockCluster = (options: {
  shouldFail?: boolean;
  queueSize?: number;
  maxConcurrency?: number;
} = {}) => {
  const { shouldFail = false, queueSize = 0, maxConcurrency = 10 } = options;
  let currentQueueSize = queueSize;

  const cluster = {
    execute: vi.fn().mockImplementation(async (url: string, taskFn: Function) => {
      if (shouldFail) {
        throw new Error('Cluster execution failed');
      }
      if (currentQueueSize >= maxConcurrency) {
        throw new Error('Cluster queue full');
      }
      currentQueueSize++;
      const page = createMockPage();
      const result = await taskFn({ page, data: url });
      currentQueueSize--;
      return result;
    }),
    queue: vi.fn().mockImplementation(async () => {
      currentQueueSize++;
    }),
    idle: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
  };

  return cluster;
};

/**
 * Create mock HTML with soft 404 indicators
 */
export const createSoft404Html = (type: 'title' | 'h1' | 'body' | 'meta' = 'title') => {
  const templates = {
    title: '<html><head><title>Page Not Found</title></head><body><p>Content</p></body></html>',
    h1: '<html><head><title>My Site</title></head><body><h1>404 - Page Not Found</h1></body></html>',
    body: '<html><head><title>My Site</title></head><body><div class="error-404">The page you requested could not be found.</div></body></html>',
    meta: '<html><head><title>My Site</title><meta name="prerender-status-code" content="404"></head><body><p>Content</p></body></html>',
  };
  return templates[type];
};

/**
 * Create mock HTML for valid pages
 */
export const createValidPageHtml = (options: {
  title?: string;
  description?: string;
  h1?: string;
  content?: string;
} = {}) => {
  const {
    title = 'Product Page | My Store',
    description = 'Buy this amazing product',
    h1 = 'Amazing Product',
    content = 'This is a great product that you should buy.',
  } = options;

  return `<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <meta name="description" content="${description}">
  <link rel="canonical" href="https://example.com/product">
</head>
<body>
  <h1>${h1}</h1>
  <p>${content}</p>
</body>
</html>`;
};

/**
 * Create a mock render result
 */
export const createMockRenderResult = (options: {
  html?: string;
  statusCode?: number;
  fallback?: boolean;
  reason?: string;
  renderTime?: number;
  cached?: boolean;
  soft404?: boolean;
} = {}) => {
  const {
    html = '<html><body>Rendered content</body></html>',
    statusCode = 200,
    fallback = false,
    reason,
    renderTime = 1500,
    cached = false,
    soft404 = false,
  } = options;

  return {
    html,
    statusCode,
    fallback,
    reason,
    renderTime,
    cached,
    soft404Detected: soft404,
    headers: {
      'content-type': 'text/html',
      'x-ssr-rendered': fallback ? undefined : 'true',
    },
  };
};

/**
 * Network error types for testing
 */
export const networkErrors = {
  connectionRefused: 'net::ERR_CONNECTION_REFUSED',
  connectionReset: 'net::ERR_CONNECTION_RESET',
  connectionTimedOut: 'net::ERR_CONNECTION_TIMED_OUT',
  nameNotResolved: 'net::ERR_NAME_NOT_RESOLVED',
  internetDisconnected: 'net::ERR_INTERNET_DISCONNECTED',
  sslProtocolError: 'net::ERR_SSL_PROTOCOL_ERROR',
  certAuthorityInvalid: 'net::ERR_CERT_AUTHORITY_INVALID',
  addressUnreachable: 'net::ERR_ADDRESS_UNREACHABLE',
};

/**
 * Create SSR event data
 */
export const createSSREvent = (type: 'render_start' | 'render_complete' | 'render_error' | 'cache_hit', data: Record<string, unknown> = {}) => ({
  event: type,
  timestamp: Date.now(),
  url: data.url || 'https://example.com',
  userAgent: data.userAgent || 'Googlebot/2.1',
  ...data,
});
