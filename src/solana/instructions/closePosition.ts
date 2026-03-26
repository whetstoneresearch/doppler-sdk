import type { Address, Instruction, AccountMeta } from '@solana/kit';
import { AccountRole } from '@solana/kit';
import {
  CPMM_PROGRAM_ID,
  INSTRUCTION_DISCRIMINATORS,
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
  programId: Address = CPMM_PROGRAM_ID,
): Instruction {
  const { pool, position, owner, rentRecipient } = accounts;

  // Build account metas in order expected by the program
  // Order: pool, position, owner, rent_recipient
  const keys: AccountMeta[] = [
    { address: pool, role: AccountRole.READONLY },
    { address: position, role: AccountRole.WRITABLE },
    { address: owner, role: AccountRole.READONLY_SIGNER },
    { address: rentRecipient, role: AccountRole.WRITABLE },
  ];

  // closePosition has no args, just the discriminator
  const data = INSTRUCTION_DISCRIMINATORS.closePosition;

  return {
    programAddress: programId,
    accounts: keys,
    data,
  };
}
