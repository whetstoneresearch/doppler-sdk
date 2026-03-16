import { getAddressCodec, type Address } from '@solana/kit';
import type { Instruction, AccountMeta } from '@solana/kit';
import {
  PROGRAM_ID,
  INSTRUCTION_DISCRIMINATORS,
  ACCOUNT_ROLE_READONLY,
} from '../core/constants.js';
import type { QuoteToNumeraireArgs } from '../core/types.js';
import { quoteToNumeraireArgsCodec, encodeInstructionData } from '../core/codecs.js';
import { getStructCodec, getU128Codec, getU8Codec, type Codec } from '@solana/kit';
import type { ReadonlyUint8Array } from '@solana/kit';

/**
 * Accounts required for quote_to_numeraire instruction
 */
export interface QuoteToNumeraireAccounts {
  /** AmmConfig account (read-only) */
  config: Address;
  /** Starting pool for the route (read-only) */
  startPool: Address;
  /**
   * Remaining accounts for routing:
   * - [pool1?, pool2?, ...]
   *
   * Each hop requires the next pool in the route chain.
   */
  remainingAccounts?: Address[];
}

/**
 * Result returned from quote_to_numeraire via return data
 */
export interface QuoteToNumeraireResult {
  /** Amount converted to numeraire (u128) */
  amountInNumeraire: bigint;
  /** Final mint reached (should be numeraire) */
  endMint: Address;
  /** Number of hops used in the route */
  hopsUsed: number;
}

const quoteToNumeraireResultCodec: Codec<QuoteToNumeraireResult> = getStructCodec([
  ['amountInNumeraire', getU128Codec()],
  ['endMint', getAddressCodec()],
  ['hopsUsed', getU8Codec()],
]);

/**
 * Decode quote_to_numeraire return data
 */
export function decodeQuoteToNumeraireResult(data: ReadonlyUint8Array): QuoteToNumeraireResult {
  return quoteToNumeraireResultCodec.decode(data);
}

/**
 * Create a quote_to_numeraire instruction
 *
 * Converts an amount of one token to its value in the pool's numeraire
 * via the routing chain using spot pricing. (TWAP is not supported in v0.1.)
 *
 * The result is returned via Solana's return data mechanism.
 *
 * @param accounts - Required accounts for the instruction
 * @param args - Instruction arguments (amount, side, maxHops, useTwap, windowSeconds)
 * @param programId - Program ID (defaults to CPMM program)
 * @returns Instruction to quote amount in numeraire
 *
 * @example
 * ```ts
 * // Quote using spot prices (no TWAP)
 * const ix = createQuoteToNumeraireInstruction(
 *   {
 *     config: configAddress,
 *     startPool: poolAddress,
 *   },
 *   {
 *     amount: 1000000n,
 *     side: 0, // token0
 *     maxHops: 3,
 *     useTwap: false,
 *     windowSeconds: 0,
 *   }
 * );
 * ```
 */
export function createQuoteToNumeraireInstruction(
  accounts: QuoteToNumeraireAccounts,
  args: QuoteToNumeraireArgs,
  programId: Address = PROGRAM_ID,
): Instruction {
  const { config, startPool, remainingAccounts = [] } = accounts;

  // Build account metas in order expected by the program
  const keys: AccountMeta[] = [
    { address: config, role: ACCOUNT_ROLE_READONLY },
    { address: startPool, role: ACCOUNT_ROLE_READONLY },
  ];

  // Add remaining accounts (pools and oracles for multi-hop routing)
  for (const account of remainingAccounts) {
    keys.push({ address: account, role: ACCOUNT_ROLE_READONLY });
  }

  const data = encodeInstructionData(
    INSTRUCTION_DISCRIMINATORS.quoteToNumeraire,
    quoteToNumeraireArgsCodec,
    args,
  );

  return {
    programAddress: programId,
    accounts: keys,
    data,
  };
}
