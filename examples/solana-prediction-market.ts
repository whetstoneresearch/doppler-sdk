/** Runnable prediction lifecycle scenarios. See docs/solana-prediction-markets.md. */
import './env.js';
import { run } from './solana-prediction/runner.js';
run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
