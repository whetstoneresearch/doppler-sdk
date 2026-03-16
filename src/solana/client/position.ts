/**
 * Position fetching and utility functions for the CPMM SDK
 */

import type { Address } from '@solana/kit';
import type { Rpc, GetAccountInfoApi } from '@solana/kit';
import type { GetProgramAccountsRpc } from '../core/rpc.js';
import type { Base58EncodedBytes, Base64EncodedBytes } from '@solana/kit';
import type { Position, Pool } from '../core/types.js';
import { decodePosition } from '../core/codecs.js';
import { PROGRAM_ID, ACCOUNT_DISCRIMINATORS } from '../core/constants.js';
import { getPositionAddress } from '../core/pda.js';
import { getPendingFees, ratioToNumber } from '../core/math.js';

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
 * Configuration for fetching positions
 */
export interface FetchPositionsConfig {
  /** Program ID (defaults to CPMM program) */
  programId?: Address;
  /** Commitment level */
  commitment?: 'processed' | 'confirmed' | 'finalized';
}

/**
 * Position with its address
 */
export interface PositionWithAddress {
  address: Address;
  account: Position;
}

type ProgramAccount = Readonly<{
  pubkey: Address;
  account: Readonly<{ data: [string, 'base64'] }>;
}>;

/**
 * Position value in underlying tokens
 */
export interface PositionValue {
  /** Amount of token0 the position is worth */
  amount0: bigint;
  /** Amount of token1 the position is worth */
  amount1: bigint;
  /** Pending uncollected fees in token0 */
  pendingFees0: bigint;
  /** Pending uncollected fees in token1 */
  pendingFees1: bigint;
  /** Total value in token0 (amount0 + pending0) */
  totalValue0: bigint;
  /** Total value in token1 (amount1 + pending1) */
  totalValue1: bigint;
  /** Share of pool as a decimal (0-1) */
  poolShare: number;
}

/**
 * Fetch and decode a single position account
 *
 * @param rpc - Solana RPC client
 * @param address - Position account address
 * @param config - Optional configuration
 * @returns Decoded position data or null if not found
 *
 * @example
 * ```ts
 * const position = await fetchPosition(rpc, positionAddress);
 * if (position) {
 *   console.log(`Position shares: ${position.shares}`);
 * }
 * ```
 */
export async function fetchPosition(
  rpc: Rpc<GetAccountInfoApi>,
  address: Address,
  config?: FetchPositionsConfig,
): Promise<Position | null> {
  const response = await rpc.getAccountInfo(address, {
    encoding: 'base64',
    commitment: config?.commitment,
  }).send();

  if (!response.value) {
    return null;
  }

  return decodePosition(base64ToBytes(response.value.data[0]));
}

/**
 * Fetch all positions for a specific owner
 *
 * @param rpc - Solana RPC client
 * @param owner - Owner address
 * @param pool - Optional pool address to filter by
 * @param config - Optional configuration
 * @returns Array of positions with their addresses
 *
 * @example
 * ```ts
 * // Get all positions for a user
 * const allPositions = await fetchUserPositions(rpc, userWallet);
 *
 * // Get positions for a specific pool
 * const poolPositions = await fetchUserPositions(rpc, userWallet, poolAddress);
 * ```
 */
export async function fetchUserPositions(
  rpc: GetProgramAccountsRpc,
  owner: Address,
  pool?: Address,
  config?: FetchPositionsConfig,
): Promise<PositionWithAddress[]> {
  const programId = config?.programId ?? PROGRAM_ID;

  // Build filters
  const filters = [
    // Discriminator filter (first 8 bytes)
    {
      memcmp: {
        offset: 0n,
        bytes: bytesToBase64(ACCOUNT_DISCRIMINATORS.Position) as Base64EncodedBytes,
        encoding: 'base64' as const,
      },
    },
    // Owner filter (after 8-byte discriminator + 32-byte pool = offset 40)
    {
      memcmp: {
        offset: 40n,
        bytes: owner as unknown as Base58EncodedBytes,
        encoding: 'base58' as const,
      },
    },
  ];

  // Add pool filter if specified (after 8-byte discriminator = offset 8)
  if (pool) {
    filters.push({
      memcmp: {
        offset: 8n,
        bytes: pool as unknown as Base58EncodedBytes,
        encoding: 'base58' as const,
      },
    });
  }

  const response = await rpc.getProgramAccounts(programId, {
    encoding: 'base64',
    commitment: config?.commitment,
    filters,
  }).send() as unknown;

  const accounts = (Array.isArray(response)
    ? response
    : (response as { value: ProgramAccount[] }).value) as ProgramAccount[];

  const positions: PositionWithAddress[] = [];

  for (const account of accounts) {
    try {
      const position = decodePosition(base64ToBytes(account.account.data[0]));
      positions.push({
        address: account.pubkey,
        account: position,
      });
    } catch {
      console.warn(`Failed to decode position account: ${account.pubkey}`);
    }
  }

  return positions;
}

/**
 * Fetch all positions for a specific pool
 *
 * @param rpc - Solana RPC client
 * @param pool - Pool address
 * @param config - Optional configuration
 * @returns Array of positions with their addresses
 */
