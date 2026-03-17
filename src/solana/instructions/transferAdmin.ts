import type { Address } from '@solana/kit';
import type { Instruction, AccountMeta } from '@solana/kit';
import {
  PROGRAM_ID,
  INSTRUCTION_DISCRIMINATORS,
  ACCOUNT_ROLE_WRITABLE,
  ACCOUNT_ROLE_SIGNER,
} from '../core/constants.js';
import type { TransferAdminArgs } from '../core/types.js';
import {
  transferAdminArgsCodec,
  encodeInstructionData,
} from '../core/codecs.js';

/**
 * Accounts required for transfer_admin instruction
 */
export interface TransferAdminAccounts {
  /** AmmConfig account (writable) */
  config: Address;
  /** Current admin authority (signer, must match config.admin) */
  admin: Address;
}

/**
 * Create a transfer_admin instruction
 *
 * Admin instruction to transfer administrative authority to a new address.
 * The new admin will have full control over the AMM configuration and all pools.
 *
 * CAUTION: This action is irreversible. Ensure the new admin address is correct
 * and that you have access to it before executing.
 *
 * @param accounts - Required accounts for transferring admin
 * @param args - Instruction arguments (newAdmin)
 * @param programId - Program ID (defaults to CPMM program)
 * @returns Instruction to transfer admin
 *
 * @example
 * ```ts
 * const ix = createTransferAdminInstruction(
 *   {
 *     config: configAddress,
 *     admin: currentAdminPublicKey,
 *   },
 *   {
 *     newAdmin: newAdminPublicKey,
 *   }
 * );
 * ```
 */
export function createTransferAdminInstruction(
  accounts: TransferAdminAccounts,
  args: TransferAdminArgs,
  programId: Address = PROGRAM_ID,
): Instruction {
  const { config, admin } = accounts;

  // Build account metas in order expected by the program
  const keys: AccountMeta[] = [
    { address: config, role: ACCOUNT_ROLE_WRITABLE },
    { address: admin, role: ACCOUNT_ROLE_SIGNER },
  ];

  const data = encodeInstructionData(
    INSTRUCTION_DISCRIMINATORS.transferAdmin,
    transferAdminArgsCodec,
    args,
  );

  return {
    programAddress: programId,
    accounts: keys,
    data,
  };
}
