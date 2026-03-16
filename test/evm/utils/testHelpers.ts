/**
 * Test helpers for common testing patterns
 *
 * Provides utilities for:
 * - Conditional test execution based on test mode
 * - Account funding
 * - Block mining
 * - Time manipulation
 */

import { describe, it, type TestFunction } from 'vitest'
import type { Address, TestClient, WalletClient, Chain, TestClientMode } from 'viem'
import { parseEther } from 'viem'
import { isAnvilForkEnabled } from './anvil'

type AnyTestClient = TestClient<TestClientMode, any, Chain | undefined>

/** Test mode detection */
export type TestMode = 'unit' | 'fork' | 'live'

/**
 * Get the current test mode based on environment variables
 */
export function getTestMode(): TestMode {
  if (isAnvilForkEnabled()) {
    return 'fork'
  }
  if (process.env.LIVE_TEST_ENABLED === 'true') {
    return 'live'
  }
  return 'unit'
}

/**
 * Check if running in fork mode
 */
export function isForkMode(): boolean {
  return getTestMode() === 'fork'
}

/**
 * Check if running in live mode
 */
export function isLiveMode(): boolean {
  return getTestMode() === 'live'
}

/**
 * Check if running in unit test mode
 */
export function isUnitMode(): boolean {
  return getTestMode() === 'unit'
}

/**
 * Conditional describe that only runs in fork mode
 *
 * @example
 * ```ts
 * describeFork('MyContract fork tests', () => {
 *   it('should work with real state', async () => {
 *     // This test only runs when ANVIL_FORK_ENABLED=true
 *   })
 * })
 * ```
 */
export const describeFork = isForkMode()
  ? describe
  : describe.skip

/**
 * Conditional describe that only runs in live mode
 */
export const describeLive = isLiveMode()
  ? describe
  : describe.skip

/**
 * Conditional describe that only runs in unit mode
 */
export const describeUnit = isUnitMode()
  ? describe
  : describe.skip

/**
 * Conditional it that only runs in fork mode
 */
export const itFork = isForkMode()
  ? it
  : it.skip

/**
 * Conditional it that only runs in live mode
 */
export const itLive = isLiveMode()
  ? it
  : it.skip

/**
 * Conditional it that only runs in unit mode
 */
export const itUnit = isUnitMode()
  ? it
  : it.skip

/**
 * Run a test only if a condition is met
 */
export function itIf(
  condition: boolean,
  name: string,
  fn: TestFunction
): void {
  if (condition) {
    it(name, fn)
  } else {
    it.skip(name, fn)
  }
}

/**
 * Fund an account with ETH on Anvil
 *
 * @param testClient - The test client to use
 * @param address - The address to fund
 * @param amount - Amount in ETH (default: 100)
 */
export async function fundAccount(
  testClient: AnyTestClient,
  address: Address,
  amount: number = 100
): Promise<void> {
  await testClient.setBalance({
    address,
    value: parseEther(String(amount)),
  })
}

/**
 * Fund multiple accounts with ETH on Anvil
 *
 * @param testClient - The test client to use
 * @param addresses - The addresses to fund
 * @param amount - Amount in ETH per account (default: 100)
 */
export async function fundAccounts(
  testClient: AnyTestClient,
  addresses: Address[],
  amount: number = 100
): Promise<void> {
  await Promise.all(
    addresses.map((address) => fundAccount(testClient, address, amount))
  )
}

/**
 * Mine a specified number of blocks
 *
 * @param testClient - The test client to use
 * @param blocks - Number of blocks to mine (default: 1)
 */
export async function mineBlocks(
  testClient: AnyTestClient,
  blocks: number = 1
): Promise<void> {
  await testClient.mine({ blocks })
}

/**
 * Mine blocks until a specific timestamp
 *
 * @param testClient - The test client to use
 * @param timestamp - Target timestamp (Unix seconds)
 */
