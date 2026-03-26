import type { Address, Instruction, AccountMeta } from '@solana/kit';
import { AccountRole } from '@solana/kit';
import {
  CPMM_PROGRAM_ID,
  INSTRUCTION_DISCRIMINATORS,
} from '../core/constants.js';

/**
 * Accounts required for unpause instruction
 */
export interface UnpauseAccounts {
  /** AmmConfig account (writable) */
  config: Address;
  /** Admin authority (signer, must match config.admin) */
  admin: Address;
}

/**
 * Create an unpause instruction
 *
 * Admin instruction to unpause all pool operations. This re-enables
 * swaps, liquidity additions, and liquidity removals after a pause.
 *
 * @param accounts - Required accounts for unpausing
 * @param programId - Program ID (defaults to CPMM program)
 * @returns Instruction to unpause the AMM
 *
 * @example
 * ```ts
 * const ix = createUnpauseInstruction({
 *   config: configAddress,
 *   admin: adminPublicKey,
 * });
 * ```
 */
export function createUnpauseInstruction(
  accounts: UnpauseAccounts,
  programId: Address = CPMM_PROGRAM_ID,
): Instruction {
  const { config, admin } = accounts;

  // Build account metas in order expected by the program
  const keys: AccountMeta[] = [
    { address: config, role: AccountRole.WRITABLE },
    { address: admin, role: AccountRole.READONLY_SIGNER },
  ];

  // No args for unpause instruction, just the discriminator
  const data = INSTRUCTION_DISCRIMINATORS.unpause;

  return {
    programAddress: programId,
    accounts: keys,
    data,
  };
}
