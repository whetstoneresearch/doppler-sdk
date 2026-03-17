import { defineConfig, mergeConfig } from 'vitest/config'
import baseConfig from './vitest.config'

/**
 * Unit test configuration
 *
 * Runs fast unit tests with mocked dependencies.
 * No network access required.
 *
 * Usage: pnpm test:unit
 */
export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: [
        'test/evm/unit/**/*.test.ts',
      ],
      exclude: [
        'node_modules/',
        'dist/',
        'test/evm/setup/**',
        'test/evm/fork/**',
        'test/evm/integration/**',
        'test/evm/e2e/**',
      ],
      // Unit tests can run in parallel
      maxConcurrency: 5,
      fileParallelism: true,
      // Faster timeout for unit tests
      testTimeout: 10_000,
      hookTimeout: 10_000,
      // Setup file for custom matchers
      setupFiles: ['./test/evm/setup/vitest.setup.ts'],
      // Coverage for unit tests (enable with --coverage flag)
      coverage: {
        enabled: false,
        reporter: ['text', 'json', 'html'],
        exclude: [
          'node_modules/',
          'dist/',
          '**/*.d.ts',
          '**/*.config.*',
          '**/mockData.ts',
          'test/**',
        ],
      },
    },
  })
)
