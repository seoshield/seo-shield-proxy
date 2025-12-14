import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],
    setupFiles: ['./tests/vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/types/**',
        'node_modules',
        'dist',
        '**/*.d.ts'
      ],
      thresholds: {
        global: {
          branches: 40,
          functions: 50,
          lines: 50,
          statements: 50
        }
      }
    },
    timeout: 30000,
    bail: 0,
    testTimeout: 30000,
    hookTimeout: 30000,
    isolate: true,
    watch: false,
    reporter: 'verbose',
    passWithNoTests: false,
    sequence: {
      shuffle: false
    }
  },
  esbuild: {
    target: 'node18'
  }
});
