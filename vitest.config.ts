import { defineConfig } from 'vitest/config'
import path from 'path'

/**
 * Base Vitest configuration
 *
 * This is the default configuration used when running `pnpm test`.
 * For mode-specific configurations, see:
 * - vitest.unit.config.ts - Fast unit tests (mocked)
 * - vitest.fork.config.ts - Anvil fork tests (real state)
 * - vitest.live.config.ts - Live network tests (rate-limited)
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    // Include both test directories
    include: [
      'test/**/*.test.ts',
      'src/__tests__/**/*.test.ts',
    ],
    // Exclude setup files
    exclude: [
      'node_modules/',
      'dist/',
      'test/setup/**',
    ],
    // Reduce concurrency to avoid rate limiting on public RPCs
    maxConcurrency: 1,
    // Run test files sequentially to further reduce RPC load
    fileParallelism: false,
    // Increase test timeout for network tests with retries
    testTimeout: 60_000,
    // Add hook timeout for beforeAll/afterAll with network calls
    hookTimeout: 60_000,
    // Sequence tests within a file to run sequentially
    sequence: {
      shuffle: false,
    },
    // Use JSON reporter for CI to generate structured output
    reporters: process.env.CI ? ['json', 'verbose'] : ['verbose'],
    outputFile: process.env.CI ? { json: './test-results.json' } : undefined,
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData.ts',
        'test/setup/**',
        'test/utils/**',
      ],
    },
  },
})
