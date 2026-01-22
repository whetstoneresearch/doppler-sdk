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
        'test/unit/**/*.test.ts',
        'src/__tests__/builders/**/*.test.ts',
        'src/__tests__/entities/**/*.test.ts',
        'src/__tests__/utils/**/*.test.ts',
        'src/__tests__/type-consistency.test.ts',
        'src/__tests__/v4-compatibility.test.ts',
      ],
      exclude: [
        'node_modules/',
        'dist/',
        'test/setup/**',
        // Exclude fork and integration tests
        'test/fork/**',
        'test/integration/**',
        'test/e2e/**',
        'src/__tests__/fork/**',
        'src/__tests__/integration/**',
        'src/__tests__/stress/**',
      ],
      // Unit tests can run in parallel
      maxConcurrency: 5,
      fileParallelism: true,
      // Faster timeout for unit tests
      testTimeout: 10_000,
      hookTimeout: 10_000,
      // Setup file for custom matchers
      setupFiles: ['./test/setup/vitest.setup.ts'],
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
