/**
 * Jest Setup File
 * Runs before all tests
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.TARGET_URL = 'https://test-spa.com';
process.env.PORT = '9999';
process.env.CACHE_TTL = '60';
process.env.PUPPETEER_TIMEOUT = '5000';
process.env.NO_CACHE_PATTERNS = '/admin/*,/api/*';
process.env.CACHE_PATTERNS = '';
process.env.CACHE_BY_DEFAULT = 'true';
process.env.CACHE_META_TAG = 'x-seo-shield-cache';

// Suppress console.log during tests (unless debugging)
if (!process.env.DEBUG) {
  const noop = () => {};
  global.console = {
    ...console,
    log: noop,
    debug: noop,
    info: noop,
    warn: noop,
    error: console.error, // Keep error for debugging
  };
}
