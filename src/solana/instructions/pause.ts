import type { Address, Instruction, AccountMeta } from '@solana/kit';
import { AccountRole } from '@solana/kit';
import {
  CPMM_PROGRAM_ID,
  INSTRUCTION_DISCRIMINATORS,
} from '../core/constants.js';

/**
 * Accounts required for pause instruction
 */
export interface PauseAccounts {
  /** AmmConfig account (writable) */
  config: Address;
  /** Admin authority (signer, must match config.admin) */
  admin: Address;
}

/**
 * Create a pause instruction
 *
 * Admin instruction to pause all pool operations globally. When paused,
 * swaps, liquidity additions, and liquidity removals will fail.
 *
 * @param accounts - Required accounts for pausing
 * @param programId - Program ID (defaults to CPMM program)
 * @returns Instruction to pause the AMM
 *
 * @example
 * ```ts
 * const ix = createPauseInstruction({
 *   config: configAddress,
 *   admin: adminPublicKey,
 * });
 * ```
 */
export function createPauseInstruction(
  accounts: PauseAccounts,
  programId: Address = CPMM_PROGRAM_ID,
): Instruction {
  const { config, admin } = accounts;

  // Build account metas in order expected by the program
  const keys: AccountMeta[] = [
    { address: config, role: AccountRole.WRITABLE },
    { address: admin, role: AccountRole.READONLY_SIGNER },
  ];

  // No args for pause instruction, just the discriminator
  const data = INSTRUCTION_DISCRIMINATORS.pause;

  return {
    programAddress: programId,
    accounts: keys,
    data,
  };
}
