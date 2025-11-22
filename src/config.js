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

export default config;
