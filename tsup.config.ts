import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'evm/index': 'src/evm/index.ts',
    'solana/index': 'src/solana/index.ts',
    'solana/react/index': 'src/solana/react/index.ts',
  },
  format: ['esm'],
  dts: true,
  splitting: true,
  clean: true,
  outDir: 'dist',
  treeshake: true,
  sourcemap: true,
  external: ['viem', 'react', '@solana/kit'],
});
