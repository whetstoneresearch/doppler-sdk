import type { Address, Instruction, AccountMeta } from '@solana/kit';
import { AccountRole } from '@solana/kit';
import {
  CPMM_PROGRAM_ID,
  SYSTEM_PROGRAM_ADDRESS,
  INSTRUCTION_DISCRIMINATORS,
} from '../core/constants.js';
import type { InitializeConfigArgs } from '../core/types.js';
import {
  initializeConfigArgsCodec,
  encodeInstructionData,
} from '../core/codecs.js';

/**
 * Accounts required for initialize_config instruction
 */
export interface InitializeConfigAccounts {
  /** AmmConfig account to initialize (writable, PDA: ['config']) */
  config: Address;
  /** Program data account for upgrade authority validation */
  programData: Address;
  /** Payer for account creation (writable, signer) */
  payer: Address;
  /** System program */
  systemProgram?: Address;
}

/**
 * Create an initialize_config instruction
 *
 * Initializes the global AMM configuration singleton. This should only be called once
 * per deployment to set up the admin, fees, and allowlist.
 *
 * @param accounts - Required accounts for initialization
 * @param args - Instruction arguments (admin, fees, allowlist)
 * @param programId - Program ID (defaults to CPMM program)
 * @returns Instruction to initialize the config
 *
 * @example
 * ```ts
 * const [configAddress] = await getConfigAddress();
 * const ix = createInitializeConfigInstruction(
 *   {
 *     config: configAddress,
 *     payer: payerPublicKey,
 *   },
 *   {
 *     admin: adminPublicKey,
 *     maxSwapFeeBps: 100,
 *     maxFeeSplitBps: 5000,
 *     protocolFeeEnabled: true,
 *     protocolFeeBps: 500,
 *     hookAllowlist: [],
 *   }
 * );
 * ```
 */
export function createInitializeConfigInstruction(
  accounts: InitializeConfigAccounts,
  args: InitializeConfigArgs,
  programId: Address = CPMM_PROGRAM_ID,
): Instruction {
  const {
    config,
    programData,
    payer,
    systemProgram = SYSTEM_PROGRAM_ADDRESS,
  } = accounts;

  // Build account metas in order expected by the program
  const keys: AccountMeta[] = [
    { address: config, role: AccountRole.WRITABLE },
    { address: programData, role: AccountRole.READONLY },
    { address: payer, role: AccountRole.WRITABLE_SIGNER },
    { address: systemProgram, role: AccountRole.READONLY },
  ];

  const data = encodeInstructionData(
    INSTRUCTION_DISCRIMINATORS.initializeConfig,
    initializeConfigArgsCodec,
    args,
  );

  return {
    programAddress: programId,
    accounts: keys,
    data,
  };
}
