import { address, lamports, type EncodedAccount } from '@solana/kit';
import { describe, expect, it } from 'vitest';

import {
  TOKEN_PROGRAM_ADDRESS,
  TOKEN_2022_PROGRAM_ADDRESS,
  SYSTEM_PROGRAM_ADDRESS,
} from '@/solana/core/constants.js';
import {
  getMintTransferFee,
  netTransferAmount,
} from '@/solana/feeRehypothecation/transferFees.js';
import { mintBytes, uncappedFee } from './mintFixtures.js';

function mintAccount(
  bytes: Uint8Array,
  programAddress = TOKEN_2022_PROGRAM_ADDRESS,
): EncodedAccount {
  return {
    address: address('So11111111111111111111111111111111111111112'),
    data: bytes,
    programAddress,
    executable: false,
    lamports: lamports(1n),
    space: BigInt(bytes.length),
  };
}

describe('settlement transfer fees', () => {
  it.each([TOKEN_PROGRAM_ADDRESS, TOKEN_2022_PROGRAM_ADDRESS])(
    'accepts an unextended mint owned by %s',
    (program) => {
      expect(
        getMintTransferFee(mintAccount(mintBytes(), program), 0n),
      ).toBeUndefined();
      expect(netTransferAmount(1n, undefined)).toBe(1n);
    },
  );

  it('selects the older schedule before activation and newer schedule at activation', () => {
    const mint = mintAccount(
      mintBytes({
        older: uncappedFee,
        newer: { epoch: 10n, maximumFee: 2n, basisPoints: 500 },
      }),
    );
    expect(getMintTransferFee(mint, 9n)).toEqual({
      basisPoints: 250,
      maximumFee: uncappedFee.maximumFee,
    });
    expect(getMintTransferFee(mint, 10n)).toEqual({
      basisPoints: 500,
      maximumFee: 2n,
    });
    expect(getMintTransferFee(mint, 11n)).toEqual({
      basisPoints: 500,
      maximumFee: 2n,
    });
  });

  it('skips unrelated extensions before TransferFeeConfig', () => {
    const original = mintBytes({ older: uncappedFee, newer: uncappedFee });
    const metadataPointer = Buffer.alloc(68);
    metadataPointer.writeUInt16LE(18, 0);
    metadataPointer.writeUInt16LE(64, 2);
    const extended = Buffer.concat([
      original.slice(0, 166),
      metadataPointer,
      original.slice(166),
    ]);
    expect(getMintTransferFee(mintAccount(extended), 0n)?.basisPoints).toBe(
      250,
    );
    const metadataOnly = Buffer.concat([
      original.slice(0, 166),
      metadataPointer,
      Buffer.alloc(2),
    ]);
    expect(getMintTransferFee(mintAccount(metadataOnly), 0n)).toBeUndefined();
  });

  it.each([
    { amount: 0n, basisPoints: 250, maximumFee: 10n, net: 0n },
    { amount: 1n, basisPoints: 1, maximumFee: 10n, net: 0n },
    { amount: 100n, basisPoints: 250, maximumFee: 10n, net: 97n },
    { amount: 101n, basisPoints: 250, maximumFee: 1n, net: 100n },
    { amount: 101n, basisPoints: 250, maximumFee: 0n, net: 101n },
    { amount: 100n, basisPoints: 0, maximumFee: 10n, net: 100n },
    { amount: 100n, basisPoints: 10000, maximumFee: 100n, net: 0n },
    { amount: 100n, basisPoints: 10000, maximumFee: 1n, net: 99n },
    {
      amount: (1n << 64n) - 1n,
      basisPoints: 10000,
      maximumFee: (1n << 64n) - 1n,
      net: 0n,
    },
    {
      amount: (1n << 64n) - 1n,
      basisPoints: 1,
      maximumFee: 5n,
      net: (1n << 64n) - 6n,
    },
  ])(
    'rounds and caps a $basisPoints bps fee on $amount',
    ({ amount, basisPoints, maximumFee, net }) => {
      expect(netTransferAmount(amount, { basisPoints, maximumFee })).toBe(net);
    },
  );

  it('rejects invalid token programs, headers, truncated extensions, and fee configurations', () => {
    expect(() =>
      getMintTransferFee(mintAccount(mintBytes(), SYSTEM_PROGRAM_ADDRESS), 0n),
    ).toThrow(/unsupported/);
    const extended = mintBytes({ older: uncappedFee, newer: uncappedFee });
    expect(() =>
      getMintTransferFee(mintAccount(extended.slice(0, 100)), 0n),
    ).toThrow(/header/);
    expect(() =>
      getMintTransferFee(mintAccount(extended.slice(0, -1)), 0n),
    ).toThrow(/truncated/);
    const badSize = Buffer.from(extended);
    badSize.writeUInt16LE(107, 168);
    expect(() => getMintTransferFee(mintAccount(badSize), 0n)).toThrow(/size/);
    const invalidFee = mintBytes({
      older: uncappedFee,
      newer: { ...uncappedFee, basisPoints: 10001 },
    });
    expect(() => getMintTransferFee(mintAccount(invalidFee), 0n)).toThrow(
      /basis points/,
    );
    expect(() => netTransferAmount(-1n, undefined)).toThrow(/u64/);
    expect(() => netTransferAmount(1n << 64n, undefined)).toThrow(/u64/);
  });
});
