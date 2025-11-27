// Set test environment
process.env.NODE_ENV = 'test';
process.env.PORT = '8080';
process.env.API_PORT = '3190';
process.env.TARGET_URL = 'http://localhost:3000';
process.env.CACHE_TYPE = 'memory';
process.env.CACHE_TTL = '60';
process.env.MAX_CONCURRENT_RENDERS = '2';
process.env.ADMIN_PASSWORD = 'test-password';
process.env.MONGODB_URL = 'mongodb://localhost:27017/test';
process.env.REDIS_URL = 'redis://localhost:6379';
