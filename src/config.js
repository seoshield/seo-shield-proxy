import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * Application configuration
 * All values are loaded from environment variables with sensible defaults
 */
const config = {
  // Server port - default to 8080
  PORT: parseInt(process.env.PORT, 10) || 8080,

  // Target URL for the SPA (required)
  // This is the URL of your actual SPA application
  TARGET_URL: process.env.TARGET_URL,

  // Cache TTL in seconds - default to 1 hour
  CACHE_TTL: parseInt(process.env.CACHE_TTL, 10) || 3600,

  // Puppeteer timeout in milliseconds - default to 30 seconds
  PUPPETEER_TIMEOUT: parseInt(process.env.PUPPETEER_TIMEOUT, 10) || 30000,

  // Node environment
  NODE_ENV: process.env.NODE_ENV || 'production',

  // ============================================
  // CACHE RULES CONFIGURATION
  // ============================================

  // URLs that should NEVER be cached or rendered (comma-separated patterns)
  // These will be proxied directly without any SSR
  // Examples: /checkout,/cart,/admin/*,/api/*
  // Supports wildcards (*) and regex (wrap in /.../)
  NO_CACHE_PATTERNS: process.env.NO_CACHE_PATTERNS || '',

  // URLs that SHOULD be cached (comma-separated patterns)
  // If specified, ONLY these patterns will be cached
  // Examples: /blog/*,/products/*,/category/*
  // Leave empty to use CACHE_BY_DEFAULT behavior
  CACHE_PATTERNS: process.env.CACHE_PATTERNS || '',

  // Default caching behavior when URL doesn't match any pattern
  // 'true' = cache everything by default (recommended for content sites)
  // 'false' = cache nothing by default, only explicit CACHE_PATTERNS
  CACHE_BY_DEFAULT: process.env.CACHE_BY_DEFAULT !== 'false',

  // Meta tag name that SPA can use to control caching
  // SPA can add: <meta name="x-seo-shield-cache" content="false">
  // to prevent caching of specific pages dynamically
  CACHE_META_TAG: process.env.CACHE_META_TAG || 'x-seo-shield-cache',
};

// Validate required configuration
if (!config.TARGET_URL) {
  console.error('❌ ERROR: TARGET_URL environment variable is required');
  process.exit(1);
}

// Validate TARGET_URL format
try {
  new URL(config.TARGET_URL);
} catch (error) {
  console.error('❌ ERROR: TARGET_URL must be a valid URL (e.g., https://example.com)');
  process.exit(1);
}

// Log configuration (hide sensitive data in production)
console.log('⚙️  Configuration loaded:');
console.log(`   PORT: ${config.PORT}`);
console.log(`   TARGET_URL: ${config.TARGET_URL}`);
console.log(`   CACHE_TTL: ${config.CACHE_TTL}s`);
console.log(`   PUPPETEER_TIMEOUT: ${config.PUPPETEER_TIMEOUT}ms`);
console.log(`   NODE_ENV: ${config.NODE_ENV}`);
console.log(`   CACHE_BY_DEFAULT: ${config.CACHE_BY_DEFAULT}`);
if (config.NO_CACHE_PATTERNS) {
  console.log(`   NO_CACHE_PATTERNS: ${config.NO_CACHE_PATTERNS}`);
}
if (config.CACHE_PATTERNS) {
  console.log(`   CACHE_PATTERNS: ${config.CACHE_PATTERNS}`);
}

export default config;
