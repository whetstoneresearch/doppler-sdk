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
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

// Load .env first, then .env.local (override: true allows overwriting)
config({ path: resolve(root, '.env') })
config({ path: resolve(root, '.env.local'), override: true })
