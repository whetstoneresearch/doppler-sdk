import { defineConfig } from 'vitest/config'
import path from 'path'

/**
 * Solana unit test configuration
 *
 * Runs Solana SDK unit tests (no fork or live modes needed).
 * Single-threaded — SVM tests may be stateful.
 *
 * Usage: pnpm test:solana
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
    include: [
      'test/solana/**/*.test.ts',
      'test/solana/**/*.test.tsx',
    ],
    exclude: [
      'node_modules/',
      'dist/',
    ],
    // Single-threaded: SVM tests may be stateful
    maxConcurrency: 1,
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
