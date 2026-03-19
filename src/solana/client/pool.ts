/**
 * Pool fetching and utility functions for the CPMM SDK
 */

import type { Address } from '@solana/kit';
import type { Rpc, GetAccountInfoApi } from '@solana/kit';
import type { Base64EncodedBytes } from '@solana/kit';
import type { GetProgramAccountsRpc } from '../core/rpc.js';
import type { Pool } from '../core/types.js';
import { decodePool } from '../core/codecs.js';
import { PROGRAM_ID, ACCOUNT_DISCRIMINATORS } from '../core/constants.js';
import { getPoolAddress, sortMints } from '../core/pda.js';

// Browser-compatible base64 encoding/decoding utilities
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Configuration for fetching pools
 */
export interface FetchPoolsConfig {
  /** Program ID (defaults to CPMM program) */
  programId?: Address;
  /** Commitment level */
  commitment?: 'processed' | 'confirmed' | 'finalized';
}

/**
 * Pool with its address
 */
export interface PoolWithAddress {
  address: Address;
  account: Pool;
}

type ProgramAccount = Readonly<{
  pubkey: Address;
  account: Readonly<{ data: [string, 'base64'] }>;
}>;

/**
 * Fetch and decode a single pool account
 *
 * @param rpc - Solana RPC client
 * @param address - Pool account address
 * @param config - Optional configuration
 * @returns Decoded pool data or null if not found
 *
 * @example
 * ```ts
 * const pool = await fetchPool(rpc, poolAddress);
 * if (pool) {
 *   console.log(`Pool reserves: ${pool.reserve0} / ${pool.reserve1}`);
 * }
 * ```
 */
export async function fetchPool(
  rpc: Rpc<GetAccountInfoApi>,
  address: Address,
  config?: FetchPoolsConfig,
): Promise<Pool | null> {
  const response = await rpc
    .getAccountInfo(address, {
      encoding: 'base64',
      commitment: config?.commitment,
    })
    .send();

  if (!response.value) {
    return null;
  }

  return decodePool(base64ToBytes(response.value.data[0]));
}

/**
 * Fetch all pool accounts for the CPMM program
 *
 * Uses getProgramAccounts with a discriminator filter for efficiency.
 *
 * @param rpc - Solana RPC client
 * @param config - Optional configuration
 * @returns Array of pools with their addresses
 *
 * @example
 * ```ts
 * const pools = await fetchAllPools(rpc);
 * console.log(`Found ${pools.length} pools`);
 * for (const { address, account } of pools) {
 *   console.log(`Pool ${address}: ${account.token0Mint} / ${account.token1Mint}`);
 * }
 * ```
 */
export async function fetchAllPools(
  rpc: GetProgramAccountsRpc,
  config?: FetchPoolsConfig,
): Promise<PoolWithAddress[]> {
  const programId = config?.programId ?? PROGRAM_ID;

  // Filter by Pool discriminator (first 8 bytes)
  const discriminatorFilter = {
    memcmp: {
      offset: 0n,
      bytes: bytesToBase64(ACCOUNT_DISCRIMINATORS.Pool) as Base64EncodedBytes,
      encoding: 'base64' as const,
    },
  };

  const response = (await rpc
    .getProgramAccounts(programId, {
      encoding: 'base64',
      commitment: config?.commitment,
      filters: [discriminatorFilter],
    })
    .send()) as unknown;

  const accounts = (
    Array.isArray(response)
      ? response
      : (response as { value: ProgramAccount[] }).value
  ) as ProgramAccount[];

  const pools: PoolWithAddress[] = [];

  for (const account of accounts) {
    try {
      const pool = decodePool(base64ToBytes(account.account.data[0]));
      pools.push({
        address: account.pubkey,
        account: pool,
      });
    } catch {
      // Skip accounts that fail to decode (shouldn't happen with proper filter)
      console.warn(`Failed to decode pool account: ${account.pubkey}`);
    }
  }

  return pools;
}

/**
 * Find a pool by its token pair mints
 *
 * Derives the pool PDA from the mints (automatically sorted) and fetches it.
 *
 * @param rpc - Solana RPC client
 * @param mint0 - First token mint
 * @param mint1 - Second token mint
 * @param config - Optional configuration
 * @returns Pool data with address, or null if not found
 *
 * @example
 * ```ts
 * const result = await getPoolByMints(rpc, usdcMint, wsolMint);
 * if (result) {
 *   console.log(`Found pool at ${result.address}`);
 *   console.log(`Swap fee: ${result.account.swapFeeBps} bps`);
 * }
 * ```
 */
