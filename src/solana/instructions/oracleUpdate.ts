import type { Address } from '@solana/kit';
import type { Instruction, AccountMeta } from '@solana/kit';
import {
  PROGRAM_ID,
  INSTRUCTION_DISCRIMINATORS,
  ACCOUNT_ROLE_READONLY,
  ACCOUNT_ROLE_WRITABLE,
} from '../core/constants.js';

/**
 * Accounts required for oracle_update instruction
 */
export interface OracleUpdateAccounts {
  /** Pool account (read-only) */
  pool: Address;
  /** Oracle PDA to update (writable) */
  oracle: Address;
}

/**
 * Create an oracle_update instruction
 *
 * Updates the oracle with the current pool prices. This samples the current
 * spot price, clamps it according to maxPriceChangeRatioQ64, and records
 * a new observation if the observation interval has elapsed.
 *
 * This instruction is permissionless - anyone can call it to update the oracle.
 *
 * @param accounts - Required accounts for the instruction
 * @param programId - Program ID (defaults to CPMM program)
 * @returns Instruction to update the oracle
 *
 * @example
 * ```ts
 * const ix = createOracleUpdateInstruction({
 *   pool: poolAddress,
 *   oracle: oracleAddress,
 * });
 * ```
 */
export function createOracleUpdateInstruction(
  accounts: OracleUpdateAccounts,
  programId: Address = PROGRAM_ID,
): Instruction {
  const { pool, oracle } = accounts;

  // Build account metas in order expected by the program
  const keys: AccountMeta[] = [
    { address: pool, role: ACCOUNT_ROLE_READONLY },
    { address: oracle, role: ACCOUNT_ROLE_WRITABLE },
  ];

  // oracle_update has no args, just the discriminator
  const data = INSTRUCTION_DISCRIMINATORS.oracleUpdate;

  return {
    programAddress: programId,
    accounts: keys,
    data,
  };
}
