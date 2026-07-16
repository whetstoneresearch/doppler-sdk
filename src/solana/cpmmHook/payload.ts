import type { Address, ReadonlyUint8Array } from '@solana/kit';

import {
  getAddressFromRemainingAccount,
  type AddressOrTransactionSigner,
  type RemainingAccount,
} from '../core/accounts.js';
import {
  type CosignerGateExpiryArgs,
  encodeCosignerGateExpiryPayload,
} from './gate.js';
import { computeRemainingAccountsHash } from '../initializer/helpers.js';
import {
  DYNAMIC_FEE_SCHEDULE_HEADER_LEN,
  DYNAMIC_FEE_SCHEDULE_LEN,
  DYNAMIC_FEE_SCHEDULE_MAGIC,
  DYNAMIC_FEE_SCHEDULE_MAX_BPS,
  DYNAMIC_FEE_SCHEDULE_VERSION,
  GATE_EXPIRY_DISABLED,
} from './constants.js';

const MAX_I64 = (1n << 63n) - 1n;
const MAX_U32 = (1n << 32n) - 1n;

export type DynamicFeeScheduleArgs = {
  /**
   * Unix timestamp for the schedule start. Use 0 to let the hook normalize the
   * start to the launch creation timestamp during BEFORE_CREATE.
   */
  startingTime: bigint | number;
  startFeeBps: number;
  endFeeBps: number;
  durationSeconds: bigint | number;
};

export type CpmmHookPayloadArgs = {
  schedule?: DynamicFeeScheduleArgs | null;
  gateExpiry?: CosignerGateExpiryArgs | null;
};

export type CpmmHookRemainingAccounts = {
  signedHookRemainingAccounts: RemainingAccount[];
  unsignedHookRemainingAccounts: Address[];
  hookRemainingAccountsHash: Uint8Array;
};

function toBigInt(value: bigint | number): bigint {
  return typeof value === 'bigint' ? value : BigInt(value);
}

function assertU16Bps(label: string, value: number): void {
  if (
    !Number.isInteger(value) ||
    value < 0 ||
    value > DYNAMIC_FEE_SCHEDULE_MAX_BPS
  ) {
    throw new Error(`${label} must be an integer between 0 and 10000`);
  }
}

function writeI64Le(bytes: Uint8Array, offset: number, value: bigint): void {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  view.setBigInt64(offset, value, true);
}

function writeU16Le(bytes: Uint8Array, offset: number, value: number): void {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  view.setUint16(offset, value, true);
}

function writeU32Le(bytes: Uint8Array, offset: number, value: bigint): void {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  view.setUint32(offset, Number(value), true);
}

export function validateDynamicFeeScheduleArgs(
  schedule: DynamicFeeScheduleArgs,
): {
  startingTime: bigint;
  durationSeconds: bigint;
} {
  const startingTime = toBigInt(schedule.startingTime);
  if (startingTime < 0n || startingTime > MAX_I64) {
    throw new Error('startingTime must be between 0 and i64::MAX');
  }
  assertU16Bps('startFeeBps', schedule.startFeeBps);
  assertU16Bps('endFeeBps', schedule.endFeeBps);
  if (schedule.endFeeBps > schedule.startFeeBps) {
    throw new Error('endFeeBps must be less than or equal to startFeeBps');
  }

  const durationSeconds = toBigInt(schedule.durationSeconds);
  if (durationSeconds < 0n || durationSeconds > MAX_U32) {
    throw new Error('durationSeconds must be between 0 and u32::MAX');
  }
  if (schedule.startFeeBps > schedule.endFeeBps && durationSeconds === 0n) {
    throw new Error('durationSeconds must be nonzero for decaying schedules');
  }

  return { startingTime, durationSeconds };
}

export function encodeDynamicFeeSchedule(
  schedule: DynamicFeeScheduleArgs,
): Uint8Array {
  const { startingTime, durationSeconds } =
    validateDynamicFeeScheduleArgs(schedule);
  const payload = new Uint8Array(DYNAMIC_FEE_SCHEDULE_LEN);

  payload.set(DYNAMIC_FEE_SCHEDULE_MAGIC, 0);
  payload[8] = DYNAMIC_FEE_SCHEDULE_VERSION;
  writeI64Le(payload, DYNAMIC_FEE_SCHEDULE_HEADER_LEN, startingTime);
  writeU16Le(payload, 24, schedule.startFeeBps);
  writeU16Le(payload, 26, schedule.endFeeBps);
  writeU32Le(payload, 28, durationSeconds);

  return payload;
}

export function encodeCpmmHookPayload(
  args: CpmmHookPayloadArgs = {},
): Uint8Array {
  const schedulePayload = args.schedule
    ? encodeDynamicFeeSchedule(args.schedule)
    : new Uint8Array();
  const gatePayload = args.gateExpiry
    ? encodeCosignerGateExpiryPayload(args.gateExpiry)
    : new Uint8Array();

  const payload = new Uint8Array(schedulePayload.length + gatePayload.length);
  payload.set(schedulePayload, 0);
  payload.set(gatePayload, schedulePayload.length);
  return payload;
}

export function encodeDynamicFeeCosignerGatePayload(args: {
  value: bigint | number;
  mode: Exclude<CosignerGateExpiryArgs['mode'], typeof GATE_EXPIRY_DISABLED>;
  cosigner: Address;
}): Uint8Array {
  return encodeCosignerGateExpiryPayload(args);
}

export function getCpmmHookRemainingAccounts({
  namespace,
  config,
  cosigner,
}: {
  namespace: Address;
  config?: Address;
  cosigner?: AddressOrTransactionSigner;
}): CpmmHookRemainingAccounts {
  const signedHookRemainingAccounts: RemainingAccount[] = [namespace];
  if (config && config !== namespace) {
    signedHookRemainingAccounts.push(config);
  }
  if (cosigner) {
    signedHookRemainingAccounts.push(cosigner);
  }

  const unsignedHookRemainingAccounts = signedHookRemainingAccounts.map(
    getAddressFromRemainingAccount,
  );

  return {
    signedHookRemainingAccounts,
    unsignedHookRemainingAccounts,
    hookRemainingAccountsHash: computeRemainingAccountsHash(
      unsignedHookRemainingAccounts,
    ),
  };
}

export function getCpmmHookRemainingAccountAddresses({
  namespace,
  config,
  cosigner,
}: {
  namespace: Address;
  config?: Address;
  cosigner?: AddressOrTransactionSigner;
}): Address[] {
  return getCpmmHookRemainingAccounts({
    namespace,
    config,
    cosigner,
  }).unsignedHookRemainingAccounts;
}

export function isDynamicFeeSchedulePayload(
  payload: ReadonlyUint8Array,
): boolean {
  return (
    payload.length >= DYNAMIC_FEE_SCHEDULE_LEN &&
    DYNAMIC_FEE_SCHEDULE_MAGIC.every((byte, index) => payload[index] === byte)
  );
}
