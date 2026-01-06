/**
 * Shared test clients with rate limiting
 * 
 * Provides pre-configured rate-limited clients for each supported chain.
 * Use these instead of creating raw publicClients to avoid 429 rate limit errors.
 * 
 * Usage:
 *   import { getTestClient } from './utils/clients'
 *   const publicClient = getTestClient(CHAIN_IDS.BASE_SEPOLIA)
 * 
 * Or use convenience exports:
 *   import { getBaseSepoliaClient } from './utils/clients'
 *   const publicClient = getBaseSepoliaClient()
 */

import { type Chain, type PublicClient, defineChain } from 'viem'
import { base, baseSepolia } from 'viem/chains'
import { createRateLimitedClient } from './rpc'
import { CHAIN_IDS } from '../../src'

/** Default retry configuration for test clients */
const DEFAULT_TEST_CLIENT_CONFIG = {
  retryCount: 5,
  retryDelay: 2000,
}

/** Monad Mainnet chain definition (not in viem/chains yet) */
export const monadMainnet = defineChain({
  id: 143,
  name: 'Monad Mainnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Monad',
    symbol: 'MONAD',
  },
  rpcUrls: {
    default: {
      http: [],
    },
  },
})

/** Chain configuration for tests */
interface ChainTestConfig {
  chain: Chain
  envVar: string
  /** Optional Alchemy network name for fallback */
  alchemyNetwork?: string
}

const CHAIN_CONFIG: Record<number, ChainTestConfig> = {
  [CHAIN_IDS.BASE]: {
    chain: base,
    envVar: 'BASE_RPC_URL',
    alchemyNetwork: 'base-mainnet',
  },
  [CHAIN_IDS.BASE_SEPOLIA]: {
    chain: baseSepolia,
    envVar: 'BASE_SEPOLIA_RPC_URL',
    alchemyNetwork: 'base-sepolia',
  },
  [CHAIN_IDS.MONAD_MAINNET]: {
    chain: monadMainnet,
    envVar: 'MONAD_MAINNET_RPC_URL',
  },
}

/**
 * Get the RPC URL for a chain
 * Priority: env var > Alchemy > default viem RPC
 */
function getRpcUrl(config: ChainTestConfig): string | undefined {
  // 1. Check environment variable
  const envUrl = process.env[config.envVar]
  if (envUrl) return envUrl

  // 2. Try Alchemy fallback
  const alchemyKey = process.env.ALCHEMY_API_KEY
  if (alchemyKey && config.alchemyNetwork) {
    return `https://${config.alchemyNetwork}.g.alchemy.com/v2/${alchemyKey}`
  }

  // 3. Fall back to default viem RPC URL
  const defaultRpc = config.chain.rpcUrls.default.http[0]
  if (defaultRpc) return defaultRpc

  return undefined
}

/**
 * Get a rate-limited test client for the specified chain
 * 
 * @param chainId - The chain ID to get a client for
 * @param options - Optional override for retry configuration
 * @returns A rate-limited PublicClient
 * @throws Error if chain is not configured or RPC URL is not available
 */
export function getTestClient(
  chainId: number,
  options: { retryCount?: number; retryDelay?: number } = {}
): PublicClient {
  const config = CHAIN_CONFIG[chainId]
  if (!config) {
    throw new Error(
      `No test client configuration for chain ${chainId}. ` +
      `Supported chains: ${Object.keys(CHAIN_CONFIG).join(', ')}`
    )
  }

  const rpcUrl = getRpcUrl(config)
  if (!rpcUrl) {
    throw new Error(
      `No RPC URL available for chain ${chainId}. ` +
      `Set ${config.envVar} environment variable` +
      (config.alchemyNetwork ? ` or ALCHEMY_API_KEY for ${config.alchemyNetwork}` : '')
    )
  }

  return createRateLimitedClient(config.chain, rpcUrl, {
    ...DEFAULT_TEST_CLIENT_CONFIG,
    ...options,
  })
}

/**
 * Check if an RPC URL is available for the specified chain
 * Useful for conditionally skipping tests
 */
export function hasRpcUrl(chainId: number): boolean {
  const config = CHAIN_CONFIG[chainId]
  if (!config) return false
  return getRpcUrl(config) !== undefined
}

/**
 * Get the environment variable name for a chain's RPC URL
 * Useful for skip messages
 */
export function getRpcEnvVar(chainId: number): string | undefined {
  return CHAIN_CONFIG[chainId]?.envVar
}

// Convenience exports for commonly used chains
export const getBaseClient = () => getTestClient(CHAIN_IDS.BASE)
export const getBaseSepoliaClient = () => getTestClient(CHAIN_IDS.BASE_SEPOLIA)
export const getMonadMainnetClient = () => getTestClient(CHAIN_IDS.MONAD_MAINNET)
