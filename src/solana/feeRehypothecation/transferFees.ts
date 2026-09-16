import { getU64Decoder, type EncodedAccount } from '@solana/kit';
import { getMintDecoder, TOKEN_PROGRAM_ADDRESS } from '@solana-program/token';

import { TOKEN_2022_PROGRAM_ADDRESS } from '../core/constants.js';

export type TransferFee = {
  basisPoints: number;
  maximumFee: bigint;
};

/** Read only TransferFeeConfig; unrelated Token-2022 extensions do not affect raw amounts. */
export function getMintTransferFee(
  mint: EncodedAccount,
  epoch: bigint,
): TransferFee | undefined {
  if (
    mint.programAddress !== TOKEN_PROGRAM_ADDRESS &&
    mint.programAddress !== TOKEN_2022_PROGRAM_ADDRESS
  ) {
    throw new Error('unsupported mint token program');
  }
  if (!getMintDecoder().decode(mint.data).isInitialized) {
    throw new Error('settlement mint is not initialized');
  }
  if (
    mint.programAddress === TOKEN_PROGRAM_ADDRESS ||
    mint.data.length === 82
  ) {
    return undefined;
  }

  // Token-2022 pads the 82-byte mint to 165 bytes, then stores AccountType::Mint (1).
  if (mint.data.length < 166 || mint.data[165] !== 1) {
    throw new Error('invalid Token-2022 mint extension header');
  }
  const bytes = new DataView(
    mint.data.buffer,
    mint.data.byteOffset,
    mint.data.byteLength,
  );
  for (let offset = 166; offset < mint.data.length; ) {
    if (offset + 4 > mint.data.length) {
      // Token-2022 permits zero padding after the last extension.
      if (mint.data.slice(offset).every((byte) => byte === 0)) break;
      throw new Error('truncated Token-2022 mint extension');
    }
    const extensionType = bytes.getUint16(offset, true);
    if (extensionType === 0) break;
    const extensionSize = bytes.getUint16(offset + 2, true);
    offset += 4;
    if (offset + extensionSize > mint.data.length) {
      throw new Error('truncated Token-2022 mint extension');
    }
    if (extensionType === 1) {
      if (extensionSize !== 108)
        throw new Error('invalid TransferFeeConfig size');
      // Two 32-byte authorities and withheld_amount precede the two 18-byte fee schedules.
      const olderFeeOffset = offset + 72;
      const newerFeeOffset = olderFeeOffset + 18;
      const u64 = getU64Decoder();
      const newerEpoch = u64.decode(mint.data, newerFeeOffset);
      const feeOffset = epoch >= newerEpoch ? newerFeeOffset : olderFeeOffset;
      const basisPoints = bytes.getUint16(feeOffset + 16, true);
      if (basisPoints > 10_000)
        throw new Error('invalid transfer fee basis points');
      return { basisPoints, maximumFee: u64.decode(mint.data, feeOffset + 8) };
    }
    offset += extensionSize;
  }
  return undefined;
}

export function netTransferAmount(
  amount: bigint,
  fee: TransferFee | undefined,
): bigint {
  if (amount < 0n || amount > (1n << 64n) - 1n) {
    throw new Error('transfer amount must be between 0 and u64::MAX');
  }
  if (!fee) return amount;
  const proportionalFee = (amount * BigInt(fee.basisPoints) + 9_999n) / 10_000n;
  return (
    amount -
    (proportionalFee < fee.maximumFee ? proportionalFee : fee.maximumFee)
  );
}
