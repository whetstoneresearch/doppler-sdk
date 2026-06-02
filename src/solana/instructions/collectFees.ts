import type { Address, Instruction, TransactionSigner } from '@solana/kit';
import { createNoopSigner } from '@solana/kit';
import { CPMM_PROGRAM_ID, TOKEN_PROGRAM_ADDRESS } from '../core/constants.js';
import type { CollectFeesArgs } from '../core/types.js';
import { getCollectFeesInstruction } from '../generated/cpmm/instructions/collectFees.js';

/**
 * Accounts required for collect_fees instruction
 */
export interface CollectFeesAccounts {
  /** Pool account (writable) */
  pool: Address;
  /** User's position account (writable) */
  position: Address;
  /** Position owner (signer) */
  owner: Address | TransactionSigner;
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
  /** Token0 program; defaults to tokenProgram or classic SPL Token */
  token0Program?: Address;
  /** Token1 program; defaults to tokenProgram or classic SPL Token */
  token1Program?: Address;
  /** Shared SPL Token program fallback */
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
  programId: Address = CPMM_PROGRAM_ID,
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
    token0Program,
    token1Program,
    tokenProgram = TOKEN_PROGRAM_ADDRESS,
  } = accounts;
  const ownerSigner =
    typeof owner === 'string' ? createNoopSigner(owner) : owner;

  return getCollectFeesInstruction(
    {
      pool,
      position,
      owner: ownerSigner,
      authority,
      vault0,
      vault1,
      token0Mint,
      token1Mint,
      user0,
      user1,
      token0Program: token0Program ?? tokenProgram,
      token1Program: token1Program ?? tokenProgram,
      max0: args.max0,
      max1: args.max1,
    },
    { programAddress: programId },
  );
}

/**
 * Convenience constant for collecting all fees (u64::MAX)
 */
export const MAX_FEE_AMOUNT = BigInt('18446744073709551615');
