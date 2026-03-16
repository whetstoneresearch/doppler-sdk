import type { Address } from '@solana/kit';
import type { Instruction, AccountMeta } from '@solana/kit';
import {
  PROGRAM_ID,
  SYSTEM_PROGRAM_ID,
  INSTRUCTION_DISCRIMINATORS,
  ACCOUNT_ROLE_READONLY,
  ACCOUNT_ROLE_WRITABLE,
  ACCOUNT_ROLE_SIGNER,
  ACCOUNT_ROLE_WRITABLE_SIGNER,
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
  programId: Address = PROGRAM_ID,
): Instruction {
  const {
    config,
    pool,
    oracle,
    admin,
    payer,
    systemProgram = SYSTEM_PROGRAM_ID,
  } = accounts;

  // Build account metas in order expected by the program
  const keys: AccountMeta[] = [
    { address: config, role: ACCOUNT_ROLE_READONLY },
    { address: pool, role: ACCOUNT_ROLE_READONLY },
    { address: oracle, role: ACCOUNT_ROLE_WRITABLE },
    { address: admin, role: ACCOUNT_ROLE_SIGNER },
    { address: payer, role: ACCOUNT_ROLE_WRITABLE_SIGNER },
    { address: systemProgram, role: ACCOUNT_ROLE_READONLY },
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
