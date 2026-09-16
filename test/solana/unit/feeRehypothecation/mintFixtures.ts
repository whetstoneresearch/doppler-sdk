import { getMintEncoder } from '@solana-program/token';

export type FeeSchedule = {
  epoch: bigint;
  maximumFee: bigint;
  basisPoints: number;
};

export const uncappedFee: FeeSchedule = {
  epoch: 0n,
  maximumFee: (1n << 64n) - 1n,
  basisPoints: 250,
};

export function mintBytes(fees?: {
  older: FeeSchedule;
  newer: FeeSchedule;
}): Uint8Array {
  const mint = getMintEncoder().encode({
    mintAuthority: null,
    supply: 1_000_000n,
    decimals: 8,
    isInitialized: true,
    freezeAuthority: null,
  });
  if (!fees) return Uint8Array.from(mint);
  // SPL Token-2022 TransferFeeConfig TLV: 64 authority bytes, withheld u64, two fee schedules.
  const account = Buffer.alloc(166 + 4 + 108);
  account.set(mint);
  account[165] = 1;
  account.writeUInt16LE(1, 166);
  account.writeUInt16LE(108, 168);
  for (const [index, schedule] of [fees.older, fees.newer].entries()) {
    const offset = 170 + 72 + index * 18;
    account.writeBigUInt64LE(schedule.epoch, offset);
    account.writeBigUInt64LE(schedule.maximumFee, offset + 8);
    account.writeUInt16LE(schedule.basisPoints, offset + 16);
  }
  return account;
}
