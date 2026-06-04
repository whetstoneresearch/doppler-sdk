import { describe, expect, it } from 'vitest';
import {
  AccountRole,
  appendTransactionMessageInstructions,
  createTransactionMessage,
  generateKeyPairSigner,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  type Address,
  type Blockhash,
  type Instruction,
} from '@solana/kit';
import { SYSTEM_PROGRAM_ADDRESS } from '@solana-program/system';

import { initializer } from '@/solana/index.js';

const DUMMY_BLOCKHASH = {
  blockhash: '11111111111111111111111111111111' as Blockhash,
  lastValidBlockHeight: 0n,
};

async function buildMessageWithAccounts(accountCount: number) {
  const payer = await generateKeyPairSigner();
  const lookupAccounts = await Promise.all(
    Array.from({ length: accountCount }, () => generateKeyPairSigner()),
  );
  const instruction: Instruction = {
    programAddress: SYSTEM_PROGRAM_ADDRESS,
    accounts: lookupAccounts.map(({ address }) => ({
      address,
      role: AccountRole.READONLY,
    })),
    data: new Uint8Array(),
  };
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayerSigner(payer, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(DUMMY_BLOCKHASH, tx),
    (tx) => appendTransactionMessageInstructions([instruction], tx),
  );

  return {
    instruction,
    message,
  };
}

describe('transaction size helpers', () => {
  it('reports whether a transaction message fits the Solana packet limit', async () => {
    const { message } = await buildMessageWithAccounts(1);

    const report = initializer.measureTransactionMessageSize(message);

    expect(report.limit).toBe(initializer.SOLANA_TRANSACTION_SIZE_LIMIT);
    expect(report.fits).toBe(true);
    expect(report.overBy).toBe(0);
    expect(report.size).toBeGreaterThan(0);
  });

  it('throws before signing when a transaction message is too large', async () => {
    const { message } = await buildMessageWithAccounts(40);

    expect(() =>
      initializer.assertTransactionMessageFits(message, {
        label: 'initialize_launch',
        metadataBytes: 52,
      }),
    ).toThrow(
      /initialize_launch is \d+ bytes, exceeding Solana's 1232-byte transaction limit by \d+ bytes\. Metadata contributes 52 instruction-data bytes/,
    );
  });

  it('measures a message after address lookup table compression', async () => {
    const { instruction, message } = await buildMessageWithAccounts(16);
    const lookupTable = {
      lookupTableAddress:
        '7r5rdLkGMzTq5Q2kBhkePw4ZTeZEooHgTXktYoamNmVq' as Address,
      addresses: initializer.getInstructionLookupTableAddresses(instruction),
    };

    const inlineReport = initializer.measureTransactionMessageSize(message);
    const compressedReport =
      initializer.measureTransactionMessageSizeWithLookupTable(
        message,
        lookupTable,
      );

    expect(compressedReport.size).toBeLessThan(inlineReport.size);
    expect(() =>
      initializer.assertTransactionMessageFitsWithLookupTable(
        message,
        lookupTable,
        { label: 'initialize_launch' },
      ),
    ).not.toThrow();
  });
});
