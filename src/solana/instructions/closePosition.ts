import type { Address } from '@solana/kit';
import type { Instruction, AccountMeta } from '@solana/kit';
import {
  PROGRAM_ID,
  INSTRUCTION_DISCRIMINATORS,
  ACCOUNT_ROLE_READONLY,
  ACCOUNT_ROLE_WRITABLE,
  ACCOUNT_ROLE_SIGNER,
} from '../core/constants.js';

/**
 * Accounts required for close_position instruction
 */
export interface ClosePositionAccounts {
  /** Pool account (read-only) */
  pool: Address;
  /** Position account to close (writable) */
  position: Address;
  /** Position owner (signer) */
  owner: Address;
  /** Recipient for rent lamports (writable) */
  rentRecipient: Address;
}

/**
 * Create a close_position instruction
 *
 * Closes an empty position account, returning the rent lamports to the recipient.
 * The position must have zero shares and zero accrued fees to be closed.
 *
 * @param accounts - Required accounts for closing the position
 * @param programId - Program ID (defaults to CPMM program)
 * @returns Instruction to close a position
 *
 * @example
 * ```ts
 * const ix = createClosePositionInstruction({
 *   pool: poolAddress,
 *   position: positionAddress,
 *   owner: userPublicKey,
 *   rentRecipient: userPublicKey,
 * });
 * ```
 */
export function createClosePositionInstruction(
  accounts: ClosePositionAccounts,
  programId: Address = PROGRAM_ID,
): Instruction {
  const { pool, position, owner, rentRecipient } = accounts;

  // Build account metas in order expected by the program
  // Order: pool, position, owner, rent_recipient
  const keys: AccountMeta[] = [
    { address: pool, role: ACCOUNT_ROLE_READONLY },
    { address: position, role: ACCOUNT_ROLE_WRITABLE },
    { address: owner, role: ACCOUNT_ROLE_SIGNER },
    { address: rentRecipient, role: ACCOUNT_ROLE_WRITABLE },
  ];

  // closePosition has no args, just the discriminator
  const data = INSTRUCTION_DISCRIMINATORS.closePosition;

  return {
    programAddress: programId,
    accounts: keys,
    data,
  };
}
