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
import type { CollectProtocolFeesArgs } from '../core/types.js';
import {
  collectProtocolFeesArgsCodec,
  encodeInstructionData,
} from '../core/codecs.js';

/**
 * Accounts required for collect_protocol_fees instruction
 */
export interface CollectProtocolFeesAccounts {
  /** AmmConfig account (read-only) */
  config: Address;
  /** Pool account (writable) */
  pool: Address;
  /** Protocol position account (writable) */
  protocolPosition: Address;
  /** Admin authority (signer) */
  admin: Address;
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
  /** Recipient token0 account (writable) */
  recipient0: Address;
  /** Recipient token1 account (writable) */
  recipient1: Address;
  /** SPL Token program */
  tokenProgram?: Address;
}

/**
 * Create a collect_protocol_fees instruction
 *
 * Collects accrued protocol fees from the protocol position and transfers them
 * to the configured recipients.
 *
 * @param accounts - Required accounts for collecting protocol fees
 * @param args - Instruction arguments (max0, max1)
 * @param programId - Program ID (defaults to CPMM program)
 * @returns Instruction to collect protocol fees
 *
 * @example
 * ```ts
 * const ix = createCollectProtocolFeesInstruction(
 *   {
 *     config: configAddress,
 *     pool: poolAddress,
 *     protocolPosition: protocolPositionAddress,
 *     admin: adminPublicKey,
 *     authority: authorityPda,
 *     vault0: vault0Address,
 *     vault1: vault1Address,
 *     token0Mint: mint0,
 *     token1Mint: mint1,
 *     recipient0: adminToken0Account,
 *     recipient1: adminToken1Account,
 *   },
 *   {
 *     max0: BigInt('18446744073709551615'),
 *     max1: BigInt('18446744073709551615'),
 *   }
 * );
 * ```
 */
export function createCollectProtocolFeesInstruction(
  accounts: CollectProtocolFeesAccounts,
  args: CollectProtocolFeesArgs,
  programId: Address = PROGRAM_ID,
): Instruction {
  const {
    config,
    pool,
    protocolPosition,
    admin,
    authority,
    vault0,
    vault1,
    token0Mint,
    token1Mint,
    recipient0,
    recipient1,
    tokenProgram = TOKEN_PROGRAM_ID,
  } = accounts;

  // Build account metas in order expected by the program
  const keys: AccountMeta[] = [
    { address: config, role: ACCOUNT_ROLE_READONLY },
    { address: pool, role: ACCOUNT_ROLE_WRITABLE },
    { address: protocolPosition, role: ACCOUNT_ROLE_WRITABLE },
    { address: admin, role: ACCOUNT_ROLE_SIGNER },
    { address: authority, role: ACCOUNT_ROLE_READONLY },
    { address: vault0, role: ACCOUNT_ROLE_WRITABLE },
    { address: vault1, role: ACCOUNT_ROLE_WRITABLE },
    { address: token0Mint, role: ACCOUNT_ROLE_READONLY },
    { address: token1Mint, role: ACCOUNT_ROLE_READONLY },
    { address: recipient0, role: ACCOUNT_ROLE_WRITABLE },
    { address: recipient1, role: ACCOUNT_ROLE_WRITABLE },
    { address: tokenProgram, role: ACCOUNT_ROLE_READONLY },
  ];

  const data = encodeInstructionData(
    INSTRUCTION_DISCRIMINATORS.collectProtocolFees,
    collectProtocolFeesArgsCodec,
    args,
  );

  return {
    programAddress: programId,
    accounts: keys,
    data,
  };
}
