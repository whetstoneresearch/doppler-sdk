/**
 * Environment loader for examples.
 * Import this at the top of any example to load .env from the project root.
 *
 * Loads in order (later files override earlier):
 * 1. .env (base defaults)
 * 2. .env.local (local overrides, not committed)
 *
 * This is for LOCAL DEVELOPMENT only and is not included in the published package.
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const existingEnv = new Map(
  Object.entries(process.env).filter((entry): entry is [string, string] => {
    return entry[1] !== undefined;
  }),
);

// Load .env first, then .env.local, while preserving explicit shell env vars.
config({ path: resolve(root, '.env') });
config({ path: resolve(root, '.env.local'), override: true });
for (const [key, value] of existingEnv) {
  process.env[key] = value;
}
