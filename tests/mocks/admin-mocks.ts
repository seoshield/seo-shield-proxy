/**
 * Admin Module Mock Helpers
 * Reusable mocks for admin module testing
 */

import { vi } from 'vitest';

/**
 * Create a mock MongoDB collection
 */
export const createMockCollection = () => ({
  find: vi.fn().mockReturnValue({
    toArray: vi.fn().mockResolvedValue([]),
    sort: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
  }),
  findOne: vi.fn().mockResolvedValue(null),
  insertOne: vi.fn().mockResolvedValue({ insertedId: 'mock-id' }),
  insertMany: vi.fn().mockResolvedValue({ insertedIds: ['mock-id-1', 'mock-id-2'] }),
  updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
  updateMany: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
  deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }),
  deleteMany: vi.fn().mockResolvedValue({ deletedCount: 1 }),
  countDocuments: vi.fn().mockResolvedValue(0),
  aggregate: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }),
});

/**
 * Create a mock MongoDB database
 */
export const createMockDatabase = () => ({
  collection: vi.fn().mockReturnValue(createMockCollection()),
  listCollections: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }),
});

/**
 * Create a mock cache adapter
 */
export const createMockCache = () => ({
  get: vi.fn().mockReturnValue(undefined),
  getWithTTL: vi.fn().mockReturnValue(undefined),
  set: vi.fn().mockReturnValue(true),
  delete: vi.fn().mockReturnValue(true),
  flush: vi.fn(),
  getStats: vi.fn().mockReturnValue({ keys: 0, hits: 0, misses: 0, ksize: 0, vsize: 0 }),
  keys: vi.fn().mockReturnValue([]),
  getAllEntries: vi.fn().mockReturnValue([]),
  isReady: vi.fn().mockReturnValue(true),
  close: vi.fn().mockResolvedValue(undefined),
});

/**
 * Create a mock Express request
 */
export const createMockRequest = (overrides: Record<string, unknown> = {}) => ({
  method: 'GET',
  url: '/test',
  path: '/test',
  headers: {
    'user-agent': 'Mozilla/5.0 (Test)',
    host: 'localhost:8080',
  },
  query: {},
  params: {},
  body: {},
  ip: '127.0.0.1',
  isBot: false,
  botName: null,
  ...overrides,
});

/**
 * Create a mock Express response
 */
export const createMockResponse = () => {
  const res: Record<string, unknown> = {
    statusCode: 200,
    headers: {} as Record<string, string>,
  };

  res.status = vi.fn().mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });

  res.json = vi.fn().mockImplementation((data: unknown) => {
    res.body = data;
    return res;
  });

  res.send = vi.fn().mockImplementation((data: unknown) => {
    res.body = data;
    return res;
  });

  res.set = vi.fn().mockImplementation((key: string, value: string) => {
    (res.headers as Record<string, string>)[key] = value;
    return res;
  });

  res.setHeader = vi.fn().mockImplementation((key: string, value: string) => {
    (res.headers as Record<string, string>)[key] = value;
    return res;
  });

  res.end = vi.fn().mockReturnValue(res);
  res.write = vi.fn().mockReturnValue(true);

  return res;
};

/**
 * Create a mock Next function
 */
export const createMockNext = () => vi.fn();

/**
 * Create a mock Puppeteer page
 */
export const createMockPage = () => ({
  goto: vi.fn().mockResolvedValue({ status: vi.fn().mockReturnValue(200) }),
  content: vi.fn().mockResolvedValue('<html><body>Test</body></html>'),
  evaluate: vi.fn().mockResolvedValue({}),
  setViewport: vi.fn().mockResolvedValue(undefined),
  setUserAgent: vi.fn().mockResolvedValue(undefined),
  setRequestInterception: vi.fn().mockResolvedValue(undefined),
  on: vi.fn(),
  off: vi.fn(),
  close: vi.fn().mockResolvedValue(undefined),
  screenshot: vi.fn().mockResolvedValue(Buffer.from('mock-screenshot')),
  waitForSelector: vi.fn().mockResolvedValue({}),
  waitForNavigation: vi.fn().mockResolvedValue(undefined),
  $: vi.fn().mockResolvedValue(null),
  $$: vi.fn().mockResolvedValue([]),
  $eval: vi.fn().mockResolvedValue(''),
  $$eval: vi.fn().mockResolvedValue([]),
  title: vi.fn().mockResolvedValue('Test Page'),
  url: vi.fn().mockReturnValue('https://example.com'),
});

/**
 * Create a mock Puppeteer browser
 */
export const createMockBrowser = () => ({
  newPage: vi.fn().mockResolvedValue(createMockPage()),
  close: vi.fn().mockResolvedValue(undefined),
  pages: vi.fn().mockResolvedValue([]),
  isConnected: vi.fn().mockReturnValue(true),
  version: vi.fn().mockResolvedValue('HeadlessChrome/100.0.0.0'),
});

/**
 * Create a mock WebSocket server
 */
export const createMockWebSocketServer = () => ({
  emit: vi.fn(),
  on: vi.fn(),
  to: vi.fn().mockReturnThis(),
  clients: new Set(),
});

/**
 * Create a mock Logger
 */
export const createMockLogger = () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
});

/**
 * Create a mock fetch response
 */
export const createMockFetchResponse = (data: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: status === 200 ? 'OK' : 'Error',
  json: vi.fn().mockResolvedValue(data),
  text: vi.fn().mockResolvedValue(JSON.stringify(data)),
  headers: new Map(),
});

/**
 * Create a mock sitemap XML
 */
export const createMockSitemapXml = (urls: string[]) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>${url}</loc></url>`).join('\n')}
</urlset>`;

/**
 * Create a mock HTML response
 */
export const createMockHtml = (options: { title?: string; description?: string; h1?: string } = {}) => {
  const { title = 'Test Page', description = 'Test description', h1 = 'Test Heading' } = options;
  return `<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <meta name="description" content="${description}">
</head>
<body>
  <h1>${h1}</h1>
  <p>Test content</p>
</body>
</html>`;
};
