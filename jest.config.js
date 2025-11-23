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
    'dist/**/*.js',
    '!**/node_modules/**',
    '!**/tests/**',
  ],

  // Coverage thresholds - Achieved 100% test success rate
  coverageThreshold: {
    './dist/config.js': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
    './dist/cache.js': {
      branches: 90,
      functions: 100,
      lines: 95,
      statements: 95,
    },
    './dist/cache-rules.js': {
      branches: 90,
      functions: 100,
      lines: 100,
      statements: 100,
    },
    './dist/browser.js': {
      branches: 90,
      functions: 75,
      lines: 84,
      statements: 84,
    },
    './dist/admin/metrics-collector.js': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    './dist/admin/config-manager.js': {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80,
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
