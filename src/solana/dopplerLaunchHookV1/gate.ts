import {
  getAddressDecoder,
  getAddressEncoder,
  type Address,
  type ReadonlyUint8Array,
} from '@solana/kit';

import {
  GATE_EXPIRY_DISABLED,
  GATE_EXPIRY_HEADER_LEN,
  GATE_EXPIRY_PAYLOAD_LEN,
  GATE_EXPIRY_PAYLOAD_VERSION,
  GATE_EXPIRY_SLOT,
  GATE_EXPIRY_UNIX_TIMESTAMP,
} from './constants.js';

const MAX_U64 = (1n << 64n) - 1n;

export type CosignerGateClock = {
  unixTimestamp?: bigint | number;
  slot?: bigint | number;
};

export type CosignerGateExpiry = {
  mode: number;
  value: bigint;
  cosigner?: Address;
};

export type CosignerGateExpiryArgs =
  | {
      mode: typeof GATE_EXPIRY_DISABLED;
      value: bigint | number;
      cosigner?: never;
    }
  | {
      mode: typeof GATE_EXPIRY_UNIX_TIMESTAMP | typeof GATE_EXPIRY_SLOT;
      value: bigint | number;
      cosigner: Address;
    };

export type CosignerGateStatus = {
  gateEnforced: boolean;
  expiryMode: number;
  expiryValue: bigint;
  reason:
    | 'expiry_disabled'
    | 'timestamp_pending'
    | 'timestamp_expired'
    | 'slot_pending'
    | 'slot_expired'
    | 'slot_unavailable'
    | 'invalid_expiry_payload'
    | 'invalid_expiry_mode';
};

function toBigInt(value: bigint | number): bigint {
  return typeof value === 'bigint' ? value : BigInt(value);
}

function isValidExpiryMode(mode: number): boolean {
  return mode === GATE_EXPIRY_UNIX_TIMESTAMP || mode === GATE_EXPIRY_SLOT;
}

function readU64Le(bytes: ReadonlyUint8Array, offset: number): bigint {
  let value = 0n;
  for (let i = 0; i < 8; i++) {
    value |= BigInt(bytes[offset + i] ?? 0) << BigInt(i * 8);
  }
  return value;
}

function writeU64Le(bytes: Uint8Array, offset: number, value: bigint): void {
  for (let i = 0; i < 8; i++) {
    bytes[offset + i] = Number((value >> BigInt(i * 8)) & 0xffn);
  }
}

export function encodeCosignerGateExpiryPayload(
  expiry: CosignerGateExpiryArgs,
): Uint8Array {
  if (expiry.mode === GATE_EXPIRY_DISABLED) {
    if (expiry.cosigner !== undefined) {
      throw new Error('Cosigner hint cannot be encoded for disabled gates');
    }
    return new Uint8Array();
  }
  if (!isValidExpiryMode(expiry.mode)) {
    throw new Error(`Invalid cosigner gate expiry mode: ${expiry.mode}`);
  }

  const value = toBigInt(expiry.value);
  if (value < 0n || value > MAX_U64) {
    throw new Error(`Invalid cosigner gate expiry value: ${expiry.value}`);
  }
  if (expiry.cosigner === undefined) {
    throw new Error('Cosigner hint is required for expiring gates');
  }

  const payload = new Uint8Array(GATE_EXPIRY_PAYLOAD_LEN);
  payload[0] = GATE_EXPIRY_PAYLOAD_VERSION;
  payload[1] = expiry.mode;
  writeU64Le(payload, 2, value);
  payload.set(
    getAddressEncoder().encode(expiry.cosigner),
    GATE_EXPIRY_HEADER_LEN,
  );
  return payload;
}

export function decodeCosignerGateExpiryPayload(
  payload: ReadonlyUint8Array | null | undefined,
): CosignerGateExpiry | null {
  if (!payload || payload.length === 0) {
    return { mode: GATE_EXPIRY_DISABLED, value: 0n };
  }
  if (
    payload.length !== GATE_EXPIRY_PAYLOAD_LEN ||
    payload[0] !== GATE_EXPIRY_PAYLOAD_VERSION
  ) {
    return null;
  }

  const mode = payload[1] ?? GATE_EXPIRY_DISABLED;
  if (!isValidExpiryMode(mode)) {
    return null;
  }

  return {
    mode,
    value: readU64Le(payload, 2),
    cosigner: getAddressDecoder().decode(
      payload.slice(GATE_EXPIRY_HEADER_LEN, GATE_EXPIRY_PAYLOAD_LEN),
    ),
  };
}

export function getCosignerGateStatus(
  hookPayload: ReadonlyUint8Array | null | undefined,
  clock: CosignerGateClock = {},
): CosignerGateStatus {
  const expiry = decodeCosignerGateExpiryPayload(hookPayload);
  if (!expiry) {
    return {
      gateEnforced: true,
      expiryMode: GATE_EXPIRY_DISABLED,
      expiryValue: 0n,
      reason: 'invalid_expiry_payload',
    };
  }

  if (expiry.mode === GATE_EXPIRY_DISABLED) {
    return {
      gateEnforced: true,
      expiryMode: expiry.mode,
      expiryValue: expiry.value,
      reason: 'expiry_disabled',
    };
  }

  if (expiry.mode === GATE_EXPIRY_UNIX_TIMESTAMP) {
    const unixTimestamp =
      clock.unixTimestamp === undefined
        ? BigInt(Math.floor(Date.now() / 1_000))
        : toBigInt(clock.unixTimestamp);
    const expired = unixTimestamp >= expiry.value;
    return {
      gateEnforced: !expired,
      expiryMode: expiry.mode,
      expiryValue: expiry.value,
      reason: expired ? 'timestamp_expired' : 'timestamp_pending',
    };
  }

  if (expiry.mode === GATE_EXPIRY_SLOT) {
    if (clock.slot === undefined) {
      return {
        gateEnforced: true,
        expiryMode: expiry.mode,
        expiryValue: expiry.value,
        reason: 'slot_unavailable',
      };
    }

    const expired = toBigInt(clock.slot) >= expiry.value;
    return {
      gateEnforced: !expired,
      expiryMode: expiry.mode,
      expiryValue: expiry.value,
      reason: expired ? 'slot_expired' : 'slot_pending',
    };
  }

  return {
    gateEnforced: true,
    expiryMode: expiry.mode,
    expiryValue: expiry.value,
    reason: 'invalid_expiry_mode',
  };
}

export function isCosignerGateEnforced(
  hookPayload: ReadonlyUint8Array | null | undefined,
  clock: CosignerGateClock = {},
): boolean {
  return getCosignerGateStatus(hookPayload, clock).gateEnforced;
}
