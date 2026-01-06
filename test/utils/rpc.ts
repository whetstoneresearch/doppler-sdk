/**
 * Test utilities for rate-limited RPC calls
 * 
 * Public RPCs have strict rate limits. This utility provides:
 * - Configurable delays between requests
 * - Exponential backoff retry logic
 * - Rate-limited public client factory
 */

import { createPublicClient, http, type Chain, type PublicClient, type HttpTransportConfig } from 'viem'

/** Default delay between RPC requests in ms */
export const DEFAULT_RPC_DELAY_MS = 500

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
}

/**
 * Delay helper for adding pauses between RPC calls
 */
export const delay = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms))

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
    delayMs?: number
    /** Retry count for failed requests */
    retryCount?: number
    /** Retry delay in ms */
    retryDelay?: number
  } = {}
): PublicClient {
  const {
    retryCount = DEFAULT_RETRY_CONFIG.maxAttempts,
    retryDelay = DEFAULT_RETRY_CONFIG.initialDelayMs,
  } = options

  const transportConfig: HttpTransportConfig = {
    retryCount,
    retryDelay,
    // Timeout after 30 seconds
    timeout: 30_000,
  }

  return createPublicClient({
    chain,
    transport: http(rpcUrl || chain.rpcUrls.default.http[0], transportConfig),
  })
}

/**
 * Execute an async function with exponential backoff retry
 * 
 * @param fn - The async function to execute
 * @param options - Retry configuration options
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<typeof DEFAULT_RETRY_CONFIG> = {}
): Promise<T> {
  const config = { ...DEFAULT_RETRY_CONFIG, ...options }
  let lastError: Error | undefined
  let delayMs = config.initialDelayMs

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      
      // Check if it's a rate limit error (429)
      const isRateLimitError = 
        lastError.message?.includes('429') || 
        lastError.message?.includes('rate limit') ||
        lastError.message?.includes('too many requests')

      // Only retry on rate limit errors or network errors
      const isRetryable = isRateLimitError || 
        lastError.message?.includes('network') ||
        lastError.message?.includes('timeout') ||
        lastError.message?.includes('ECONNRESET')

      if (!isRetryable || attempt === config.maxAttempts) {
        throw lastError
      }

      // Log retry attempt (helpful for debugging)
      console.warn(
        `[RPC Retry] Attempt ${attempt}/${config.maxAttempts} failed, ` +
        `retrying in ${delayMs}ms... Error: ${lastError.message?.slice(0, 100)}`
      )

      await delay(delayMs)
      delayMs = Math.min(delayMs * config.backoffMultiplier, config.maxDelayMs)
    }
  }

  throw lastError
}

/**
 * Batch execute RPC calls with delays between each
 * 
 * @param calls - Array of async functions to execute
 * @param delayMs - Delay between each call in ms
 */
export async function batchWithDelay<T>(
  calls: Array<() => Promise<T>>,
  delayMs: number = DEFAULT_RPC_DELAY_MS
): Promise<T[]> {
  const results: T[] = []
  
  for (let i = 0; i < calls.length; i++) {
    if (i > 0) {
      await delay(delayMs)
    }
    results.push(await calls[i]())
  }
  
  return results
}