export async function mineToTimestamp(
  testClient: AnyTestClient,
  timestamp: bigint
): Promise<void> {
  await testClient.setNextBlockTimestamp({ timestamp })
  await testClient.mine({ blocks: 1 })
}

/**
 * Set the next block timestamp
 *
 * @param testClient - The test client to use
 * @param timestamp - The timestamp to set (Unix seconds)
 */
export async function setTimestamp(
  testClient: AnyTestClient,
  timestamp: bigint
): Promise<void> {
  await testClient.setNextBlockTimestamp({ timestamp })
}

/**
 * Increase time by a specified number of seconds
 *
 * @param testClient - The test client to use
 * @param seconds - Number of seconds to increase
 */
export async function increaseTime(
  testClient: AnyTestClient,
  seconds: number | bigint
): Promise<void> {
  await testClient.increaseTime({
    seconds: typeof seconds === 'number' ? seconds : Number(seconds),
  })
}

/**
 * Impersonate an account for testing
 *
 * @param testClient - The test client to use
 * @param address - The address to impersonate
 */
export async function impersonateAccount(
  testClient: AnyTestClient,
  address: Address
): Promise<void> {
  await testClient.impersonateAccount({ address })
}

/**
 * Stop impersonating an account
 *
 * @param testClient - The test client to use
 * @param address - The address to stop impersonating
 */
export async function stopImpersonatingAccount(
  testClient: AnyTestClient,
  address: Address
): Promise<void> {
  await testClient.stopImpersonatingAccount({ address })
}

/**
 * Execute a transaction as an impersonated account
 *
 * @param testClient - The test client to use
 * @param walletClient - The wallet client to use for transactions
 * @param address - The address to impersonate
 * @param fn - The function to execute while impersonating
 */
export async function asAccount<T>(
  testClient: AnyTestClient,
  address: Address,
  fn: () => Promise<T>
): Promise<T> {
  await impersonateAccount(testClient, address)
  try {
    return await fn()
  } finally {
    await stopImpersonatingAccount(testClient, address)
  }
}

/**
 * Set the code at an address (useful for deploying mock contracts)
 *
 * @param testClient - The test client to use
 * @param address - The address to set code at
 * @param bytecode - The bytecode to set
 */
export async function setCode(
  testClient: AnyTestClient,
  address: Address,
  bytecode: `0x${string}`
): Promise<void> {
  await testClient.setCode({ address, bytecode })
}

/**
 * Set storage at a specific slot
 *
 * @param testClient - The test client to use
 * @param address - The contract address
 * @param slot - The storage slot
 * @param value - The value to set
 */
export async function setStorageAt(
  testClient: AnyTestClient,
  address: Address,
  slot: `0x${string}`,
  value: `0x${string}`
): Promise<void> {
  await testClient.setStorageAt({ address, index: slot, value })
}

/**
 * Get the current block number
 *
 * @param testClient - The test client to use
 */
export async function getBlockNumber(
  testClient: AnyTestClient
): Promise<bigint> {
  return testClient.getBlockNumber()
}

/**
 * Get the current block timestamp
 *
 * @param testClient - The test client to use
 */
export async function getBlockTimestamp(
  testClient: AnyTestClient
): Promise<bigint> {
  const block = await testClient.getBlock()
  return block.timestamp
}

/**
 * Wait for a condition to be true, with timeout
 *
 * @param condition - The condition to wait for
 * @param timeout - Maximum time to wait in ms (default: 10000)
 * @param interval - Polling interval in ms (default: 100)
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 10000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now()
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, interval))
  }
  throw new Error(`waitFor timed out after ${timeout}ms`)
}

/**
 * Retry a function until it succeeds or max attempts reached
 *
 * @param fn - The function to retry
 * @param maxAttempts - Maximum number of attempts (default: 3)
 * @param delay - Delay between attempts in ms (default: 1000)
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error | undefined
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }
  throw lastError
}
