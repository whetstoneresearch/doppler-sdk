import { defineConfig } from 'tsup'
import { resolve } from 'path'
import { glob } from 'glob'

// Get all TypeScript files except tests and test utilities
const entryPoints = glob.sync('src/**/!(*.test|*.spec).ts', {
  ignore: ['src/test/**', '**/test/**', 'src/__tests__/**', '**/__tests__/**']
})

export default defineConfig({
  entry: {
    // Main entry point
    index: 'src/index.ts',
    // Product-focused module entry points (user-facing)
    'common/index': 'src/common/index.ts',
    'static/index': 'src/static/index.ts',
    'dynamic/index': 'src/dynamic/index.ts',
    'multicurve/index': 'src/multicurve/index.ts',
    // Include all other files for backwards compatibility
    ...Object.fromEntries(
      entryPoints
        .filter(f =>
          !f.includes('src/index.ts') &&
          !f.includes('src/common/index.ts') &&
          !f.includes('src/static/index.ts') &&
          !f.includes('src/dynamic/index.ts') &&
          !f.includes('src/multicurve/index.ts')
        )
        .map(f => [
          f.replace('src/', '').replace('.ts', ''),
          f
        ])
    )
  },
  format: ['cjs', 'esm'],
  dts: {
    // Resolve DTS generation memory issues by using a separate process
    resolve: true,
  },
  splitting: true,
  clean: true,
  outDir: 'dist',
  treeshake: true,
  sourcemap: true,
  // Prevent worker memory issues
  skipNodeModulesBundle: true,
  esbuildOptions(options) {
    options.alias = {
      '@': resolve(__dirname, './src')
    }
  },
  external: [
    'viem'
  ]
})
