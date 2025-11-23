import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * Application configuration interface
 */
export interface Config {
  PORT: number;
  TARGET_URL: string;
  CACHE_TTL: number;
  PUPPETEER_TIMEOUT: number;
  NODE_ENV: string;
  NO_CACHE_PATTERNS: string;
  CACHE_PATTERNS: string;
  CACHE_BY_DEFAULT: boolean;
  CACHE_META_TAG: string;
  ADMIN_PASSWORD: string;
}

/**
 * Application configuration
 * All values are loaded from environment variables with sensible defaults
 */
const config: Config = {
  // Server port - default to 8080
  PORT: parseInt(process.env['PORT'] || '8080', 10) || 8080,

  // Target URL for the SPA (required)
  TARGET_URL: process.env['TARGET_URL'] || '',

  // Cache TTL in seconds - default to 1 hour
  CACHE_TTL: parseInt(process.env['CACHE_TTL'] || '3600', 10) || 3600,

  // Puppeteer timeout in milliseconds - default to 30 seconds
  PUPPETEER_TIMEOUT: parseInt(process.env['PUPPETEER_TIMEOUT'] || '30000', 10) || 30000,

  // Node environment
  NODE_ENV: process.env['NODE_ENV'] || 'production',

  // URLs that should NEVER be cached or rendered
  NO_CACHE_PATTERNS: process.env['NO_CACHE_PATTERNS'] || '',

  // URLs that SHOULD be cached
  CACHE_PATTERNS: process.env['CACHE_PATTERNS'] || '',

  // Default caching behavior
  CACHE_BY_DEFAULT: process.env['CACHE_BY_DEFAULT'] !== 'false',

  // Meta tag name for cache control
  CACHE_META_TAG: process.env['CACHE_META_TAG'] || 'x-seo-shield-cache',

  // Admin panel password
  ADMIN_PASSWORD: process.env['ADMIN_PASSWORD'] || 'admin123',
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

// Log configuration
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
