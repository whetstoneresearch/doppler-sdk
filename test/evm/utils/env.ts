import * as dotenv from 'dotenv'
import { existsSync } from 'fs'
import { resolve } from 'path'

let loaded = false

export function loadTestEnv(): void {
  if (loaded) return

  const projectRoot = resolve(__dirname, '../../..')
  const envFiles = ['.env.local', '.env', '.env.development']

  for (const file of envFiles) {
    const envPath = resolve(projectRoot, file)
    if (existsSync(envPath)) {
      dotenv.config({ path: envPath })
      break
    }
  }

  loaded = true
}
