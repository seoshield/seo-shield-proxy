/**
 * Admin Module Test Fixtures
 * Sample data for testing admin modules
 */

/**
 * Sample hotfix configuration
 */
export const sampleHotfix = {
  id: 'hotfix-1',
  name: 'Fix Product Title',
  description: 'Updates product page titles for SEO',
  urlPattern: '/product/*',
  selector: 'title',
  type: 'replace' as const,
  content: 'New Product Title | Site Name',
  enabled: true,
  priority: 10,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

/**
 * Sample hotfix list
 */
export const sampleHotfixList = [
  sampleHotfix,
  {
    id: 'hotfix-2',
    name: 'Add Meta Description',
    description: 'Adds missing meta descriptions',
    urlPattern: '/category/*',
    selector: 'meta[name="description"]',
    type: 'inject' as const,
    content: '<meta name="description" content="Category description">',
    enabled: true,
    priority: 5,
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-02'),
  },
  {
    id: 'hotfix-3',
    name: 'Remove Tracking Script',
    description: 'Removes tracking script for bots',
    urlPattern: '/*',
    selector: 'script[src*="tracking"]',
    type: 'remove' as const,
    content: '',
    enabled: false,
    priority: 1,
    createdAt: new Date('2024-01-03'),
    updatedAt: new Date('2024-01-03'),
  },
];

/**
 * Sample blocking rule
 */
export const sampleBlockingRule = {
  id: 'rule-1',
  name: 'Block Bad Bot',
  description: 'Blocks known bad bot',
  type: 'pattern' as const,
  pattern: 'BadBot/*',
  action: 'block' as const,
  enabled: true,
  priority: 10,
  stats: {
    blockedCount: 150,
    lastBlocked: new Date('2024-01-15'),
    totalRequests: 200,
  },
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

/**
 * Sample blocking rule list
 */
export const sampleBlockingRuleList = [
  sampleBlockingRule,
  {
    id: 'rule-2',
    name: 'Block IP Range',
    description: 'Blocks suspicious IP range',
    type: 'domain' as const,
    pattern: '192.168.1.*',
    action: 'block' as const,
    enabled: true,
    priority: 5,
    stats: {
      blockedCount: 50,
      lastBlocked: new Date('2024-01-14'),
      totalRequests: 100,
    },
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-02'),
  },
  {
    id: 'rule-3',
    name: 'Redirect Old URL',
    description: 'Redirects old URLs to new ones',
    type: 'url' as const,
    pattern: '/old-page',
    action: 'redirect' as const,
    options: {
      redirectUrl: '/new-page',
    },
    enabled: true,
    priority: 3,
    stats: {
      blockedCount: 0,
      totalRequests: 25,
    },
    createdAt: new Date('2024-01-03'),
    updatedAt: new Date('2024-01-03'),
  },
];

/**
 * Sample metrics data
 */
export const sampleMetrics = {
  totalRequests: 10000,
  botRequests: 3000,
  humanRequests: 7000,
  cacheHits: 6000,
  cacheMisses: 4000,
  ssrRendered: 2500,
  proxiedDirect: 7000,
  staticAssets: 500,
  bypassedByRules: 100,
  errors: 50,
};

/**
 * Sample bot stats
 */
export const sampleBotStats = {
  Googlebot: 1500,
  Bingbot: 800,
  'Yandex Bot': 300,
  'Facebook Bot': 200,
  'Twitter Bot': 150,
  Other: 50,
};

/**
 * Sample URL stats
 */
export const sampleUrlStats = [
  { path: '/', count: 5000, cacheHits: 4500, cacheMisses: 500, lastAccess: Date.now() },
  { path: '/products', count: 2000, cacheHits: 1800, cacheMisses: 200, lastAccess: Date.now() },
  { path: '/about', count: 1000, cacheHits: 950, cacheMisses: 50, lastAccess: Date.now() },
  { path: '/contact', count: 500, cacheHits: 480, cacheMisses: 20, lastAccess: Date.now() },
];

/**
 * Sample forensics report
 */
export const sampleForensicsReport = {
  id: 'forensics-1',
  url: 'https://example.com/problem-page',
  timestamp: new Date('2024-01-15T10:30:00Z'),
  error: {
    message: 'Navigation timeout of 30000 ms exceeded',
    type: 'timeout' as const,
    stack: 'TimeoutError: Navigation timeout...',
  },
  context: {
    userAgent: 'Googlebot/2.1 (+http://www.google.com/bot.html)',
    viewport: { width: 1920, height: 1080 },
    headers: {
      'accept-language': 'en-US',
      'cache-control': 'no-cache',
    },
    timeout: 30000,
  },
  console: [
    { level: 'error', text: 'Failed to load resource', timestamp: 1705315800000 },
    { level: 'warning', text: 'Deprecation warning', timestamp: 1705315801000 },
  ],
  network: [
    { url: 'https://example.com/problem-page', method: 'GET', status: 200, time: 150 },
    { url: 'https://example.com/api/data', method: 'GET', status: 500, time: 5000 },
  ],
  renderTime: 30000,
  createdAt: new Date('2024-01-15'),
};

/**
 * Sample forensics report list
 */
export const sampleForensicsReportList = [
  sampleForensicsReport,
  {
    id: 'forensics-2',
    url: 'https://example.com/crash-page',
    timestamp: new Date('2024-01-14T14:20:00Z'),
    error: {
      message: 'Page crashed!',
      type: 'crash' as const,
    },
    context: {
      userAgent: 'Bingbot/2.0',
      viewport: { width: 1920, height: 1080 },
      headers: {},
      timeout: 30000,
    },
    console: [],
    network: [],
    renderTime: 5000,
    createdAt: new Date('2024-01-14'),
  },
];

/**
 * Sample cache warmer config
 */
export const sampleCacheWarmerConfig = {
  enabled: true,
  sitemapUrls: ['https://example.com/sitemap.xml'],
  maxConcurrent: 5,
  intervalMinutes: 60,
  priorities: {
    '/': 10,
    '/products': 8,
    '/category': 6,
  },
  excludePatterns: ['/admin/*', '/api/*', '*.pdf'],
};

/**
 * Sample cache warmer status
 */
export const sampleCacheWarmerStatus = {
  isRunning: true,
  lastRun: new Date('2024-01-15T09:00:00Z'),
  nextRun: new Date('2024-01-15T10:00:00Z'),
  urlsProcessed: 150,
  urlsTotal: 500,
  errors: [{ url: 'https://example.com/error-page', error: 'Timeout' }],
  progress: 30,
};

/**
 * Sample request data for metrics
 */
export const sampleRequestData = {
  path: '/products/test-product',
  userAgent: 'Googlebot/2.1 (+http://www.google.com/bot.html)',
  isBot: true,
  action: 'ssr' as const,
  cacheStatus: 'MISS' as const,
  rule: undefined,
  cached: false,
};

/**
 * Sample human request data
 */
export const sampleHumanRequestData = {
  path: '/products/test-product',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
  isBot: false,
  action: 'proxy' as const,
  cacheStatus: null,
  rule: undefined,
  cached: false,
};

/**
 * Sample sitemap URLs
 */
export const sampleSitemapUrls = [
  'https://example.com/',
  'https://example.com/products',
  'https://example.com/products/item-1',
  'https://example.com/products/item-2',
  'https://example.com/category/electronics',
  'https://example.com/category/clothing',
  'https://example.com/about',
  'https://example.com/contact',
];

/**
 * Sample SEO health check result
 */
export const sampleSeoHealthResult = {
  url: 'https://example.com/test',
  passed: true,
  checks: {
    title: { passed: true, value: 'Test Page', message: 'Title is present' },
    description: { passed: true, value: 'Test description', message: 'Meta description is present' },
    h1: { passed: true, value: 'Test Heading', message: 'H1 is present' },
    canonical: { passed: true, value: 'https://example.com/test', message: 'Canonical URL is present' },
  },
  score: 100,
  timestamp: new Date(),
};

/**
 * Sample traffic log entry
 */
export const sampleTrafficLogEntry = {
  id: 'log-1',
  timestamp: new Date('2024-01-15T10:00:00Z'),
  path: '/products/test',
  method: 'GET',
  userAgent: 'Googlebot/2.1',
  ip: '66.249.66.1',
  isBot: true,
  botName: 'Googlebot',
  action: 'ssr',
  statusCode: 200,
  responseTime: 1500,
  cacheStatus: 'MISS',
};

/**
 * Sample system health
 */
export const sampleSystemHealth = {
  overall: 'healthy' as const,
  components: {
    proxy: { status: 'healthy' as const, message: 'Running', lastCheck: new Date() },
    cache: { status: 'healthy' as const, message: 'Connected', lastCheck: new Date() },
    database: { status: 'healthy' as const, message: 'Connected', lastCheck: new Date() },
    browser: { status: 'healthy' as const, message: '3 instances ready', lastCheck: new Date() },
    websocket: { status: 'healthy' as const, message: '5 clients connected', lastCheck: new Date() },
  },
  uptime: 86400,
  version: '1.0.0',
};
