/**
 * Shared test clients with rate limiting and fork support
 *
 * Provides pre-configured clients for each supported chain with three modes:
 * - Unit: Mocked clients for fast unit tests
 * - Fork: Anvil fork clients for local testing with real state
 * - Live: Rate-limited clients for live network testing
 *
 * Usage:
 *   import { getTestClients } from './utils/clients'
 *   const { publicClient, walletClient, testClient } = getTestClients(CHAIN_IDS.BASE_SEPOLIA)
 *
 * Or use convenience exports:
 *   import { getBaseSepoliaClient } from './utils/clients'
 *   const publicClient = getBaseSepoliaClient()
 */

import {
  type Chain,
  type PublicClient,
  type WalletClient,
  type TestClient,
  type Account,
  type Transport,
  defineChain,
  createPublicClient,
  createWalletClient,
  createTestClient,
  http,
} from 'viem'
import { base, baseSepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { createRateLimitedClient } from './rpc'
import { CHAIN_IDS } from '../../src'
import {
  ANVIL_ACCOUNTS,
  getAnvilManager,
  getAnvilPort,
  isAnvilForkEnabled,
} from './anvil'
import { getTestMode, type TestMode } from './testHelpers'

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

/**
 * Get the Anvil RPC URL for a chain
 */
function getAnvilRpcUrl(chainId: number): string {
  const port = getAnvilPort(chainId)
  return `http://127.0.0.1:${port}`
}

/**
 * Test clients bundle for fork testing
 */
export interface ForkClients {
  publicClient: PublicClient
  walletClient: WalletClient
  testClient: TestClient
  account: Account
  chain: Chain
}

/**
 * Get a set of clients for fork testing
 *
 * Returns publicClient, walletClient, and testClient pre-configured
 * to work with Anvil on the specified chain.
 *
 * @param chainId - The chain ID to get clients for
 * @param accountIndex - Which Anvil account to use (0-9, default: 0)
 * @returns Object with publicClient, walletClient, testClient, account, and chain
 */
export function getForkClients(
  chainId: number,
  accountIndex: number = 0
): ForkClients {
  const config = CHAIN_CONFIG[chainId]
  if (!config) {
    throw new Error(
      `No configuration for chain ${chainId}. ` +
        `Supported chains: ${Object.keys(CHAIN_CONFIG).join(', ')}`
    )
  }

  const rpcUrl = getAnvilRpcUrl(chainId)
  const account = privateKeyToAccount(ANVIL_ACCOUNTS[accountIndex].privateKey)
  const transport = http(rpcUrl)

  const publicClient = createPublicClient({
    chain: config.chain,
    transport,
  })

  const walletClient = createWalletClient({
    chain: config.chain,
    transport,
    account,
  })

  const testClient = createTestClient({
    chain: config.chain,
    transport,
    mode: 'anvil',
  })

  return {
    publicClient,
    walletClient,
    testClient,
    account,
    chain: config.chain,
  }
}

/**
 * Options for getTestClients
 */
export interface TestClientsOptions {
  /** Which Anvil account to use (0-9, default: 0) - only used in fork mode */
  accountIndex?: number
  /** Override the detected test mode */
  mode?: TestMode
  /** Custom RPC URL override */
  rpcUrl?: string
}

/**
 * Unified client factory that works across all test modes
 *
 * Automatically detects the test mode and returns appropriate clients:
 * - Fork mode: Full clients with Anvil (publicClient, walletClient, testClient)
 * - Live mode: Rate-limited publicClient only
 * - Unit mode: Basic publicClient (usually mocked separately)
 *
 * @param chainId - The chain ID to get clients for
 * @param options - Configuration options
 */
export function getTestClients(
  chainId: number,
  options: TestClientsOptions = {}
): {
  publicClient: PublicClient
  walletClient?: WalletClient
  testClient?: TestClient
  account?: Account
  chain: Chain
  mode: TestMode
} {
  const mode = options.mode ?? getTestMode()
  const config = CHAIN_CONFIG[chainId]

  if (!config) {
    throw new Error(
      `No configuration for chain ${chainId}. ` +
        `Supported chains: ${Object.keys(CHAIN_CONFIG).join(', ')}`
    )
  }

  if (mode === 'fork') {
    const forkClients = getForkClients(chainId, options.accountIndex ?? 0)
    return {
      ...forkClients,
      mode,
    }
  }

  // Live or unit mode - use rate-limited client
  const rpcUrl = options.rpcUrl ?? getRpcUrl(config)
  if (!rpcUrl) {
    throw new Error(
      `No RPC URL available for chain ${chainId}. ` +
        `Set ${config.envVar} environment variable` +
        (config.alchemyNetwork
          ? ` or ALCHEMY_API_KEY for ${config.alchemyNetwork}`
          : '')
    )
  }

  const publicClient = createRateLimitedClient(config.chain, rpcUrl)

  return {
    publicClient,
    chain: config.chain,
    mode,
  }
}

/**
 * Start Anvil for a chain and return clients
 *
 * Convenience function that starts Anvil and returns ready-to-use clients.
 *
 * @param chainId - The chain ID to start Anvil for
 * @param accountIndex - Which Anvil account to use (0-9, default: 0)
 */
export async function startAnvilAndGetClients(
  chainId: number,
  accountIndex: number = 0
): Promise<ForkClients> {
  const manager = getAnvilManager()
  await manager.start(chainId)
  return getForkClients(chainId, accountIndex)
}

/**
 * Get a wallet client for the specified Anvil account
 *
 * @param chainId - The chain ID
 * @param accountIndex - Which Anvil account to use (0-9, default: 0)
 */
export function getAnvilWalletClient(
  chainId: number,
  accountIndex: number = 0
): WalletClient {
  const config = CHAIN_CONFIG[chainId]
  if (!config) {
    throw new Error(`No configuration for chain ${chainId}`)
  }

  const rpcUrl = getAnvilRpcUrl(chainId)
  const account = privateKeyToAccount(ANVIL_ACCOUNTS[accountIndex].privateKey)

  return createWalletClient({
    chain: config.chain,
    transport: http(rpcUrl),
    account,
  })
}

/**
 * Get a test client for Anvil operations (mining, snapshots, etc.)
 *
 * @param chainId - The chain ID
 */
export function getAnvilTestClient(chainId: number): TestClient {
  const config = CHAIN_CONFIG[chainId]
  if (!config) {
    throw new Error(`No configuration for chain ${chainId}`)
  }

  const rpcUrl = getAnvilRpcUrl(chainId)

  return createTestClient({
    chain: config.chain,
    transport: http(rpcUrl),
    mode: 'anvil',
  })
}

// Re-export Anvil accounts for convenience
export { ANVIL_ACCOUNTS } from './anvil'
