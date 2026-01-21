/**
 * Global teardown for Vitest fork tests
 *
 * Stops all Anvil processes after tests complete.
 * This is executed once after the entire test suite.
 */

import { getAnvilManager, isAnvilForkEnabled } from '../utils/anvil'

export default async function globalTeardown(): Promise<void> {
  // Skip if not in fork mode
  if (!isAnvilForkEnabled()) {
    return
  }

  console.log('[globalTeardown] Stopping Anvil forks...')

  // Use the global manager if available, otherwise get a new one
  const manager = globalThis.__ANVIL_MANAGER__ ?? getAnvilManager()
  const runningChains = manager.getRunningChains()

  if (runningChains.length === 0) {
    console.log('[globalTeardown] No Anvil processes to stop')
    return
  }

  console.log(
    `[globalTeardown] Stopping ${runningChains.length} Anvil process(es): ${runningChains.join(', ')}`
  )

  await manager.stopAll()

  console.log('[globalTeardown] All Anvil processes stopped')
}
