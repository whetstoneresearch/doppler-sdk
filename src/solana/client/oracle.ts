/**
 * Oracle fetching and TWAP utility functions for the CPMM SDK
 */

import type { Address } from '@solana/kit';
import type { Rpc, GetAccountInfoApi } from '@solana/kit';
import type { OracleState, TwapResult, Pool } from '../core/types.js';
import { decodeOracleState } from '../core/codecs.js';
import { PROGRAM_ID } from '../core/constants.js';
import { getOracleAddress } from '../core/pda.js';
import { q64ToNumber } from '../core/math.js';

// Browser-compatible base64 decoding
function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Configuration for fetching oracles
 */
export interface FetchOracleConfig {
  /** Program ID (defaults to CPMM program) */
  programId?: Address;
  /** Commitment level */
  commitment?: 'processed' | 'confirmed' | 'finalized';
}

/**
 * Oracle with its address
 */
export interface OracleWithAddress {
  address: Address;
  account: OracleState;
}

/**
 * Fetch and decode an oracle state account
 *
 * @param rpc - Solana RPC client
 * @param address - Oracle account address
 * @param config - Optional configuration
 * @returns Decoded oracle state or null if not found
 *
 * @example
 * ```ts
 * const oracle = await fetchOracle(rpc, oracleAddress);
 * if (oracle) {
 *   console.log(`Oracle initialized: ${oracle.initialized}`);
 *   console.log(`Last update: ${oracle.lastTimestamp}`);
 * }
 * ```
 */
export async function fetchOracle(
  rpc: Rpc<GetAccountInfoApi>,
  address: Address,
  config?: FetchOracleConfig,
): Promise<OracleState | null> {
  const response = await rpc.getAccountInfo(address, {
    encoding: 'base64',
    commitment: config?.commitment,
  }).send();

  if (!response.value) {
    return null;
  }

  return decodeOracleState(base64ToBytes(response.value.data[0]));
}

/**
 * Get the oracle for a specific pool
 *
 * Derives the oracle PDA from the pool address and fetches it.
 *
 * @param rpc - Solana RPC client
 * @param pool - Pool address
 * @param config - Optional configuration
 * @returns Oracle data with address, or null if not found/initialized
 *
 * @example
 * ```ts
 * const result = await getOracleForPool(rpc, poolAddress);
 * if (result) {
 *   console.log(`Oracle at ${result.address}`);
 *   const twap = consultTwap(result.account, 300); // 5-minute TWAP
 *   console.log(`TWAP price: ${twap.price0}`);
 * }
 * ```
 */
export async function getOracleForPool(
  rpc: Rpc<GetAccountInfoApi>,
  pool: Address,
  config?: FetchOracleConfig,
): Promise<OracleWithAddress | null> {
  const programId = config?.programId ?? PROGRAM_ID;
  const [oracleAddress] = await getOracleAddress(pool, programId);

  const oracle = await fetchOracle(rpc, oracleAddress, config);

  if (!oracle) {
    return null;
  }

  return {
    address: oracleAddress,
    account: oracle,
  };
}

/**
 * Get the oracle address for a pool without fetching
 *
 * @param pool - Pool address
 * @param programId - Program ID (defaults to CPMM program)
 * @returns Oracle address
 */
export async function getOracleAddressFromPool(
  pool: Address,
  programId: Address = PROGRAM_ID,
): Promise<Address> {
  const [address] = await getOracleAddress(pool, programId);
  return address;
}

/**
 * Calculate TWAP price from oracle observations
 *
 * Finds the appropriate observations in the circular buffer and computes
 * the time-weighted average price over the specified window.
 *
 * @param oracle - Oracle state data
 * @param windowSeconds - TWAP window in seconds
 * @param currentTimestamp - Optional override for current time (seconds)
 * @returns TWAP prices for both directions, or null if insufficient data
 *
 * @example
 * ```ts
 * const oracle = await fetchOracle(rpc, oracleAddress);
 * if (oracle && oracle.initialized) {
 *   // Get 5-minute TWAP
 *   const twap = consultTwap(oracle, 300);
 *   if (twap) {
 *     console.log(`Token0 price: ${twap.price0} token1 per token0`);
 *     console.log(`Token1 price: ${twap.price1} token0 per token1`);
 *   }
 * }
 * ```
 */
