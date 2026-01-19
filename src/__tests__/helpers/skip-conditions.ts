/**
 * Standardized skip utilities for network tests
 *
 * Provides utilities to conditionally skip tests based on RPC availability
 */

import { describe } from 'vitest'
import { hasRpcUrl, getRpcEnvVar } from './network-clients'

/**
 * Create a describe block that skips if no RPC URL is available for the chain
 *
 * Usage:
 *   describeNetwork(CHAIN_IDS.BASE_SEPOLIA, 'Base Sepolia Tests', () => {
 *     it('should do something', () => { ... })
 *   })
 */
export function describeNetwork(chainId: number, name: string, fn: () => void) {
  const shouldRun = hasRpcUrl(chainId)
  ;(shouldRun ? describe : describe.skip)(name, fn)
}

/**
 * Get skip reason message for a chain
 *
 * Usage:
 *   if (!hasRpcUrl(chainId)) {
 *     it.skip(getSkipReason(chainId))
 *     return
 *   }
 */
export function getSkipReason(chainId: number): string {
  const envVar = getRpcEnvVar(chainId)
  return envVar
    ? `requires ${envVar} env var`
    : `no RPC configuration for chain ${chainId}`
}
