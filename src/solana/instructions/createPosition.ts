import type { Address, Instruction, AccountMeta } from '@solana/kit';
import { AccountRole } from '@solana/kit';
import {
  CPMM_PROGRAM_ID,
  SYSTEM_PROGRAM_ADDRESS,
  INSTRUCTION_DISCRIMINATORS,
} from '../core/constants.js';
import type { CreatePositionArgs } from '../core/types.js';
import {
  createPositionArgsCodec,
  encodeInstructionData,
} from '../core/codecs.js';

/**
 * Accounts required for create_position instruction
 */
export interface CreatePositionAccounts {
  /** Pool account (read-only) */
  pool: Address;
  /** Position PDA to be created (writable, derived from ['position', pool, owner, position_id]) */
  position: Address;
  /** Owner of the position (signer) */
  owner: Address;
  /** Payer for rent (signer, writable) */
  payer: Address;
  /** System program */
  systemProgram?: Address;
}

/**
 * Create a create_position instruction
 *
 * Creates a new liquidity position for a pool. The position is a PDA derived from
 * the pool, owner, and position ID. Users can have multiple positions per pool
 * by using different position IDs.
 *
 * @param accounts - Required accounts for creating the position
 * @param args - Instruction arguments (positionId)
 * @param programId - Program ID (defaults to CPMM program)
 * @returns Instruction to create a new position
 *
 * @example
 * ```ts
 * const ix = createCreatePositionInstruction(
 *   {
 *     pool: poolAddress,
 *     position: positionPda,
 *     owner: userPublicKey,
 *     payer: userPublicKey,
 *   },
 *   {
 *     positionId: 0n,
 *   }
 * );
 * ```
 */
export function createCreatePositionInstruction(
  accounts: CreatePositionAccounts,
  args: CreatePositionArgs,
  programId: Address = CPMM_PROGRAM_ID,
): Instruction {
  const {
    pool,
    position,
    owner,
    payer,
    systemProgram = SYSTEM_PROGRAM_ADDRESS,
  } = accounts;

  // Build account metas in order expected by the program
  // Order: pool, position, owner, payer, system_program
  const keys: AccountMeta[] = [
    { address: pool, role: AccountRole.READONLY },
    { address: position, role: AccountRole.WRITABLE },
    { address: owner, role: AccountRole.READONLY_SIGNER },
    { address: payer, role: AccountRole.WRITABLE_SIGNER },
    { address: systemProgram, role: AccountRole.READONLY },
  ];

  const data = encodeInstructionData(
    INSTRUCTION_DISCRIMINATORS.createPosition,
    createPositionArgsCodec,
    args,
  );

  return {
    programAddress: programId,
    accounts: keys,
    data,
  };
}
