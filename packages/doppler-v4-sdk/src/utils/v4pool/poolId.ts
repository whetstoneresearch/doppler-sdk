import { Address, Hex, encodePacked, keccak256 } from 'viem';
import { PoolKey } from '@/types';

/**
 * Computes the pool ID from PoolKey components.
 * Pool IDs in V4 are the keccak256 hash of the encoded PoolKey.
 * 
 * @param poolKey The PoolKey containing pool parameters
 * @returns The computed 32-byte pool ID
 */
export function computePoolId(poolKey: PoolKey): Hex {
  // Sort tokens to ensure consistent pool ID
  const [currency0, currency1] = sortCurrencies(
    poolKey.currency0,
    poolKey.currency1
  );

  return keccak256(
    encodePacked(
      ['address', 'address', 'uint24', 'uint24', 'address'],
      [currency0, currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks]
    )
  );
}

/**
 * Validates if a string is a valid pool ID format.
 * Pool IDs should be 32-byte hex strings (66 characters including '0x').
 * 
 * @param poolId The pool ID to validate
 * @returns True if valid pool ID format
 */
export function isValidPoolId(poolId: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(poolId);
}

/**
 * Formats a pool ID for display by truncating the middle.
 * 
 * @param poolId The pool ID to format
 * @param length The number of characters to show at start (default 8)
 * @returns Formatted pool ID like "0x1234...5678"
 */
export function formatPoolId(poolId: string, length: number = 8): string {
  if (!isValidPoolId(poolId)) {
    throw new Error('Invalid pool ID format');
  }
  
  if (length >= 32) {
    return poolId;
  }
  
  return `${poolId.slice(0, length)}...${poolId.slice(-4)}`;
}

/**
 * Sorts two currency addresses according to V4 conventions.
 * The lower address (when compared as lowercase) comes first.
 * 
 * @param currency0 First currency address
 * @param currency1 Second currency address
 * @returns Sorted tuple of addresses
 */
export function sortCurrencies(
  currency0: Address,
  currency1: Address
): [Address, Address] {
  return currency0.toLowerCase() < currency1.toLowerCase()
    ? [currency0, currency1]
    : [currency1, currency0];
}

/**
 * Compares two pool IDs for equality (case-insensitive).
 * 
 * @param id1 First pool ID
 * @param id2 Second pool ID
 * @returns True if pool IDs are equal
 */
export function poolIdsEqual(id1: string, id2: string): boolean {
  return id1.toLowerCase() === id2.toLowerCase();
}