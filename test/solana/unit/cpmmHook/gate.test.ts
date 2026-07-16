import { describe, expect, it } from 'vitest';
import type { Address } from '@solana/kit';
import { cpmmHook } from '@/solana/index.js';

describe('CPMM hook gate payload helpers', () => {
  const cosigner = 'So11111111111111111111111111111111111111112' as Address;

  it('encodes a per-launch unix timestamp expiry payload with a cosigner hint', () => {
    const payload = cpmmHook.encodeCosignerGateExpiryPayload({
      mode: cpmmHook.GATE_EXPIRY_UNIX_TIMESTAMP,
      value: 300n,
      cosigner,
    });

    expect(payload).toHaveLength(cpmmHook.GATE_EXPIRY_PAYLOAD_LEN);
    expect(cpmmHook.decodeCosignerGateExpiryPayload(payload)).toEqual({
      mode: cpmmHook.GATE_EXPIRY_UNIX_TIMESTAMP,
      value: 300n,
      cosigner,
    });
  });

  it('encodes a per-launch slot expiry payload with a cosigner hint', () => {
    const payload = cpmmHook.encodeCosignerGateExpiryPayload({
      mode: cpmmHook.GATE_EXPIRY_SLOT,
      value: 20n,
      cosigner,
    });

    expect(payload).toHaveLength(cpmmHook.GATE_EXPIRY_PAYLOAD_LEN);
    expect(cpmmHook.decodeCosignerGateExpiryPayload(payload)).toEqual({
      mode: cpmmHook.GATE_EXPIRY_SLOT,
      value: 20n,
      cosigner,
    });
  });

  it('encodes disabled gates as empty payloads', () => {
    expect(
      cpmmHook.encodeCosignerGateExpiryPayload({
        mode: cpmmHook.GATE_EXPIRY_DISABLED,
        value: 0n,
      }),
    ).toHaveLength(0);
  });

  it('reports whether timestamp and slot expiries still enforce the gate', () => {
    const timestampPayload = cpmmHook.encodeCosignerGateExpiryPayload({
      mode: cpmmHook.GATE_EXPIRY_UNIX_TIMESTAMP,
      value: 1_000n,
      cosigner,
    });
    const slotPayload = cpmmHook.encodeCosignerGateExpiryPayload({
      mode: cpmmHook.GATE_EXPIRY_SLOT,
      value: 20n,
      cosigner,
    });

    expect(
      cpmmHook.getCosignerGateStatus(timestampPayload, {
        unixTimestamp: 999n,
      }),
    ).toMatchObject({ gateEnforced: true, reason: 'timestamp_pending' });
    expect(
      cpmmHook.getCosignerGateStatus(timestampPayload, {
        unixTimestamp: 1_000n,
      }),
    ).toMatchObject({ gateEnforced: false, reason: 'timestamp_expired' });
    expect(
      cpmmHook.getCosignerGateStatus(slotPayload, { slot: 19n }),
    ).toMatchObject({ gateEnforced: true, reason: 'slot_pending' });
    expect(
      cpmmHook.getCosignerGateStatus(slotPayload, { slot: 20n }),
    ).toMatchObject({ gateEnforced: false, reason: 'slot_expired' });
  });

  it('keeps the gate enforced for empty or invalid payloads', () => {
    expect(cpmmHook.getCosignerGateStatus(new Uint8Array())).toMatchObject({
      gateEnforced: true,
      reason: 'expiry_disabled',
    });
    expect(
      cpmmHook.getCosignerGateStatus(new Uint8Array([1, 9, 0])),
    ).toMatchObject({
      gateEnforced: true,
      reason: 'invalid_expiry_payload',
    });
    expect(
      cpmmHook.getCosignerGateStatus(
        new Uint8Array([1, 2, 20, 0, 0, 0, 0, 0, 0, 0]),
      ),
    ).toMatchObject({
      gateEnforced: true,
      reason: 'invalid_expiry_payload',
    });
    expect(
      cpmmHook.getCosignerGateStatus(
        cpmmHook.encodeCosignerGateExpiryPayload({
          mode: cpmmHook.GATE_EXPIRY_SLOT,
          value: 20n,
          cosigner,
        }),
      ),
    ).toMatchObject({ gateEnforced: true, reason: 'slot_unavailable' });
  });

  it('rejects invalid expiry args before encoding', () => {
    const encodeUnchecked =
      cpmmHook.encodeCosignerGateExpiryPayload as (expiry: {
        mode: number;
        value: bigint | number;
        cosigner?: Address;
      }) => Uint8Array;

    expect(() => encodeUnchecked({ mode: 99, value: 0n })).toThrow(
      /Invalid cosigner gate expiry mode/,
    );
    expect(() =>
      cpmmHook.encodeCosignerGateExpiryPayload({
        mode: cpmmHook.GATE_EXPIRY_SLOT,
        value: -1n,
        cosigner,
      }),
    ).toThrow(/Invalid cosigner gate expiry value/);
    expect(() =>
      cpmmHook.encodeCosignerGateExpiryPayload({
        mode: cpmmHook.GATE_EXPIRY_SLOT,
        value: 1n << 64n,
        cosigner,
      }),
    ).toThrow(/Invalid cosigner gate expiry value/);
    expect(() =>
      encodeUnchecked({
        mode: cpmmHook.GATE_EXPIRY_SLOT,
        value: 20n,
      }),
    ).toThrow(/Cosigner hint is required/);
    expect(() =>
      encodeUnchecked({
        mode: cpmmHook.GATE_EXPIRY_DISABLED,
        value: 0n,
        cosigner,
      }),
    ).toThrow(/Cosigner hint cannot be encoded/);
  });
});
