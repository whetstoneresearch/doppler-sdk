/**
 * Global setup for Vitest fork tests
 *
 * Starts Anvil forks for all configured chains before tests run.
 * This is executed once before the entire test suite.
 */

import * as dotenv from 'dotenv'
import { resolve } from 'path'
import { existsSync } from 'fs'
import { getAnvilManager, isAnvilForkEnabled } from '../utils/anvil'
import { CHAIN_IDS } from '../../src'

// Load .env files from project root (check multiple common names)
const projectRoot = resolve(__dirname, '../..')
const envFiles = ['.env.local', '.env', '.env.development']
for (const file of envFiles) {
  const envPath = resolve(projectRoot, file)
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath })
    break
  }
}

/** Chains to start Anvil forks for */
const FORK_CHAINS = [
  CHAIN_IDS.BASE,
  CHAIN_IDS.BASE_SEPOLIA,
]

/** Store for cleanup */
declare global {
  // eslint-disable-next-line no-var
  var __ANVIL_MANAGER__: ReturnType<typeof getAnvilManager> | undefined
}

export default async function globalSetup(): Promise<void> {
  // Skip if not in fork mode
  if (!isAnvilForkEnabled()) {
    console.log('[globalSetup] Skipping Anvil setup - not in fork mode')
    return
  }

  // Debug: Check if env vars are loaded
  console.log('[globalSetup] ALCHEMY_API_KEY:', process.env.ALCHEMY_API_KEY ? 'set' : 'NOT SET')
  console.log('[globalSetup] BASE_RPC_URL:', process.env.BASE_RPC_URL ? 'set' : 'NOT SET')
  console.log('[globalSetup] BASE_SEPOLIA_RPC_URL:', process.env.BASE_SEPOLIA_RPC_URL ? 'set' : 'NOT SET')

  console.log('[globalSetup] Starting Anvil forks...')

  const manager = getAnvilManager()
  globalThis.__ANVIL_MANAGER__ = manager

  // Start Anvil forks in parallel
  const startPromises = FORK_CHAINS.map(async (chainId) => {
    try {
      const rpcUrl = await manager.start(chainId)
      console.log(`[globalSetup] Anvil started for chain ${chainId} at ${rpcUrl}`)
      return { chainId, success: true, rpcUrl }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn(
        `[globalSetup] Failed to start Anvil for chain ${chainId}: ${message}`
      )
      return { chainId, success: false, error: message }
    }
  })

  const results = await Promise.all(startPromises)

  // Log summary
  const successful = results.filter((r) => r.success)
  const failed = results.filter((r) => !r.success)

  console.log(
    `[globalSetup] Anvil setup complete: ${successful.length}/${FORK_CHAINS.length} chains started`
  )

  if (failed.length > 0) {
    console.warn(
      '[globalSetup] Failed chains:',
      failed.map((r) => `${r.chainId} (${r.error})`).join(', ')
    )
  }

  // Check if at least one chain started
  if (successful.length === 0) {
    throw new Error(
      'No Anvil forks started successfully. Check that ALCHEMY_API_KEY is set or chain-specific RPC URLs are configured.'
    )
  }
}
