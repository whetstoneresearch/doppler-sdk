import { describe, expect, it } from 'vitest';
import {
  AccountRole,
  appendTransactionMessageInstructions,
  createTransactionMessage,
  generateKeyPairSigner,
  getTransactionMessageSize,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  type AccountSignerMeta,
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

async function buildLookupTestInstruction(): Promise<Instruction> {
  const signer = await generateKeyPairSigner();
  const writableSigner = await generateKeyPairSigner();

  return {
    programAddress: SYSTEM_PROGRAM_ADDRESS,
    accounts: [
      {
        address: signer.address,
        role: AccountRole.READONLY_SIGNER,
        signer,
      } as AccountSignerMeta,
      {
        address: writableSigner.address,
        role: AccountRole.WRITABLE_SIGNER,
        signer: writableSigner,
      } as AccountSignerMeta,
      { address: SYSTEM_PROGRAM_ADDRESS, role: AccountRole.READONLY },
      { address: SYSTEM_PROGRAM_ADDRESS, role: AccountRole.READONLY },
    ],
    data: new Uint8Array(),
  };
}

describe('address lookup table helpers', () => {
  it('collects deduped non-signer instruction accounts', async () => {
    const instruction = await buildLookupTestInstruction();

    expect(initializer.getInstructionLookupTableAddresses(instruction)).toEqual(
      [SYSTEM_PROGRAM_ADDRESS],
    );
  });

  it('builds create and chunked extend instructions', async () => {
    const payer = await generateKeyPairSigner();
    const addresses = [
      SYSTEM_PROGRAM_ADDRESS,
      'SysvarRent111111111111111111111111111111111' as Address,
      SYSTEM_PROGRAM_ADDRESS,
      'ComputeBudget111111111111111111111111111111' as Address,
    ];

    const setup = await initializer.buildAddressLookupTableSetupInstructions({
      authority: payer,
      payer,
      recentSlot: 123n,
      addresses,
      addressesPerExtendInstruction: 2,
    });

    expect(setup.addresses).toEqual([
      SYSTEM_PROGRAM_ADDRESS,
      'SysvarRent111111111111111111111111111111111',
      'ComputeBudget111111111111111111111111111111',
    ]);
    expect(setup.createInstruction.accounts?.[0].address).toBe(
      setup.lookupTableAddress,
    );
    expect(setup.extendInstructions).toHaveLength(2);
  });

  it('compresses non-signer accounts with a supplied lookup table', async () => {
    const payer = await generateKeyPairSigner();
    const lookupAccounts = await Promise.all(
      Array.from({ length: 8 }, () => generateKeyPairSigner()),
    );
    const accounts = lookupAccounts.map(({ address }) => ({
      address,
      role: AccountRole.READONLY,
    }));
    const instruction: Instruction = {
      programAddress: SYSTEM_PROGRAM_ADDRESS,
      accounts,
      data: new Uint8Array(),
    };
    const message = pipe(
      createTransactionMessage({ version: 0 }),
      (tx) => setTransactionMessageFeePayerSigner(payer, tx),
      (tx) => setTransactionMessageLifetimeUsingBlockhash(DUMMY_BLOCKHASH, tx),
      (tx) => appendTransactionMessageInstructions([instruction], tx),
    );

    const compressed = initializer.compressTransactionMessageWithLookupTable(
      message,
      {
        lookupTableAddress:
          '7r5rdLkGMzTq5Q2kBhkePw4ZTeZEooHgTXktYoamNmVq' as Address,
        addresses: initializer.getInstructionLookupTableAddresses(instruction),
      },
    );

    expect(getTransactionMessageSize(compressed)).toBeLessThan(
      getTransactionMessageSize(message),
    );
  });
});
