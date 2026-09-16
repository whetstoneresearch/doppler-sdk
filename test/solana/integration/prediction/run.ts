/** Local-fork lifecycle assertions and resumable scenario runner. */
import '../../../../examples/env.js';
import { run } from './runner.js';

run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
