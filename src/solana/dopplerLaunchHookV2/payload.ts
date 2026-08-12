import {
  getAddressDecoder,
  getAddressEncoder,
  type Address,
  type ReadonlyUint8Array,
} from '@solana/kit';

import {
  getAddressFromRemainingAccount,
  type AddressOrTransactionSigner,
  type RemainingAccount,
} from '../core/accounts.js';
import type { DynamicFeeScheduleArgs } from '../dopplerLaunchHookV1/index.js';
import { validateDynamicFeeScheduleArgs } from '../dopplerLaunchHookV1/index.js';
import { computeRemainingAccountsHash } from '../initializer/helpers.js';
import {
  DOPPLER_LAUNCH_HOOK_V2_FEATURE_COSIGN_GATE,
  DOPPLER_LAUNCH_HOOK_V2_FEATURE_DYNAMIC_FEE,
  DOPPLER_LAUNCH_HOOK_V2_FEATURE_FEE_REHYPOTHECATION,
  DOPPLER_LAUNCH_HOOK_V2_FEATURE_MASK,
  DOPPLER_LAUNCH_HOOK_V2_GATE_DISABLED,
  DOPPLER_LAUNCH_HOOK_V2_GATE_SLOT,
  DOPPLER_LAUNCH_HOOK_V2_GATE_UNIX_TIMESTAMP,
  DOPPLER_LAUNCH_HOOK_V2_PAYLOAD_LEN,
  DOPPLER_LAUNCH_HOOK_V2_PAYLOAD_MAGIC,
  DOPPLER_LAUNCH_HOOK_V2_PAYLOAD_VERSION,
} from './constants.js';

const MAX_U64 = (1n << 64n) - 1n;
const ZERO_ADDRESS = '11111111111111111111111111111111' as Address;

export type DopplerLaunchHookV2GateArgs = {
  mode:
    | typeof DOPPLER_LAUNCH_HOOK_V2_GATE_UNIX_TIMESTAMP
    | typeof DOPPLER_LAUNCH_HOOK_V2_GATE_SLOT;
  value: bigint | number;
  cosigner: Address;
};

export type DopplerLaunchHookV2PayloadArgs = {
  dynamicFee?: DynamicFeeScheduleArgs | null;
  cosignerGate?: DopplerLaunchHookV2GateArgs | null;
  feeRehypothecationState?: Address | null;
};

export type DecodedDopplerLaunchHookV2Payload = {
  featureFlags: number;
  dynamicFee: DynamicFeeScheduleArgs | null;
  cosignerGate: DopplerLaunchHookV2GateArgs | null;
  feeRehypothecationState: Address | null;
};

export type DopplerLaunchHookV2RemainingAccounts = {
  signedHookRemainingAccounts: RemainingAccount[];
  unsignedHookRemainingAccounts: Address[];
  hookRemainingAccountsHash: Uint8Array;
};

function toBigInt(value: bigint | number): bigint {
  return typeof value === 'bigint' ? value : BigInt(value);
}

function assertU64(label: string, value: bigint | number): bigint {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) {
    throw new Error(`${label} must be a safe integer or bigint`);
  }
  const parsed = toBigInt(value);
  if (parsed < 0n || parsed > MAX_U64) {
    throw new Error(`${label} must be between 0 and u64::MAX`);
  }
  return parsed;
}

function writeAddress(
  payload: Uint8Array,
  offset: number,
  value: Address,
): void {
  payload.set(getAddressEncoder().encode(value), offset);
}

function readAddress(payload: ReadonlyUint8Array, offset: number): Address {
  return getAddressDecoder().decode(payload.slice(offset, offset + 32));
}

function isZeroFilled(
  payload: ReadonlyUint8Array,
  start: number,
  end: number,
): boolean {
  return payload.slice(start, end).every((byte) => byte === 0);
}

export function encodeDopplerLaunchHookV2Payload(
  args: DopplerLaunchHookV2PayloadArgs = {},
): Uint8Array {
  const payload = new Uint8Array(DOPPLER_LAUNCH_HOOK_V2_PAYLOAD_LEN);
  const view = new DataView(
    payload.buffer,
    payload.byteOffset,
    payload.byteLength,
  );
  let featureFlags = 0;

  payload.set(DOPPLER_LAUNCH_HOOK_V2_PAYLOAD_MAGIC, 0);
  payload[8] = DOPPLER_LAUNCH_HOOK_V2_PAYLOAD_VERSION;

  if (args.dynamicFee) {
    const { startingTime, durationSeconds } = validateDynamicFeeScheduleArgs(
      args.dynamicFee,
    );
    featureFlags |= DOPPLER_LAUNCH_HOOK_V2_FEATURE_DYNAMIC_FEE;
    view.setBigInt64(16, startingTime, true);
    view.setUint16(24, args.dynamicFee.startFeeBps, true);
    view.setUint16(26, args.dynamicFee.endFeeBps, true);
    view.setUint32(28, Number(durationSeconds), true);
  }

  if (args.cosignerGate) {
    if (
      args.cosignerGate.mode !== DOPPLER_LAUNCH_HOOK_V2_GATE_UNIX_TIMESTAMP &&
      args.cosignerGate.mode !== DOPPLER_LAUNCH_HOOK_V2_GATE_SLOT
    ) {
      throw new Error('invalid Doppler launch hook v2 cosigner gate mode');
    }
    const gateValue = assertU64('cosigner gate value', args.cosignerGate.value);
    featureFlags |= DOPPLER_LAUNCH_HOOK_V2_FEATURE_COSIGN_GATE;
    payload[32] = args.cosignerGate.mode;
    view.setBigUint64(40, gateValue, true);
    writeAddress(payload, 48, args.cosignerGate.cosigner);
  }

  if (args.feeRehypothecationState) {
    featureFlags |= DOPPLER_LAUNCH_HOOK_V2_FEATURE_FEE_REHYPOTHECATION;
    writeAddress(payload, 80, args.feeRehypothecationState);
  }

  payload[9] = featureFlags;
  return payload;
}

