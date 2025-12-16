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
    // Reduce concurrency to avoid rate limiting on public RPCs
    maxConcurrency: 1,
    // Run test files sequentially to further reduce RPC load
    fileParallelism: false,
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
