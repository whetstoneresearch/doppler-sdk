import { Address } from 'viem';
import { PoolKey } from '@/types';
import { sortCurrencies } from './poolId';

/**
 * Builds a PoolKey from individual components, ensuring proper ordering.
 * 
 * @param params Pool parameters
 * @returns A properly formatted PoolKey
 */
export function buildPoolKey(params: {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
}): PoolKey {
  // V4 PoolKeys must have currencies sorted
  const [sortedCurrency0, sortedCurrency1] = sortCurrencies(
    params.currency0,
    params.currency1
  );

  return {
    currency0: sortedCurrency0,
    currency1: sortedCurrency1,
    fee: params.fee,
    tickSpacing: params.tickSpacing,
    hooks: params.hooks,
  };
}

/**
 * Validates if a PoolKey has all required fields with valid values.
 * 
 * @param poolKey The PoolKey to validate
 * @returns True if the PoolKey is valid
 */
export function isValidPoolKey(poolKey: PoolKey): boolean {
  if (!poolKey) return false;

  // Check all required fields exist
  if (!poolKey.currency0 || !poolKey.currency1 || !poolKey.hooks) {
    return false;
  }

  // Validate addresses are proper format (0x + 40 hex chars)
  const addressRegex = /^0x[a-fA-F0-9]{40}$/;
  if (!addressRegex.test(poolKey.currency0) || 
      !addressRegex.test(poolKey.currency1) || 
      !addressRegex.test(poolKey.hooks)) {
    return false;
  }

  // Validate fee is a reasonable value (V4 fees are in hundredths of a bip)
  if (poolKey.fee < 0 || poolKey.fee > 1000000) { // Max 100%
    return false;
  }

  // Validate tick spacing is positive and reasonable
  if (poolKey.tickSpacing <= 0 || poolKey.tickSpacing > 32767) {
    return false;
  }

  // Ensure currencies are properly sorted
  const [sorted0, sorted1] = sortCurrencies(poolKey.currency0, poolKey.currency1);
  if (poolKey.currency0 !== sorted0 || poolKey.currency1 !== sorted1) {
    return false;
  }

  return true;
}

/**
 * Compares two PoolKeys for equality.
 * 
 * @param key1 First PoolKey
 * @param key2 Second PoolKey
 * @returns True if PoolKeys are equal
 */
export function poolKeysEqual(key1: PoolKey, key2: PoolKey): boolean {
  if (!key1 || !key2) return false;

  return (
    key1.currency0.toLowerCase() === key2.currency0.toLowerCase() &&
    key1.currency1.toLowerCase() === key2.currency1.toLowerCase() &&
    key1.fee === key2.fee &&
    key1.tickSpacing === key2.tickSpacing &&
    key1.hooks.toLowerCase() === key2.hooks.toLowerCase()
  );
}

/**
 * Creates a PoolKey from v4pools entity data (from the indexer).
 * 
 * @param v4pool Data from the v4pools entity
 * @returns A PoolKey object
 */
export function poolKeyFromV4Pool(v4pool: {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
}): PoolKey {
  return {
    currency0: v4pool.currency0,
    currency1: v4pool.currency1,
    fee: v4pool.fee,
    tickSpacing: v4pool.tickSpacing,
    hooks: v4pool.hooks,
  };
}

/**
 * Common V4 fee tiers (in hundredths of a bip).
 */
export const FEE_TIERS = {
  LOWEST: 100,    // 0.01%
  LOW: 500,       // 0.05%
  MEDIUM: 3000,   // 0.30%
  HIGH: 10000,    // 1.00%
} as const;

/**
 * Common tick spacings for different fee tiers.
 */
export const TICK_SPACINGS = {
  LOWEST: 1,
  LOW: 10,
  MEDIUM: 60,
  HIGH: 200,
} as const;

/**
 * Gets the standard tick spacing for a given fee tier.
 * 
 * @param fee The fee tier
 * @returns The standard tick spacing, or undefined if non-standard
 */
export function getTickSpacingForFee(fee: number): number | undefined {
  switch (fee) {
    case FEE_TIERS.LOWEST:
      return TICK_SPACINGS.LOWEST;
    case FEE_TIERS.LOW:
      return TICK_SPACINGS.LOW;
    case FEE_TIERS.MEDIUM:
      return TICK_SPACINGS.MEDIUM;
    case FEE_TIERS.HIGH:
      return TICK_SPACINGS.HIGH;
    default:
      return undefined;
  }
}