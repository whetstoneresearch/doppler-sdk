import type { Address } from '@solana/kit';
import type { Instruction, AccountMeta } from '@solana/kit';
import type { Codec } from '@solana/kit';
import {
  PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  INSTRUCTION_DISCRIMINATORS,
  ACCOUNT_ROLE_READONLY,
  ACCOUNT_ROLE_WRITABLE,
  ACCOUNT_ROLE_SIGNER,
} from '../core/constants.js';
import type { AddLiquidityArgs } from '../core/types.js';
import { encodeInstructionData } from '../core/codecs.js';
import {
  getStructCodec,
  getU64Codec,
  getU128Codec,
  getBooleanCodec,
} from '@solana/kit';

/**
 * Extended AddLiquidity args that include updateOracle flag
 * (matches the on-chain program's actual args)
 */
export interface AddLiquidityArgsWithOracle extends AddLiquidityArgs {
  /** Whether to update the oracle (requires oracle account) */
  updateOracle: boolean;
}

/**
 * Codec for AddLiquidity args including updateOracle
 */
const addLiquidityArgsWithOracleCodec: Codec<AddLiquidityArgsWithOracle> = getStructCodec([
  ['amount0Max', getU64Codec()],
  ['amount1Max', getU64Codec()],
  ['minSharesOut', getU128Codec()],
  ['updateOracle', getBooleanCodec()],
]);

/**
 * Accounts required for add_liquidity instruction
 */
export interface AddLiquidityAccounts {
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
 * Create an add_liquidity instruction
 *
 * Adds liquidity to a pool by depositing tokens and receiving LP shares.
 * For an empty pool (first deposit), the amount of shares is sqrt(amount0 * amount1).
 * For subsequent deposits, shares are proportional to the smaller ratio of deposit to reserves.
 *
 * @param accounts - Required accounts for adding liquidity
 * @param args - Instruction arguments (amount0Max, amount1Max, minSharesOut, updateOracle)
 * @param programId - Program ID (defaults to CPMM program)
 * @returns Instruction to add liquidity
 *
 * @example
 * ```ts
 * const ix = createAddLiquidityInstruction(
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
 *     amount0Max: 1000000n,
 *     amount1Max: 1000000n,
 *     minSharesOut: 0n,
 *     updateOracle: false,
 *   }
 * );
 * ```
 */
export function createAddLiquidityInstruction(
  accounts: AddLiquidityAccounts,
  args: AddLiquidityArgsWithOracle,
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
    INSTRUCTION_DISCRIMINATORS.addLiquidity,
    addLiquidityArgsWithOracleCodec,
    args,
  );

  return {
    programAddress: programId,
    accounts: keys,
    data,
  };
}
