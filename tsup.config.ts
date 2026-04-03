import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'evm/index': 'src/evm/index.ts',
    'solana/index': 'src/solana/index.ts',
    'solana/react/index': 'src/solana/react/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: true,
  clean: true,
  outDir: 'dist',
  treeshake: true,
  sourcemap: true,
  external: ['viem', 'react', '@solana/kit', '@solana/program-client-core', '@wallet-standard/base', '@wallet-standard/features'],
});
