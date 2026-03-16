import type { Address } from '@solana/kit';
import type { Instruction, AccountMeta } from '@solana/kit';
import {
  PROGRAM_ID,
  INSTRUCTION_DISCRIMINATORS,
  ACCOUNT_ROLE_READONLY,
} from '../core/constants.js';
import type { OracleConsultArgs } from '../core/types.js';
import { oracleConsultArgsCodec, encodeInstructionData } from '../core/codecs.js';
import { getStructCodec, getU128Codec, type Codec } from '@solana/kit';
import type { ReadonlyUint8Array } from '@solana/kit';

/**
 * Accounts required for oracle_consult instruction
 */
export interface OracleConsultAccounts {
  /** Pool account (read-only) */
  pool: Address;
  /** Oracle PDA to query (read-only) */
  oracle: Address;
}

/**
 * Result returned from oracle_consult via return data
 */
export interface OracleConsultResult {
  /** TWAP price of token0 in token1 (Q64.64 fixed-point) */
  price0Q64: bigint;
  /** TWAP price of token1 in token0 (Q64.64 fixed-point) */
  price1Q64: bigint;
}

const oracleConsultResultCodec: Codec<OracleConsultResult> = getStructCodec([
  ['price0Q64', getU128Codec()],
  ['price1Q64', getU128Codec()],
]);

/**
 * Decode oracle_consult return data
 */
export function decodeOracleConsultResult(data: ReadonlyUint8Array): OracleConsultResult {
  return oracleConsultResultCodec.decode(data);
}

/**
 * Create an oracle_consult instruction
 *
 * Queries the TWAP price from the oracle over the specified time window.
 * The result is returned via Solana's return data mechanism.
 *
 * Note: To read the result, you must invoke this instruction via CPI or
 * simulate the transaction and parse the return data.
 *
 * @param accounts - Required accounts for the instruction
 * @param args - Instruction arguments (windowSeconds)
 * @param programId - Program ID (defaults to CPMM program)
 * @returns Instruction to consult the oracle
 *
 * @example
 * ```ts
 * const ix = createOracleConsultInstruction(
 *   {
 *     pool: poolAddress,
 *     oracle: oracleAddress,
 *   },
 *   {
 *     windowSeconds: 300, // 5-minute TWAP
 *   }
 * );
 * ```
 */
export function createOracleConsultInstruction(
  accounts: OracleConsultAccounts,
  args: OracleConsultArgs,
  programId: Address = PROGRAM_ID,
): Instruction {
  const { pool, oracle } = accounts;

  // Build account metas in order expected by the program
  const keys: AccountMeta[] = [
    { address: pool, role: ACCOUNT_ROLE_READONLY },
    { address: oracle, role: ACCOUNT_ROLE_READONLY },
  ];

  const data = encodeInstructionData(
    INSTRUCTION_DISCRIMINATORS.oracleConsult,
    oracleConsultArgsCodec,
    args,
  );

  return {
    programAddress: programId,
    accounts: keys,
    data,
  };
}