export async function getPoolByMints(
  rpc: Rpc<GetAccountInfoApi>,
  mint0: Address,
  mint1: Address,
  config?: FetchPoolsConfig,
): Promise<PoolWithAddress | null> {
  const programId = config?.programId ?? PROGRAM_ID;

  // Derive pool address (mints are sorted internally)
  const [poolAddress] = await getPoolAddress(mint0, mint1, programId);

  const pool = await fetchPool(rpc, poolAddress, config);

  if (!pool) {
    return null;
  }

  return {
    address: poolAddress,
    account: pool,
  };
}

/**
 * Get multiple pools by their addresses in a single batch request
 *
 * @param rpc - Solana RPC client
 * @param addresses - Array of pool addresses to fetch
 * @param config - Optional configuration
 * @returns Map of address to pool (missing pools are not included)
 *
 * @example
 * ```ts
 * const poolMap = await fetchPoolsBatch(rpc, [pool1, pool2, pool3]);
 * for (const [addr, pool] of poolMap) {
 *   console.log(`Pool ${addr}: TVL = ${pool.reserve0 + pool.reserve1}`);
 * }
 * ```
 */
export async function fetchPoolsBatch(
  rpc: Rpc<GetAccountInfoApi>,
  addresses: Address[],
  config?: FetchPoolsConfig,
): Promise<Map<Address, Pool>> {
  const pools = new Map<Address, Pool>();

  // Fetch all in parallel
  const results = await Promise.all(
    addresses.map((addr) => fetchPool(rpc, addr, config)),
  );

  for (let i = 0; i < addresses.length; i++) {
    const pool = results[i];
    if (pool) {
      pools.set(addresses[i], pool);
    }
  }

  return pools;
}

/**
 * Check if a pool exists for a token pair
 *
 * @param rpc - Solana RPC client
 * @param mint0 - First token mint
 * @param mint1 - Second token mint
 * @param config - Optional configuration
 * @returns true if pool exists, false otherwise
 */
export async function poolExists(
  rpc: Rpc<GetAccountInfoApi>,
  mint0: Address,
  mint1: Address,
  config?: FetchPoolsConfig,
): Promise<boolean> {
  const result = await getPoolByMints(rpc, mint0, mint1, config);
  return result !== null;
}

/**
 * Get the pool address for a token pair without fetching
 *
 * @param mint0 - First token mint
 * @param mint1 - Second token mint
 * @param programId - Program ID (defaults to CPMM program)
 * @returns Pool address and sorted mints
 */
export async function getPoolAddressFromMints(
  mint0: Address,
  mint1: Address,
  programId: Address = PROGRAM_ID,
): Promise<{
  poolAddress: Address;
  token0: Address;
  token1: Address;
}> {
  const [token0, token1] = sortMints(mint0, mint1);
  const [poolAddress] = await getPoolAddress(mint0, mint1, programId);

  return {
    poolAddress,
    token0,
    token1,
  };
}

/**
 * Filter pools by a specific token mint
 *
 * @param pools - Array of pools to filter
 * @param mint - Token mint to filter by
 * @returns Pools that contain the specified mint
 */
export function filterPoolsByMint(
  pools: PoolWithAddress[],
  mint: Address,
): PoolWithAddress[] {
  return pools.filter(
    ({ account }) => account.token0Mint === mint || account.token1Mint === mint,
  );
}

/**
 * Sort pools by total reserves (proxy for TVL)
 *
 * @param pools - Array of pools to sort
 * @param descending - Sort descending (highest first) if true
 * @returns Sorted array (does not mutate input)
 */
export function sortPoolsByReserves(
  pools: PoolWithAddress[],
  descending = true,
): PoolWithAddress[] {
  return [...pools].sort((a, b) => {
    const totalA = a.account.reserve0 + a.account.reserve1;
    const totalB = b.account.reserve0 + b.account.reserve1;
    const cmp = totalA < totalB ? -1 : totalA > totalB ? 1 : 0;
    return descending ? -cmp : cmp;
  });
}
