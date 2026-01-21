import { defineConfig, mergeConfig } from 'vitest/config'
import baseConfig from './vitest.config'

/**
 * Fork test configuration
 *
 * Runs tests against Anvil forks of live networks.
 * Requires ALCHEMY_API_KEY or chain-specific RPC URLs.
 * Set ANVIL_FORK_ENABLED=true to enable fork mode.
 *
 * Usage: ANVIL_FORK_ENABLED=true pnpm test:fork
 */
export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: [
        'test/fork/**/*.test.ts',
        'test/integration/**/*.test.ts',
        'src/__tests__/fork/**/*.test.ts',
        'src/__tests__/integration/**/*.test.ts',
        // Include chain-specific tests from test/ root
        'test/*.base.test.ts',
        'test/*.base-sepolia.test.ts',
        'test/*.monad-mainnet.test.ts',
      ],
      exclude: [
        'node_modules/',
        'dist/',
        'test/setup/**',
        'test/unit/**',
        'test/e2e/**',
        // Token address miner tests are unit tests
        'test/token-address-miner*.test.ts',
      ],
      // Fork tests run sequentially to share Anvil state
      maxConcurrency: 1,
      fileParallelism: false,
      // Longer timeout for fork operations
      testTimeout: 120_000,
      hookTimeout: 120_000,
      // Global setup starts Anvil
      globalSetup: ['./test/setup/globalSetup.ts'],
      // Setup file for custom matchers and snapshot hooks
      setupFiles: ['./test/setup/vitest.setup.ts'],
      // Env vars for fork mode
      env: {
        ANVIL_FORK_ENABLED: 'true',
      },
    },
  })
)
