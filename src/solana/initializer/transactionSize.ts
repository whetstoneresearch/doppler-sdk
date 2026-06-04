import {
  getTransactionMessageSize,
  type Address,
  type TransactionMessage,
  type TransactionMessageWithFeePayer,
} from '@solana/kit';

import { compressTransactionMessageWithLookupTable } from './addressLookupTables.js';

export const SOLANA_TRANSACTION_SIZE_LIMIT = 1232;

export interface TransactionSizeReport {
  size: number;
  limit: number;
  overBy: number;
  fits: boolean;
}

export interface TransactionSizeAssertOptions {
  label?: string;
  metadataBytes?: number;
}

export type SizedTransactionMessage = TransactionMessage &
  TransactionMessageWithFeePayer;

export function measureTransactionMessageSize(
  transactionMessage: SizedTransactionMessage,
): TransactionSizeReport {
  const size = getTransactionMessageSize(transactionMessage);
  const overBy = Math.max(0, size - SOLANA_TRANSACTION_SIZE_LIMIT);

  return {
    size,
    limit: SOLANA_TRANSACTION_SIZE_LIMIT,
    overBy,
    fits: overBy === 0,
  };
}

export function measureTransactionMessageSizeWithLookupTable<
  TTransactionMessage extends Exclude<
    SizedTransactionMessage,
    { version: 'legacy' }
  >,
>(
  transactionMessage: TTransactionMessage,
  lookupTable: {
    lookupTableAddress: Address;
    addresses: readonly Address[];
  },
): TransactionSizeReport {
  return measureTransactionMessageSize(
    compressTransactionMessageWithLookupTable(transactionMessage, lookupTable),
  );
}

export function assertTransactionMessageFits(
  transactionMessage: SizedTransactionMessage,
  { label = 'Transaction', metadataBytes }: TransactionSizeAssertOptions = {},
): TransactionSizeReport {
  const report = measureTransactionMessageSize(transactionMessage);
  if (report.fits) {
    return report;
  }

  const metadataHint =
    metadataBytes && metadataBytes > 0
      ? ` Metadata contributes ${metadataBytes} instruction-data bytes; address lookup tables do not compress metadata strings.`
      : '';

  throw new Error(
    `${label} is ${report.size} bytes, exceeding Solana's ${report.limit}-byte transaction limit by ${report.overBy} bytes.${metadataHint}`,
  );
}

export function assertTransactionMessageFitsWithLookupTable<
  TTransactionMessage extends Exclude<
    SizedTransactionMessage,
    { version: 'legacy' }
  >,
>(
  transactionMessage: TTransactionMessage,
  lookupTable: {
    lookupTableAddress: Address;
    addresses: readonly Address[];
  },
  options: TransactionSizeAssertOptions = {},
): TransactionSizeReport {
  const compressedMessage = compressTransactionMessageWithLookupTable(
    transactionMessage,
    lookupTable,
  );
  return assertTransactionMessageFits(compressedMessage, options);
}
