import type { Address } from '@solana/kit';
import type { Instruction, AccountMeta } from '@solana/kit';
import {
  PROGRAM_ID,
  INSTRUCTION_DISCRIMINATORS,
  ACCOUNT_ROLE_READONLY,
  ACCOUNT_ROLE_WRITABLE,
  ACCOUNT_ROLE_SIGNER,
} from '../core/constants.js';
import type { SetRouteArgs } from '../core/types.js';
import { setRouteArgsCodec, encodeInstructionData } from '../core/codecs.js';

/**
 * Accounts required for set_route instruction
 */
export interface SetRouteAccounts {
  /** AmmConfig account (read-only) */
  config: Address;
  /** Pool account (writable) */
  pool: Address;
  /** Next pool in routing chain (optional, required if setting a route) */
  nextPool?: Address;
  /** Admin authority (signer, must match config.admin) */
  admin: Address;
}

/**
 * Create a set_route instruction
 *
 * Admin instruction to configure routing for a pool. This allows multi-hop swaps
 * through a chain of pools. The bridge mint must exist in both the current pool
 * and the next pool.
 *
 * To clear routing, pass Pubkey::default() for both routeNextPool and routeBridgeMint.
 *
 * @param accounts - Required accounts for setting route
 * @param args - Instruction arguments (routeNextPool, routeBridgeMint)
 * @param programId - Program ID (defaults to CPMM program)
 * @returns Instruction to set route
 *
 * @example
 * ```ts
 * // Set up routing: Pool A -> Pool B via USDC
 * const ix = createSetRouteInstruction(
 *   {
 *     config: configAddress,
 *     pool: poolAAddress,
 *     nextPool: poolBAddress,
 *     admin: adminPublicKey,
 *   },
 *   {
 *     routeNextPool: poolBAddress,
 *     routeBridgeMint: usdcMint, // Must be in both pools
 *   }
 * );
 *
 * // Clear routing
 * const clearIx = createSetRouteInstruction(
 *   {
 *     config: configAddress,
 *     pool: poolAddress,
 *     admin: adminPublicKey,
 *   },
 *   {
 *     routeNextPool: address('11111111111111111111111111111111'),
 *     routeBridgeMint: address('11111111111111111111111111111111'),
 *   }
 * );
 * ```
 */
export function createSetRouteInstruction(
  accounts: SetRouteAccounts,
  args: SetRouteArgs,
  programId: Address = PROGRAM_ID,
): Instruction {
  const { config, pool, nextPool, admin } = accounts;

  // Build account metas in order expected by the program
  const keys: AccountMeta[] = [
    { address: config, role: ACCOUNT_ROLE_READONLY },
    { address: pool, role: ACCOUNT_ROLE_WRITABLE },
  ];

  // Add next_pool if provided (optional account)
  if (nextPool) {
    keys.push({ address: nextPool, role: ACCOUNT_ROLE_READONLY });
  }

  keys.push({ address: admin, role: ACCOUNT_ROLE_SIGNER });

  const data = encodeInstructionData(
    INSTRUCTION_DISCRIMINATORS.setRoute,
    setRouteArgsCodec,
    args,
  );

  return {
    programAddress: programId,
    accounts: keys,
    data,
  };
}
