/**
 * Test utilities for rate-limited RPC calls
 *
 * Public RPCs have strict rate limits. This utility provides:
 * - Configurable delays between requests
 * - Exponential backoff retry logic
 * - Rate-limited public client factory
 */

import {
  createPublicClient,
  defineChain,
  http,
  type Chain,
  type PublicClient,
  type HttpTransportConfig,
} from 'viem';
import { arbitrum, base, baseSepolia, bsc, mainnet } from 'viem/chains';
import { CHAIN_IDS } from '../../../src/evm/addresses';
import { arc } from '../../../src/evm/chains';

/** Monad Mainnet chain definition (not in viem/chains yet) */
const monadMainnet = defineChain({
  id: CHAIN_IDS.MONAD_MAINNET,
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
});

const robinhoodChain = defineChain({
  id: CHAIN_IDS.ROBINHOOD,
  name: 'Robinhood Chain',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.mainnet.chain.robinhood.com'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Robinhood Chain Blockscout',
      url: 'https://robinhoodchain.blockscout.com',
    },
  },
});

/** Chain configuration for tests */
interface ChainTestConfig {
  chain: Chain;
  envVars: string[];
  /** Optional Alchemy network name for fallback */
  alchemyNetwork?: string;
}

export const CHAIN_CONFIG: Record<number, ChainTestConfig> = {
  [CHAIN_IDS.MAINNET]: {
    chain: mainnet,
    envVars: ['ETH_MAINNET_RPC_URL', 'MAINNET_RPC_URL'],
    alchemyNetwork: 'eth-mainnet',
  },
  [CHAIN_IDS.ARBITRUM]: {
    chain: arbitrum,
    envVars: ['ARBITRUM_RPC_URL'],
    alchemyNetwork: 'arb-mainnet',
  },
  [CHAIN_IDS.BSC]: {
    chain: bsc,
    envVars: ['BSC_RPC_URL'],
    alchemyNetwork: 'bnb-mainnet',
  },
  [CHAIN_IDS.ARC]: {
    chain: arc,
    envVars: ['ARC_MAINNET_RPC_URL'],
    alchemyNetwork: 'arc-mainnet',
  },
  [CHAIN_IDS.BASE]: {
    chain: base,
    envVars: ['BASE_RPC_URL'],
    alchemyNetwork: 'base-mainnet',
  },
  [CHAIN_IDS.BASE_SEPOLIA]: {
    chain: baseSepolia,
    envVars: ['BASE_SEPOLIA_RPC_URL'],
    alchemyNetwork: 'base-sepolia',
  },
  [CHAIN_IDS.ROBINHOOD]: {
    chain: robinhoodChain,
    envVars: ['ROBINHOOD_RPC_URL'],
  },
  [CHAIN_IDS.MONAD_MAINNET]: {
    chain: monadMainnet,
    envVars: ['MONAD_MAINNET_RPC_URL'],
    alchemyNetwork: 'monad-mainnet',
  },
};

/**
 * Get the RPC URL for a chain
 * Priority: env var > Alchemy > default viem RPC
 */
export function getRpcUrl(config: ChainTestConfig): string | undefined {
  for (const envVar of config.envVars) {
    const envUrl = process.env[envVar];
    if (envUrl) return envUrl;
  }

  // 2. Try Alchemy fallback
  const alchemyKey = process.env.ALCHEMY_API_KEY;
  if (alchemyKey && config.alchemyNetwork) {
    return `https://${config.alchemyNetwork}.g.alchemy.com/v2/${alchemyKey}`;
  }

  // 3. Fall back to default viem RPC URL
  const defaultRpc = config.chain.rpcUrls.default.http[0];
  if (defaultRpc) return defaultRpc;

  return undefined;
}

/** Default delay between RPC requests in ms */
export const DEFAULT_RPC_DELAY_MS = 500;

/** Default retry configuration */
export const DEFAULT_RETRY_CONFIG = {
  /** Maximum number of retry attempts */
  maxAttempts: 5,
  /** Initial delay before first retry in ms */
  initialDelayMs: 1000,
  /** Maximum delay between retries in ms */
  maxDelayMs: 10000,
  /** Multiplier for exponential backoff */
  backoffMultiplier: 2,
};

/**
 * Delay helper for adding pauses between RPC calls
 */
export const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Create a rate-limited public client with retry logic
 *
 * @param chain - The viem chain configuration
 * @param rpcUrl - Optional custom RPC URL (falls back to chain default)
 * @param options - Additional configuration options
 */
export function createRateLimitedClient(
  chain: Chain,
  rpcUrl?: string,
  options: {
    /** Delay between requests in ms */
    delayMs?: number;
    /** Retry count for failed requests */
    retryCount?: number;
    /** Retry delay in ms */
    retryDelay?: number;
  } = {},
): PublicClient {
  const {
    retryCount = DEFAULT_RETRY_CONFIG.maxAttempts,
    retryDelay = DEFAULT_RETRY_CONFIG.initialDelayMs,
  } = options;

  const transportConfig: HttpTransportConfig = {
    retryCount,
    retryDelay,
    // Timeout after 30 seconds
    timeout: 30_000,
  };

  return createPublicClient({
    chain,
    transport: http(rpcUrl || chain.rpcUrls.default.http[0], transportConfig),
  });
}

/**
 * Execute an async function with exponential backoff retry
 *
 * @param fn - The async function to execute
 * @param options - Retry configuration options
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<typeof DEFAULT_RETRY_CONFIG> = {},
): Promise<T> {
  const config = { ...DEFAULT_RETRY_CONFIG, ...options };
  let lastError: Error | undefined;
  let delayMs = config.initialDelayMs;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Check if it's a rate limit error (429)
      const isRateLimitError =
        lastError.message?.includes('429') ||
        lastError.message?.includes('rate limit') ||
        lastError.message?.includes('too many requests');

      // Only retry on rate limit errors or network errors
      const isRetryable =
        isRateLimitError ||
        lastError.message?.includes('network') ||
        lastError.message?.includes('timeout') ||
        lastError.message?.includes('ECONNRESET');

      if (!isRetryable || attempt === config.maxAttempts) {
        throw lastError;
      }

      // Log retry attempt (helpful for debugging)
      console.warn(
        `[RPC Retry] Attempt ${attempt}/${config.maxAttempts} failed, ` +
          `retrying in ${delayMs}ms... Error: ${lastError.message?.slice(0, 100)}`,
      );

      await delay(delayMs);
      delayMs = Math.min(delayMs * config.backoffMultiplier, config.maxDelayMs);
    }
  }

  throw lastError;
}

/**
 * Batch execute RPC calls with delays between each
 *
 * @param calls - Array of async functions to execute
 * @param delayMs - Delay between each call in ms
 */
export async function batchWithDelay<T>(
  calls: Array<() => Promise<T>>,
  delayMs: number = DEFAULT_RPC_DELAY_MS,
): Promise<T[]> {
  const results: T[] = [];

  for (let i = 0; i < calls.length; i++) {
    if (i > 0) {
      await delay(delayMs);
    }
    results.push(await calls[i]());
  }

  return results;
}
