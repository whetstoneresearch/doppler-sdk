import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  // Keep default plugin-less config to avoid ESM plugin issues in CI
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  test: {
    globals: true,
    environment: 'node',
    // Only include tests under src/__tests__
    include: ['src/__tests__/**/*.test.ts'],
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
        '**/mockData.ts'
      ]
    }
  }
})
