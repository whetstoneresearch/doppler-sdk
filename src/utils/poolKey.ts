import { encodeAbiParameters, keccak256, type Address, type Hex } from 'viem';
import type { V4PoolKey } from '../types';

/**
 * Computes the PoolId (bytes32) from a V4 PoolKey
 *
 * In Uniswap V4, a PoolId is computed as keccak256(abi.encode(poolKey))
 * where poolKey contains: currency0, currency1, fee, tickSpacing, hooks
 *
 * @param poolKey - The V4 pool key containing currency0, currency1, fee, tickSpacing, and hooks
 * @returns The computed PoolId as a bytes32 hex string
 */
export function computePoolId(poolKey: V4PoolKey): Hex {
  // Encode the poolKey struct following Solidity's abi.encode rules
  // PoolKey struct has 5 fields, each taking 32 bytes (0xa0 = 160 bytes total)
  const encoded = encodeAbiParameters(
    [
      { name: 'currency0', type: 'address' },
      { name: 'currency1', type: 'address' },
      { name: 'fee', type: 'uint24' },
      { name: 'tickSpacing', type: 'int24' },
      { name: 'hooks', type: 'address' },
    ],
    [
      poolKey.currency0,
      poolKey.currency1,
      poolKey.fee,
      poolKey.tickSpacing,
      poolKey.hooks,
    ],
  );

  // Return keccak256 hash of the encoded poolKey
  return keccak256(encoded);
}

/**
 * Normalizes a pool key value from various response shapes (tuple array or named fields)
 * into a canonical V4PoolKey object.
 *
 * This handles the different formats that contract reads may return:
 * - Named tuple: { currency0, currency1, fee, tickSpacing, hooks }
 * - Positional array: [currency0, currency1, fee, tickSpacing, hooks]
 */
export function normalizePoolKey(value: unknown): V4PoolKey {
  if (!value) {
    throw new Error('normalizePoolKey: value is null or undefined');
  }

  if (Array.isArray(value)) {
    if (value.length < 5) {
      throw new Error(
        `normalizePoolKey: expected array of length >= 5, got ${value.length}`,
      );
    }
    return {
      currency0: value[0] as Address,
      currency1: value[1] as Address,
      fee: Number(value[2]),
      tickSpacing: Number(value[3]),
      hooks: value[4] as Address,
    };
  }

  const obj = value as Record<string, unknown>;
  if (
    obj.currency0 === undefined ||
    obj.currency1 === undefined ||
    obj.fee === undefined ||
    obj.tickSpacing === undefined ||
    obj.hooks === undefined
  ) {
    throw new Error(
      'normalizePoolKey: missing required fields (currency0, currency1, fee, tickSpacing, hooks)',
    );
  }

  return {
    currency0: obj.currency0 as Address,
    currency1: obj.currency1 as Address,
    fee: Number(obj.fee),
    tickSpacing: Number(obj.tickSpacing),
    hooks: obj.hooks as Address,
  };
}