export function decodeDopplerLaunchHookV2Payload(
  payload: ReadonlyUint8Array,
): DecodedDopplerLaunchHookV2Payload {
  if (
    payload.length !== DOPPLER_LAUNCH_HOOK_V2_PAYLOAD_LEN ||
    !DOPPLER_LAUNCH_HOOK_V2_PAYLOAD_MAGIC.every(
      (byte, index) => payload[index] === byte,
    ) ||
    payload[8] !== DOPPLER_LAUNCH_HOOK_V2_PAYLOAD_VERSION
  ) {
    throw new Error('invalid Doppler launch hook v2 payload');
  }

  const featureFlags = payload[9] ?? 0;
  if (
    (featureFlags & ~DOPPLER_LAUNCH_HOOK_V2_FEATURE_MASK) !== 0 ||
    !isZeroFilled(payload, 10, 16) ||
    !isZeroFilled(payload, 33, 40)
  ) {
    throw new Error('invalid Doppler launch hook v2 payload header');
  }
  const view = new DataView(
    payload.buffer,
    payload.byteOffset,
    payload.byteLength,
  );
  const hasDynamicFee =
    (featureFlags & DOPPLER_LAUNCH_HOOK_V2_FEATURE_DYNAMIC_FEE) !== 0;
  const hasCosignerGate =
    (featureFlags & DOPPLER_LAUNCH_HOOK_V2_FEATURE_COSIGN_GATE) !== 0;
  const hasFeeRehypothecation =
    (featureFlags & DOPPLER_LAUNCH_HOOK_V2_FEATURE_FEE_REHYPOTHECATION) !== 0;

  const dynamicFee = hasDynamicFee
    ? {
        startingTime: view.getBigInt64(16, true),
        startFeeBps: view.getUint16(24, true),
        endFeeBps: view.getUint16(26, true),
        durationSeconds: BigInt(view.getUint32(28, true)),
      }
    : null;
  if (dynamicFee) {
    validateDynamicFeeScheduleArgs(dynamicFee);
  } else if (!isZeroFilled(payload, 16, 32)) {
    throw new Error('invalid disabled Doppler launch hook v2 dynamic fee');
  }

  const gateMode = payload[32] ?? DOPPLER_LAUNCH_HOOK_V2_GATE_DISABLED;
  const gateValue = view.getBigUint64(40, true);
  if (
    hasCosignerGate &&
    gateMode !== DOPPLER_LAUNCH_HOOK_V2_GATE_UNIX_TIMESTAMP &&
    gateMode !== DOPPLER_LAUNCH_HOOK_V2_GATE_SLOT
  ) {
    throw new Error('invalid Doppler launch hook v2 cosigner gate mode');
  }
  const gateCosigner = readAddress(payload, 48);
  if (hasCosignerGate && gateCosigner === ZERO_ADDRESS) {
    throw new Error('invalid Doppler launch hook v2 cosigner');
  }
  const cosignerGate = hasCosignerGate
    ? {
        mode: gateMode as DopplerLaunchHookV2GateArgs['mode'],
        value: gateValue,
        cosigner: gateCosigner,
      }
    : null;
  if (
    !hasCosignerGate &&
    (gateMode !== 0 || gateValue !== 0n || gateCosigner !== ZERO_ADDRESS)
  ) {
    throw new Error('invalid disabled Doppler launch hook v2 cosigner gate');
  }

  const feeRehypothecationState = readAddress(payload, 80);
  if (hasFeeRehypothecation === (feeRehypothecationState === ZERO_ADDRESS)) {
    throw new Error('invalid Doppler launch hook v2 router state');
  }

  return {
    featureFlags,
    dynamicFee,
    cosignerGate,
    feeRehypothecationState: hasFeeRehypothecation
      ? feeRehypothecationState
      : null,
  };
}

export function getDopplerLaunchHookV2RemainingAccounts({
  namespace,
  config,
  feeRehypothecationState,
  settlementSigner,
  cosigner,
}: {
  namespace: Address;
  config: Address;
  feeRehypothecationState?: Address;
  settlementSigner?: Address;
  cosigner?: AddressOrTransactionSigner;
}): DopplerLaunchHookV2RemainingAccounts {
  if (Boolean(feeRehypothecationState) !== Boolean(settlementSigner)) {
    throw new Error(
      'feeRehypothecationState and settlementSigner must be provided together',
    );
  }

  const signedHookRemainingAccounts: RemainingAccount[] = [namespace, config];
  if (feeRehypothecationState && settlementSigner) {
    signedHookRemainingAccounts.push(feeRehypothecationState, settlementSigner);
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
