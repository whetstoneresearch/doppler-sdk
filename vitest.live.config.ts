import { defineConfig, mergeConfig } from 'vitest/config'
import baseConfig from './vitest.config'

/**
 * Live test configuration
 *
 * Runs tests against live networks with rate limiting.
 * Use sparingly - primarily for smoke tests and E2E validation.
 *
 * Usage: LIVE_TEST_ENABLED=true pnpm test:live
 */
export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: [
        'test/evm/e2e/**/*.test.ts',
        'test/evm/airlock-whitelisting.test.ts',
      ],
      exclude: [
        'node_modules/',
        'dist/',
        'test/evm/setup/**',
        'test/evm/unit/**',
        'test/evm/fork/**',
        'test/evm/integration/**',
      ],
      // Live tests must run sequentially with rate limiting
      maxConcurrency: 1,
      fileParallelism: false,
      // Long timeout for rate-limited requests
      testTimeout: 180_000,
      hookTimeout: 180_000,
      // Run sequentially
      sequence: {
        shuffle: false,
      },
      // Setup file for custom matchers
      setupFiles: ['./test/evm/setup/vitest.setup.ts'],
      // Env vars for live mode
      env: {
        LIVE_TEST_ENABLED: 'true',
      },
      // Retry on flaky network issues
      retry: 2,
    },
  })
)
