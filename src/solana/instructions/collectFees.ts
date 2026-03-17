import type { Address } from '@solana/kit';
import type { Instruction, AccountMeta } from '@solana/kit';
import {
  PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  INSTRUCTION_DISCRIMINATORS,
  ACCOUNT_ROLE_READONLY,
  ACCOUNT_ROLE_WRITABLE,
  ACCOUNT_ROLE_SIGNER,
} from '../core/constants.js';
import type { CollectFeesArgs } from '../core/types.js';
import { collectFeesArgsCodec, encodeInstructionData } from '../core/codecs.js';

/**
 * Accounts required for collect_fees instruction
 */
export interface CollectFeesAccounts {
  /** Pool account (writable) */
  pool: Address;
  /** User's position account (writable) */
  position: Address;
  /** Position owner (signer) */
  owner: Address;
  /** Pool authority PDA (read-only) */
  authority: Address;
  /** Pool vault for token0 (writable) */
  vault0: Address;
  /** Pool vault for token1 (writable) */
  vault1: Address;
  /** Token0 mint (read-only) */
  token0Mint: Address;
  /** Token1 mint (read-only) */
  token1Mint: Address;
  /** User's token0 account (writable) */
  user0: Address;
  /** User's token1 account (writable) */
  user1: Address;
  /** SPL Token program */
  tokenProgram?: Address;
}

/**
 * Create a collect_fees instruction
 *
 * Collects accrued LP fees from a position. Fees are first accrued from the global
 * fee growth, then transferred from the pool vaults to the user's token accounts.
 * You can specify max amounts to partially collect fees.
 *
 * @param accounts - Required accounts for collecting fees
 * @param args - Instruction arguments (max0, max1)
 * @param programId - Program ID (defaults to CPMM program)
 * @returns Instruction to collect fees
 *
 * @example
 * ```ts
 * // Collect all accrued fees
 * const ix = createCollectFeesInstruction(
 *   {
 *     pool: poolAddress,
 *     position: positionAddress,
 *     owner: userPublicKey,
 *     authority: authorityPda,
 *     vault0: vault0Address,
 *     vault1: vault1Address,
 *     token0Mint: mint0,
 *     token1Mint: mint1,
 *     user0: userToken0Account,
 *     user1: userToken1Account,
 *   },
 *   {
 *     max0: BigInt('18446744073709551615'), // u64::MAX to collect all
 *     max1: BigInt('18446744073709551615'),
 *   }
 * );
 * ```
 */
export function createCollectFeesInstruction(
  accounts: CollectFeesAccounts,
  args: CollectFeesArgs,
  programId: Address = PROGRAM_ID,
): Instruction {
  const {
    pool,
    position,
    owner,
    authority,
    vault0,
    vault1,
    token0Mint,
    token1Mint,
    user0,
    user1,
    tokenProgram = TOKEN_PROGRAM_ID,
  } = accounts;

  // Build account metas in order expected by the program
  // Order: pool, position, owner, authority, vault0, vault1,
  //        token0_mint, token1_mint, user0, user1, token_program
  const keys: AccountMeta[] = [
    { address: pool, role: ACCOUNT_ROLE_WRITABLE },
    { address: position, role: ACCOUNT_ROLE_WRITABLE },
    { address: owner, role: ACCOUNT_ROLE_SIGNER },
    { address: authority, role: ACCOUNT_ROLE_READONLY },
    { address: vault0, role: ACCOUNT_ROLE_WRITABLE },
    { address: vault1, role: ACCOUNT_ROLE_WRITABLE },
    { address: token0Mint, role: ACCOUNT_ROLE_READONLY },
    { address: token1Mint, role: ACCOUNT_ROLE_READONLY },
    { address: user0, role: ACCOUNT_ROLE_WRITABLE },
    { address: user1, role: ACCOUNT_ROLE_WRITABLE },
    { address: tokenProgram, role: ACCOUNT_ROLE_READONLY },
  ];

  const data = encodeInstructionData(
    INSTRUCTION_DISCRIMINATORS.collectFees,
    collectFeesArgsCodec,
    args,
  );

  return {
    programAddress: programId,
    accounts: keys,
    data,
  };
}

/**
 * Convenience constant for collecting all fees (u64::MAX)
 */
export const MAX_FEE_AMOUNT = BigInt('18446744073709551615');
