/**
 * Jest Configuration for ES Modules
 * Using Node.js experimental VM modules
 */
export default {
  // Use node's experimental VM modules for ES module support
  testEnvironment: 'node',

  // Transform files (none needed for native ES modules)
  transform: {},

  // File extensions to process
  moduleFileExtensions: ['js', 'json'],

  // Test match patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/__tests__/**/*.test.js',
  ],

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.js',
    '!**/node_modules/**',
    '!**/tests/**',
  ],

  // Coverage thresholds - Core modules at 100%, global realistic
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
    './src/config.js': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
    './src/cache.js': {
      branches: 75,
      functions: 100,
      lines: 100,
      statements: 100,
    },
    './src/cache-rules.js': {
      branches: 90,
      functions: 100,
      lines: 100,
      statements: 100,
    },
    './src/browser.js': {
      branches: 90,
      functions: 75,
      lines: 85,
      statements: 85,
    },
  },

  // Coverage reporters
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Timeout for tests
  testTimeout: 30000,

  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // Verbose output
  verbose: true,

  // Detect open handles
  detectOpenHandles: true,
  forceExit: true,
};