export async function fetchPoolPositions(
  rpc: GetProgramAccountsRpc,
  pool: Address,
  config?: FetchPositionsConfig,
): Promise<PositionWithAddress[]> {
  const programId = config?.programId ?? PROGRAM_ID;

  const filters = [
    // Discriminator filter
    {
      memcmp: {
        offset: 0n,
        bytes: bytesToBase64(ACCOUNT_DISCRIMINATORS.Position) as Base64EncodedBytes,
        encoding: 'base64' as const,
      },
    },
    // Pool filter (after 8-byte discriminator = offset 8)
    {
      memcmp: {
        offset: 8n,
        bytes: pool as unknown as Base58EncodedBytes,
        encoding: 'base58' as const,
      },
    },
  ];

  const response = await rpc.getProgramAccounts(programId, {
    encoding: 'base64',
    commitment: config?.commitment,
    filters,
  }).send() as unknown;

  const accounts = (Array.isArray(response)
    ? response
    : (response as { value: ProgramAccount[] }).value) as ProgramAccount[];

  const positions: PositionWithAddress[] = [];

  for (const account of accounts) {
    try {
      const position = decodePosition(base64ToBytes(account.account.data[0]));
      positions.push({
        address: account.pubkey,
        account: position,
      });
    } catch {
      console.warn(`Failed to decode position account: ${account.pubkey}`);
    }
  }

  return positions;
}

/**
 * Calculate the value of a position in underlying tokens
 *
 * @param pool - Pool data
 * @param position - Position data
 * @returns Position value breakdown
 *
 * @example
 * ```ts
 * const pool = await fetchPool(rpc, poolAddress);
 * const position = await fetchPosition(rpc, positionAddress);
 *
 * if (pool && position) {
 *   const value = getPositionValue(pool, position);
 *   console.log(`Position worth ${value.amount0} token0 + ${value.amount1} token1`);
 *   console.log(`Pool share: ${(value.poolShare * 100).toFixed(2)}%`);
 * }
 * ```
 */
export function getPositionValue(pool: Pool, position: Position): PositionValue {
  if (pool.totalShares === 0n) {
    return {
      amount0: 0n,
      amount1: 0n,
      pendingFees0: 0n,
      pendingFees1: 0n,
      totalValue0: 0n,
      totalValue1: 0n,
      poolShare: 0,
    };
  }

  // Calculate underlying token amounts
  const amount0 = (position.shares * pool.reserve0) / pool.totalShares;
  const amount1 = (position.shares * pool.reserve1) / pool.totalShares;

  // Calculate pending fees
  const { pending0, pending1 } = getPendingFees(pool, position);

  // Calculate pool share
  const poolShare = ratioToNumber(position.shares, pool.totalShares);

  return {
    amount0,
    amount1,
    pendingFees0: pending0,
    pendingFees1: pending1,
    totalValue0: amount0 + pending0,
    totalValue1: amount1 + pending1,
    poolShare,
  };
}

/**
 * Derive and fetch a position by its deterministic parameters
 *
 * @param rpc - Solana RPC client
 * @param pool - Pool address
 * @param owner - Position owner
 * @param positionId - Position ID
 * @param config - Optional configuration
 * @returns Position with address or null if not found
 */
export async function fetchPositionByParams(
  rpc: Rpc<GetAccountInfoApi>,
  pool: Address,
  owner: Address,
  positionId: bigint,
  config?: FetchPositionsConfig,
): Promise<PositionWithAddress | null> {
  const programId = config?.programId ?? PROGRAM_ID;
  const [address] = await getPositionAddress(pool, owner, positionId, programId);

  const position = await fetchPosition(rpc, address, config);

  if (!position) {
    return null;
  }

  return {
    address,
    account: position,
  };
}

/**
 * Get the position address for given parameters without fetching
 *
 * @param pool - Pool address
 * @param owner - Position owner
 * @param positionId - Position ID
 * @param programId - Program ID (defaults to CPMM program)
 * @returns Position address
 */
export async function getPositionAddressFromParams(
  pool: Address,
  owner: Address,
  positionId: bigint,
  programId: Address = PROGRAM_ID,
): Promise<Address> {
  const [address] = await getPositionAddress(pool, owner, positionId, programId);
  return address;
}

/**
 * Batch fetch multiple positions
 *
 * @param rpc - Solana RPC client
 * @param addresses - Array of position addresses to fetch
 * @param config - Optional configuration
 * @returns Map of address to position (missing positions are not included)
 */
export async function fetchPositionsBatch(
  rpc: Rpc<GetAccountInfoApi>,
  addresses: Address[],
  config?: FetchPositionsConfig,
): Promise<Map<Address, Position>> {
  const positions = new Map<Address, Position>();

  const results = await Promise.all(
    addresses.map(addr => fetchPosition(rpc, addr, config))
  );

  for (let i = 0; i < addresses.length; i++) {
    const position = results[i];
    if (position) {
      positions.set(addresses[i], position);
    }
  }

  return positions;
}

/**
 * Filter positions with non-zero shares
 *
 * @param positions - Array of positions to filter
 * @returns Positions with shares > 0
 */
export function filterActivePositions(
  positions: PositionWithAddress[],
): PositionWithAddress[] {
  return positions.filter(({ account }) => account.shares > 0n);
}

/**
 * Sort positions by share amount
 *
 * @param positions - Array of positions to sort
 * @param descending - Sort descending (largest first) if true
 * @returns Sorted array (does not mutate input)
 */
export function sortPositionsByShares(
  positions: PositionWithAddress[],
  descending = true,
): PositionWithAddress[] {
  return [...positions].sort((a, b) => {
    const cmp = a.account.shares < b.account.shares ? -1 : a.account.shares > b.account.shares ? 1 : 0;
    return descending ? -cmp : cmp;
  });
}
