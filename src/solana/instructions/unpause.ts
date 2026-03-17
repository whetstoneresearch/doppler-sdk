import type { Address } from '@solana/kit';
import type { Instruction, AccountMeta } from '@solana/kit';
import {
  PROGRAM_ID,
  INSTRUCTION_DISCRIMINATORS,
  ACCOUNT_ROLE_WRITABLE,
  ACCOUNT_ROLE_SIGNER,
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
  programId: Address = PROGRAM_ID,
): Instruction {
  const { config, admin } = accounts;

  // Build account metas in order expected by the program
  const keys: AccountMeta[] = [
    { address: config, role: ACCOUNT_ROLE_WRITABLE },
    { address: admin, role: ACCOUNT_ROLE_SIGNER },
  ];

  // No args for unpause instruction, just the discriminator
  const data = INSTRUCTION_DISCRIMINATORS.unpause;

  return {
    programAddress: programId,
    accounts: keys,
    data,
  };
}