export function consultTwap(
  oracle: OracleState,
  windowSeconds: number,
  currentTimestamp?: number,
): TwapResult | null {
  if (!oracle.initialized || oracle.lastTimestamp === 0) {
    return null;
  }

  const nowTs = Math.max(0, Math.floor(currentTimestamp ?? Date.now() / 1000));
  const dtSinceLast = Math.max(0, nowTs - oracle.lastTimestamp);

  const cum0Now = oracle.price0Cumulative + (oracle.truncPrice0Q64 * BigInt(dtSinceLast));
  const cum1Now = oracle.price1Cumulative + (oracle.truncPrice1Q64 * BigInt(dtSinceLast));

  if (windowSeconds === 0) {
    return {
      price0Q64: oracle.truncPrice0Q64,
      price1Q64: oracle.truncPrice1Q64,
      price0: q64ToNumber(oracle.truncPrice0Q64),
      price1: q64ToNumber(oracle.truncPrice1Q64),
    };
  }

  const targetTs = Math.max(0, nowTs - windowSeconds);
  const sample = selectSample(oracle, targetTs);
  if (!sample) {
    return null;
  }

  const dt = Math.max(0, nowTs - sample.timestamp);
  if (dt === 0) {
    return null;
  }

  const price0Q64 = (cum0Now - sample.price0Cumulative) / BigInt(dt);
  const price1Q64 = (cum1Now - sample.price1Cumulative) / BigInt(dt);

  return {
    price0Q64,
    price1Q64,
    price0: q64ToNumber(price0Q64),
    price1: q64ToNumber(price1Q64),
  };
}

function selectSample(oracle: OracleState, targetTimestamp: number): OracleState['observations'][number] | null {
  let best: OracleState['observations'][number] | null = null;
  const base = {
    timestamp: oracle.lastTimestamp,
    price0Cumulative: oracle.price0Cumulative,
    price1Cumulative: oracle.price1Cumulative,
  };

  if (base.timestamp !== 0 && base.timestamp <= targetTimestamp) {
    best = base;
  }

  for (const obs of oracle.observations) {
    if (obs.timestamp === 0) {
      continue;
    }
    if (obs.timestamp <= targetTimestamp) {
      if (!best || obs.timestamp > best.timestamp) {
        best = obs;
      }
    }
  }

  if (best) {
    return best;
  }

  let oldest: OracleState['observations'][number] | null = base.timestamp !== 0 ? base : null;
  for (const obs of oracle.observations) {
    if (obs.timestamp === 0) {
      continue;
    }
    if (!oldest || obs.timestamp < oldest.timestamp) {
      oldest = obs;
    }
  }

  return oldest;
}

/**
 * Get the current spot prices from oracle
 *
 * Uses the truncated (manipulation-resistant) prices stored in the oracle.
 *
 * @param oracle - Oracle state data
 * @returns Current truncated prices
 */
export function getOracleSpotPrices(oracle: OracleState): {
  price0Q64: bigint;
  price1Q64: bigint;
  price0: number;
  price1: number;
} {
  return {
    price0Q64: oracle.truncPrice0Q64,
    price1Q64: oracle.truncPrice1Q64,
    price0: q64ToNumber(oracle.truncPrice0Q64),
    price1: q64ToNumber(oracle.truncPrice1Q64),
  };
}

/**
 * Get the price deviation metrics from oracle
 *
 * Deviation indicates how much the spot price has moved from the truncated price.
 * High deviation may indicate price manipulation or rapid market movement.
 *
 * @param oracle - Oracle state data
 * @returns Deviation values for both price directions
 */
export function getOracleDeviation(oracle: OracleState): {
  deviation0Q64: bigint;
  deviation1Q64: bigint;
  deviation0: number;
  deviation1: number;
} {
  return {
    deviation0Q64: oracle.deviation0Q64,
    deviation1Q64: oracle.deviation1Q64,
    deviation0: q64ToNumber(oracle.deviation0Q64),
    deviation1: q64ToNumber(oracle.deviation1Q64),
  };
}

/**
 * Calculate the age of the oracle (time since last update)
 *
 * @param oracle - Oracle state data
 * @param currentTimestamp - Current timestamp (defaults to Date.now() / 1000)
 * @returns Age in seconds
 */
