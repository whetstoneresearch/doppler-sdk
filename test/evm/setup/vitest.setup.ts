/**
 * Vitest setup file
 *
 * Configures custom matchers and global test utilities.
 * This runs before each test file.
 */

import * as dotenv from 'dotenv'
import { resolve } from 'path'
import { existsSync } from 'fs'
import { expect } from 'vitest'
import { isAddress, isHash } from 'viem'

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

/**
 * Custom matcher: toBeValidAddress
 *
 * Checks if a value is a valid Ethereum address.
 *
 * @example
 * expect(result.address).toBeValidAddress()
 */
expect.extend({
  toBeValidAddress(received: unknown) {
    const pass =
      typeof received === 'string' && isAddress(received as `0x${string}`)

    return {
      pass,
      message: () =>
        pass
          ? `Expected ${received} not to be a valid Ethereum address`
          : `Expected ${received} to be a valid Ethereum address`,
    }
  },
})

/**
 * Custom matcher: toBeValidTxHash
 *
 * Checks if a value is a valid transaction hash (32-byte hex string).
 *
 * @example
 * expect(result.hash).toBeValidTxHash()
 */
expect.extend({
  toBeValidTxHash(received: unknown) {
    const pass =
      typeof received === 'string' && isHash(received as `0x${string}`)

    return {
      pass,
      message: () =>
        pass
          ? `Expected ${received} not to be a valid transaction hash`
          : `Expected ${received} to be a valid transaction hash`,
    }
  },
})

/**
 * Custom matcher: toBeWithinRange
 *
 * Checks if a bigint value is within a range (inclusive).
 *
 * @example
 * expect(balance).toBeWithinRange(parseEther('99'), parseEther('101'))
 */
expect.extend({
  toBeWithinRange(received: bigint, min: bigint, max: bigint) {
    const pass =
      typeof received === 'bigint' && received >= min && received <= max

    return {
      pass,
      message: () =>
        pass
          ? `Expected ${received} not to be within range [${min}, ${max}]`
          : `Expected ${received} to be within range [${min}, ${max}]`,
    }
  },
})

/**
 * Custom matcher: toBeGreaterThanBigInt
 *
 * Checks if a bigint is greater than another bigint.
 *
 * @example
 * expect(balance).toBeGreaterThanBigInt(0n)
 */
expect.extend({
  toBeGreaterThanBigInt(received: bigint, expected: bigint) {
    const pass = typeof received === 'bigint' && received > expected

    return {
      pass,
      message: () =>
        pass
          ? `Expected ${received} not to be greater than ${expected}`
          : `Expected ${received} to be greater than ${expected}`,
    }
  },
})

/**
 * Custom matcher: toBeLessThanBigInt
 *
 * Checks if a bigint is less than another bigint.
 *
 * @example
 * expect(fee).toBeLessThanBigInt(maxFee)
 */
expect.extend({
  toBeLessThanBigInt(received: bigint, expected: bigint) {
    const pass = typeof received === 'bigint' && received < expected

    return {
      pass,
      message: () =>
        pass
          ? `Expected ${received} not to be less than ${expected}`
          : `Expected ${received} to be less than ${expected}`,
    }
  },
})

/**
 * Custom matcher: toEqualBigInt
 *
 * Checks if a bigint equals another bigint.
 * More type-safe than regular toBe for bigints.
 *
 * @example
 * expect(result).toEqualBigInt(expectedValue)
 */
expect.extend({
  toEqualBigInt(received: bigint, expected: bigint) {
    const pass = received === expected

    return {
      pass,
      message: () =>
        pass
          ? `Expected ${received} not to equal ${expected}`
          : `Expected ${received} to equal ${expected}, but got ${received}`,
    }
  },
})

// Type declarations for custom matchers
declare module 'vitest' {
  interface Assertion<T = any> {
    toBeValidAddress(): T
    toBeValidTxHash(): T
    toBeWithinRange(min: bigint, max: bigint): T
    toBeGreaterThanBigInt(expected: bigint): T
    toBeLessThanBigInt(expected: bigint): T
    toEqualBigInt(expected: bigint): T
  }
  interface AsymmetricMatchersContaining {
    toBeValidAddress(): any
    toBeValidTxHash(): any
    toBeWithinRange(min: bigint, max: bigint): any
    toBeGreaterThanBigInt(expected: bigint): any
    toBeLessThanBigInt(expected: bigint): any
    toEqualBigInt(expected: bigint): any
  }
}

// Log test mode on startup
const testMode =
  process.env.ANVIL_FORK_ENABLED === 'true'
    ? 'fork'
    : process.env.LIVE_TEST_ENABLED === 'true'
      ? 'live'
      : 'unit'

console.log(`[vitest.setup] Test mode: ${testMode}`)
