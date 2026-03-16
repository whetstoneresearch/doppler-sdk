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
import type { RemoveLiquidityArgs } from '../core/types.js';
import { removeLiquidityArgsCodec, encodeInstructionData } from '../core/codecs.js';

/**
 * Accounts required for remove_liquidity instruction
 */
export interface RemoveLiquidityAccounts {
  /** AmmConfig account (read-only) */
  config: Address;
  /** Pool account (writable) */
  pool: Address;
  /** User's position account (writable) */
  position: Address;
  /** Protocol position for protocol fees (writable) */
  protocolPosition: Address;
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
  /** Oracle account (optional, required if updateOracle is true) */
  oracle?: Address;
  /** Optional remaining accounts (sentinel program/state, route/oracle data) */
  remainingAccounts?: Address[];
}

/**
 * Create a remove_liquidity instruction
 *
 * Removes liquidity from a pool by burning LP shares and receiving tokens back.
 * The amount of tokens received is proportional to the share of the pool being withdrawn.
 * Also accrues any pending fees to the position before withdrawal.
 *
 * @param accounts - Required accounts for removing liquidity
 * @param args - Instruction arguments (sharesIn, minAmount0Out, minAmount1Out, updateOracle)
 * @param programId - Program ID (defaults to CPMM program)
 * @returns Instruction to remove liquidity
 *
 * @example
 * ```ts
 * const ix = createRemoveLiquidityInstruction(
 *   {
 *     config: configAddress,
 *     pool: poolAddress,
 *     position: positionAddress,
 *     protocolPosition: protocolPositionAddress,
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
 *     sharesIn: 500000n,
 *     minAmount0Out: 450000n,
 *     minAmount1Out: 450000n,
 *     updateOracle: false,
 *   }
 * );
 * ```
 */
export function createRemoveLiquidityInstruction(
  accounts: RemoveLiquidityAccounts,
  args: RemoveLiquidityArgs,
  programId: Address = PROGRAM_ID,
): Instruction {
  const {
    config,
    pool,
    position,
    protocolPosition,
    owner,
    authority,
    vault0,
    vault1,
    token0Mint,
    token1Mint,
    user0,
    user1,
    tokenProgram = TOKEN_PROGRAM_ID,
    oracle,
    remainingAccounts = [],
  } = accounts;

  // Build account metas in order expected by the program
  // Order: config, pool, position, protocol_position, owner, authority,
  //        vault0, vault1, token0_mint, token1_mint, user0, user1, token_program, [oracle]
  const keys: AccountMeta[] = [
    { address: config, role: ACCOUNT_ROLE_READONLY },
    { address: pool, role: ACCOUNT_ROLE_WRITABLE },
    { address: position, role: ACCOUNT_ROLE_WRITABLE },
    { address: protocolPosition, role: ACCOUNT_ROLE_WRITABLE },
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

  // Add oracle if provided (always writable due to Anchor #[account(mut)] constraint)
  if (oracle) {
    keys.push({ address: oracle, role: ACCOUNT_ROLE_WRITABLE });
  }
  for (const account of remainingAccounts) {
    keys.push({ address: account, role: ACCOUNT_ROLE_READONLY });
  }

  const data = encodeInstructionData(
    INSTRUCTION_DISCRIMINATORS.removeLiquidity,
    removeLiquidityArgsCodec,
    args,
  );

  return {
    programAddress: programId,
    accounts: keys,
    data,
  };
}
