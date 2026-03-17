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

/**
 * Accounts required for skim instruction
 */
export interface SkimAccounts {
  /** AmmConfig account (read-only) */
  config: Address;
  /** Pool account (read-only) */
  pool: Address;
  /** Admin authority (signer, must match config.admin) */
  admin: Address;
  /** Pool authority PDA (read-only, PDA: ['authority', pool]) */
  authority: Address;
  /** Token0 vault (writable) */
  vault0: Address;
  /** Token1 vault (writable) */
  vault1: Address;
  /** Token0 mint (read-only) */
  token0Mint: Address;
  /** Token1 mint (read-only) */
  token1Mint: Address;
  /** Admin's token0 ATA to receive excess (writable) */
  adminAta0: Address;
  /** Admin's token1 ATA to receive excess (writable) */
  adminAta1: Address;
  /** SPL Token program */
  tokenProgram?: Address;
}

/**
 * Create a skim instruction
 *
 * Admin instruction to withdraw excess tokens from pool vaults. This recovers any
 * tokens that were accidentally sent directly to the vault accounts (outside of
 * normal pool operations).
 *
 * Only withdraws tokens in excess of (reserve + unclaimed_fees). Normal pool
 * reserves and LP fees are not affected.
 *
 * @param accounts - Required accounts for skimming
 * @param programId - Program ID (defaults to CPMM program)
 * @returns Instruction to skim excess tokens
 *
 * @example
 * ```ts
 * const ix = createSkimInstruction({
 *   config: configAddress,
 *   pool: poolAddress,
 *   admin: adminPublicKey,
 *   authority: authorityAddress,
 *   vault0: vault0Address,
 *   vault1: vault1Address,
 *   token0Mint: mint0,
 *   token1Mint: mint1,
 *   adminAta0: adminToken0Account,
 *   adminAta1: adminToken1Account,
 * });
 * ```
 */
export function createSkimInstruction(
  accounts: SkimAccounts,
  programId: Address = PROGRAM_ID,
): Instruction {
  const {
    config,
    pool,
    admin,
    authority,
    vault0,
    vault1,
    token0Mint,
    token1Mint,
    adminAta0,
    adminAta1,
    tokenProgram = TOKEN_PROGRAM_ID,
  } = accounts;

  // Build account metas in order expected by the program
  const keys: AccountMeta[] = [
    { address: config, role: ACCOUNT_ROLE_READONLY },
    { address: pool, role: ACCOUNT_ROLE_READONLY },
    { address: admin, role: ACCOUNT_ROLE_SIGNER },
    { address: authority, role: ACCOUNT_ROLE_READONLY },
    { address: vault0, role: ACCOUNT_ROLE_WRITABLE },
    { address: vault1, role: ACCOUNT_ROLE_WRITABLE },
    { address: token0Mint, role: ACCOUNT_ROLE_READONLY },
    { address: token1Mint, role: ACCOUNT_ROLE_READONLY },
    { address: adminAta0, role: ACCOUNT_ROLE_WRITABLE },
    { address: adminAta1, role: ACCOUNT_ROLE_WRITABLE },
    { address: tokenProgram, role: ACCOUNT_ROLE_READONLY },
  ];

  // No args for skim instruction, just the discriminator
  const data = INSTRUCTION_DISCRIMINATORS.skim;

  return {
    programAddress: programId,
    accounts: keys,
    data,
  };
}
