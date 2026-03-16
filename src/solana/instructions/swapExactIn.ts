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
import type { SwapExactInArgs, SwapDirection } from '../core/types.js';
import { encodeInstructionData, swapExactInArgsCodec } from '../core/codecs.js';

/**
 * Accounts required for swap_exact_in instruction
 */
export interface SwapExactInAccounts {
  /** AmmConfig account (read-only) */
  config: Address;
  /** Pool account (writable) */
  pool: Address;
  /** Pool authority PDA (read-only) */
  authority: Address;
  /** Input token vault (writable) */
  vaultIn: Address;
  /** Output token vault (writable) */
  vaultOut: Address;
  /** Token0 mint (read-only, for transfer_checked) */
  token0Mint: Address;
  /** Token1 mint (read-only, for transfer_checked) */
  token1Mint: Address;
  /** User's input token account (writable) */
  userIn: Address;
  /** User's output token account (writable) */
  userOut: Address;
  /** User authority (signer) */
  user: Address;
  /** SPL Token program */
  tokenProgram?: Address;
  /** Oracle account (optional, required if updateOracle is true) */
  oracle?: Address;
  /** Optional remaining accounts (sentinel program/state, route/oracle data) */
  remainingAccounts?: Address[];
}

/**
 * Create a swap_exact_in instruction
 *
 * Swaps an exact input amount for a minimum output amount using the CPMM formula.
 *
 * @param accounts - Required accounts for the swap
 * @param args - Instruction arguments (amountIn, minAmountOut, direction, updateOracle)
 * @param programId - Program ID (defaults to CPMM program)
 * @returns Instruction to execute the swap
 *
 * @example
 * ```ts
 * const ix = createSwapExactInInstruction(
 *   {
 *     config: configAddress,
 *     pool: poolAddress,
 *     authority: authorityAddress,
 *     vaultIn: vault0Address,
 *     vaultOut: vault1Address,
 *     token0Mint: mint0,
 *     token1Mint: mint1,
 *     userIn: userToken0Account,
 *     userOut: userToken1Account,
 *     user: userPublicKey,
 *   },
 *   {
 *     amountIn: 1000000n,
 *     minAmountOut: 990000n,
 *     direction: 0, // token0 -> token1
 *     updateOracle: false,
 *   }
 * );
 * ```
 */
export function createSwapExactInInstruction(
  accounts: SwapExactInAccounts,
  args: SwapExactInArgs,
  programId: Address = PROGRAM_ID,
): Instruction {
  const {
    config,
    pool,
    authority,
    vaultIn,
    vaultOut,
    token0Mint,
    token1Mint,
    userIn,
    userOut,
    user,
    tokenProgram = TOKEN_PROGRAM_ID,
    oracle,
    remainingAccounts = [],
  } = accounts;

  // Build account metas in order expected by the program
  const keys: AccountMeta[] = [
    { address: config, role: ACCOUNT_ROLE_READONLY },
    { address: pool, role: ACCOUNT_ROLE_WRITABLE },
    { address: authority, role: ACCOUNT_ROLE_READONLY },
    { address: vaultIn, role: ACCOUNT_ROLE_WRITABLE },
    { address: vaultOut, role: ACCOUNT_ROLE_WRITABLE },
    { address: token0Mint, role: ACCOUNT_ROLE_READONLY },
    { address: token1Mint, role: ACCOUNT_ROLE_READONLY },
    { address: userIn, role: ACCOUNT_ROLE_WRITABLE },
    { address: userOut, role: ACCOUNT_ROLE_WRITABLE },
    { address: user, role: ACCOUNT_ROLE_SIGNER },
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
    INSTRUCTION_DISCRIMINATORS.swapExactIn,
    swapExactInArgsCodec,
    args,
  );

  return {
    programAddress: programId,
    accounts: keys,
    data,
  };
}

/**
 * Helper to create swap instruction with simplified parameters
 */
export function createSwapInstruction(params: {
  config: Address;
  pool: Address;
  authority: Address;
  vault0: Address;
  vault1: Address;
  token0Mint: Address;
  token1Mint: Address;
  userToken0: Address;
  userToken1: Address;
  user: Address;
  amountIn: bigint;
  minAmountOut: bigint;
  direction: SwapDirection;
  oracle?: Address;
  remainingAccounts?: Address[];
  updateOracle?: boolean;
  programId?: Address;
}): Instruction {
  const {
    config,
    pool,
    authority,
    vault0,
    vault1,
    token0Mint,
    token1Mint,
    userToken0,
    userToken1,
    user,
    amountIn,
    minAmountOut,
    direction,
    oracle,
    remainingAccounts,
    updateOracle = false,
    programId = PROGRAM_ID,
  } = params;

  // Determine vaults and user accounts based on direction
  const [vaultIn, vaultOut] =
    direction === 0 ? [vault0, vault1] : [vault1, vault0];
  const [userIn, userOut] =
    direction === 0 ? [userToken0, userToken1] : [userToken1, userToken0];

  return createSwapExactInInstruction(
    {
      config,
      pool,
      authority,
      vaultIn,
      vaultOut,
      token0Mint,
      token1Mint,
      userIn,
      userOut,
      user,
      oracle,
      remainingAccounts,
    },
    {
      amountIn,
      minAmountOut,
      direction,
      updateOracle,
    },
    programId,
  );
}
