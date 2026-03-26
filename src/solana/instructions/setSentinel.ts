import type { Address, Instruction, AccountMeta } from '@solana/kit';
import { AccountRole } from '@solana/kit';
import {
  CPMM_PROGRAM_ID,
  INSTRUCTION_DISCRIMINATORS,
} from '../core/constants.js';
import type { SetSentinelArgs } from '../core/types.js';
import { setSentinelArgsCodec, encodeInstructionData } from '../core/codecs.js';

/**
 * Accounts required for set_sentinel instruction
 */
export interface SetSentinelAccounts {
  /** AmmConfig account (read-only) */
  config: Address;
  /** Pool account (writable) */
  pool: Address;
  /** Admin authority (signer, must match config.admin) */
  admin: Address;
}

/**
 * Create a set_sentinel instruction
 *
 * Admin instruction to configure a sentinel (hook) program on a pool.
 * The sentinel program must be in the config's allowlist (if the allowlist is non-empty).
 * Use Pubkey::default() to disable the sentinel.
 *
 * @param accounts - Required accounts for setting sentinel
 * @param args - Instruction arguments (sentinelProgram, sentinelFlags)
 * @param programId - Program ID (defaults to CPMM program)
 * @returns Instruction to set sentinel
 *
 * @example
 * ```ts
 * import { SF_BEFORE_SWAP, SF_AFTER_SWAP } from '@cpmm/sdk';
 *
 * const ix = createSetSentinelInstruction(
 *   {
 *     config: configAddress,
 *     pool: poolAddress,
 *     admin: adminPublicKey,
 *   },
 *   {
 *     sentinelProgram: sentinelProgramId,
 *     sentinelFlags: SF_BEFORE_SWAP | SF_AFTER_SWAP, // Enable both hooks
 *   }
 * );
 * ```
 */
export function createSetSentinelInstruction(
  accounts: SetSentinelAccounts,
  args: SetSentinelArgs,
  programId: Address = CPMM_PROGRAM_ID,
): Instruction {
  const { config, pool, admin } = accounts;

  // Build account metas in order expected by the program
  const keys: AccountMeta[] = [
    { address: config, role: AccountRole.READONLY },
    { address: pool, role: AccountRole.WRITABLE },
    { address: admin, role: AccountRole.READONLY_SIGNER },
  ];

  const data = encodeInstructionData(
    INSTRUCTION_DISCRIMINATORS.setSentinel,
    setSentinelArgsCodec,
    args,
  );

  return {
    programAddress: programId,
    accounts: keys,
    data,
  };
}