export function getOracleAge(
  oracle: OracleState,
  currentTimestamp?: number,
): number {
  const now = currentTimestamp ?? Math.floor(Date.now() / 1000);
  return now - oracle.lastTimestamp;
}

/**
 * Check if oracle is stale (hasn't been updated recently)
 *
 * @param oracle - Oracle state data
 * @param maxAgeSeconds - Maximum acceptable age in seconds
 * @param currentTimestamp - Current timestamp (defaults to Date.now() / 1000)
 * @returns true if oracle is stale
 */
export function isOracleStale(
  oracle: OracleState,
  maxAgeSeconds: number,
  currentTimestamp?: number,
): boolean {
  return getOracleAge(oracle, currentTimestamp) > maxAgeSeconds;
}

/**
 * Get observation buffer statistics
 *
 * @param oracle - Oracle state data
 * @returns Information about the observation buffer
 */
export function getOracleBufferStats(oracle: OracleState): {
  /** Total buffer capacity */
  capacity: number;
  /** Number of observations with data */
  filledCount: number;
  /** Current write index */
  currentIndex: number;
  /** Oldest observation timestamp (0 if not filled) */
  oldestTimestamp: number;
  /** Newest observation timestamp */
  newestTimestamp: number;
  /** Time span covered by observations */
  timeSpanSeconds: number;
} {
  const observations = oracle.observations;
  const capacity = observations.length;
  const currentIndex = oracle.observationIndex;

  let filledCount = 0;
  let oldestTimestamp = 0;
  let newestTimestamp = 0;

  for (let i = 0; i < capacity; i++) {
    const obs = observations[i];
    if (obs.timestamp > 0) {
      filledCount++;
      if (oldestTimestamp === 0 || obs.timestamp < oldestTimestamp) {
        oldestTimestamp = obs.timestamp;
      }
      if (obs.timestamp > newestTimestamp) {
        newestTimestamp = obs.timestamp;
      }
    }
  }

  return {
    capacity,
    filledCount,
    currentIndex,
    oldestTimestamp,
    newestTimestamp,
    timeSpanSeconds: newestTimestamp > oldestTimestamp ? newestTimestamp - oldestTimestamp : 0,
  };
}

/**
 * Batch fetch oracles for multiple pools
 *
 * @param rpc - Solana RPC client
 * @param pools - Array of pool addresses
 * @param config - Optional configuration
 * @returns Map of pool address to oracle (missing oracles not included)
 */
export async function fetchOraclesBatch(
  rpc: Rpc<GetAccountInfoApi>,
  pools: Address[],
  config?: FetchOracleConfig,
): Promise<Map<Address, OracleWithAddress>> {
  const programId = config?.programId ?? PROGRAM_ID;
  const oracles = new Map<Address, OracleWithAddress>();

  // Derive all oracle addresses
  const oracleAddresses = await Promise.all(
    pools.map(pool => getOracleAddress(pool, programId))
  );

  // Fetch all oracles in parallel
  const results = await Promise.all(
    oracleAddresses.map(([addr]) => fetchOracle(rpc, addr, config))
  );

  for (let i = 0; i < pools.length; i++) {
    const oracle = results[i];
    if (oracle) {
      oracles.set(pools[i], {
        address: oracleAddresses[i][0],
        account: oracle,
      });
    }
  }

  return oracles;
}

/**
 * Calculate price from pool reserves and compare with oracle
 *
 * Useful for detecting price discrepancies or manipulation.
 *
 * @param pool - Pool data
 * @param oracle - Oracle data
 * @returns Comparison metrics
 */
export function comparePoolAndOraclePrices(
  pool: Pool,
  oracle: OracleState,
): {
  /** Spot price from pool reserves (token1 per token0) */
  poolPrice0: number;
  /** Truncated price from oracle (token1 per token0) */
  oraclePrice0: number;
  /** Difference as percentage (positive = pool > oracle) */
  divergencePct: number;
} {
  const poolPrice0 = pool.reserve0 > 0n
    ? Number(pool.reserve1) / Number(pool.reserve0)
    : 0;

  const oraclePrice0 = q64ToNumber(oracle.truncPrice0Q64);

  const divergencePct = oraclePrice0 > 0
    ? ((poolPrice0 - oraclePrice0) / oraclePrice0) * 100
    : 0;

  return {
    poolPrice0,
    oraclePrice0,
    divergencePct,
  };
}
