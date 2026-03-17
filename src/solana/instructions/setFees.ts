import type { Address } from '@solana/kit';
import type { Instruction, AccountMeta } from '@solana/kit';
import {
  PROGRAM_ID,
  INSTRUCTION_DISCRIMINATORS,
  ACCOUNT_ROLE_READONLY,
  ACCOUNT_ROLE_WRITABLE,
  ACCOUNT_ROLE_SIGNER,
} from '../core/constants.js';
import type { SetFeesArgs } from '../core/types.js';
import { setFeesArgsCodec, encodeInstructionData } from '../core/codecs.js';

/**
 * Accounts required for set_fees instruction
 */
export interface SetFeesAccounts {
  /** AmmConfig account (read-only) */
  config: Address;
  /** Pool account (writable) */
  pool: Address;
  /** Admin authority (signer, must match config.admin) */
  admin: Address;
}

/**
 * Create a set_fees instruction
 *
 * Admin instruction to update the swap fee and fee split on a pool.
 * Fees will be clamped to the config's max values.
 *
 * @param accounts - Required accounts for setting fees
 * @param args - Instruction arguments (swapFeeBps, feeSplitBps)
 * @param programId - Program ID (defaults to CPMM program)
 * @returns Instruction to set fees
 *
 * @example
 * ```ts
 * const ix = createSetFeesInstruction(
 *   {
 *     config: configAddress,
 *     pool: poolAddress,
 *     admin: adminPublicKey,
 *   },
 *   {
 *     swapFeeBps: 30,    // 0.30% swap fee
 *     feeSplitBps: 5000, // 50% of fees go to LPs (distributable)
 *   }
 * );
 * ```
 */
export function createSetFeesInstruction(
  accounts: SetFeesAccounts,
  args: SetFeesArgs,
  programId: Address = PROGRAM_ID,
): Instruction {
  const { config, pool, admin } = accounts;

  // Build account metas in order expected by the program
  const keys: AccountMeta[] = [
    { address: config, role: ACCOUNT_ROLE_READONLY },
    { address: pool, role: ACCOUNT_ROLE_WRITABLE },
    { address: admin, role: ACCOUNT_ROLE_SIGNER },
  ];

  const data = encodeInstructionData(
    INSTRUCTION_DISCRIMINATORS.setFees,
    setFeesArgsCodec,
    args,
  );

  return {
    programAddress: programId,
    accounts: keys,
    data,
  };
}
