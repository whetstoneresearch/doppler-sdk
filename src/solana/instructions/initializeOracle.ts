import type { Address, Instruction, AccountMeta } from '@solana/kit';
import { AccountRole } from '@solana/kit';
import {
  CPMM_PROGRAM_ID,
  SYSTEM_PROGRAM_ADDRESS,
  INSTRUCTION_DISCRIMINATORS,
} from '../core/constants.js';
import type { InitializeOracleArgs } from '../core/types.js';
import {
  initializeOracleArgsCodec,
  encodeInstructionData,
} from '../core/codecs.js';

/**
 * Accounts required for initialize_oracle instruction
 */
export interface InitializeOracleAccounts {
  /** AmmConfig account (read-only) */
  config: Address;
  /** Pool account (read-only) */
  pool: Address;
  /** Oracle PDA to initialize (writable, will be created) */
  oracle: Address;
  /** Admin authority (signer, must match config.admin) */
  admin: Address;
  /** Payer for account creation (signer, writable) */
  payer: Address;
  /** System program */
  systemProgram?: Address;
}

/**
 * Create an initialize_oracle instruction
 *
 * Initializes a TWAP oracle for a pool. The oracle tracks price movements
 * and stores observations for time-weighted average price calculations.
 *
 * @param accounts - Required accounts for the instruction
 * @param args - Instruction arguments (maxPriceChangeRatioQ64, observationIntervalSec, numObservations)
 * @param programId - Program ID (defaults to CPMM program)
 * @returns Instruction to initialize the oracle
 *
 * @example
 * ```ts
 * const ix = createInitializeOracleInstruction(
 *   {
 *     config: configAddress,
 *     pool: poolAddress,
 *     oracle: oracleAddress,
 *     admin: adminPublicKey,
 *     payer: payerPublicKey,
 *   },
 *   {
 *     maxPriceChangeRatioQ64: 1n << 64n, // 100% max change per slot
 *     observationIntervalSec: 60, // 1 minute between observations
 *     numObservations: 64, // Must be MAX_ORACLE_OBSERVATIONS
 *   }
 * );
 * ```
 */
export function createInitializeOracleInstruction(
  accounts: InitializeOracleAccounts,
  args: InitializeOracleArgs,
  programId: Address = CPMM_PROGRAM_ID,
): Instruction {
  const {
    config,
    pool,
    oracle,
    admin,
    payer,
    systemProgram = SYSTEM_PROGRAM_ADDRESS,
  } = accounts;

  // Build account metas in order expected by the program
  const keys: AccountMeta[] = [
    { address: config, role: AccountRole.READONLY },
    { address: pool, role: AccountRole.READONLY },
    { address: oracle, role: AccountRole.WRITABLE },
    { address: admin, role: AccountRole.READONLY_SIGNER },
    { address: payer, role: AccountRole.WRITABLE_SIGNER },
    { address: systemProgram, role: AccountRole.READONLY },
  ];

  const data = encodeInstructionData(
    INSTRUCTION_DISCRIMINATORS.initializeOracle,
    initializeOracleArgsCodec,
    args,
  );

  return {
    programAddress: programId,
    accounts: keys,
    data,
  };
}
