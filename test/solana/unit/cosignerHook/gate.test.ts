import { describe, expect, it } from 'vitest';
import type { Address } from '@solana/kit';
import { cosignerHook } from '@/solana/index.js';

describe('cosignerHook gate payload helpers', () => {
  const cosigner = 'So11111111111111111111111111111111111111112' as Address;

  it('encodes a per-launch unix timestamp expiry payload with a cosigner hint', () => {
    const payload = cosignerHook.encodeCosignerGateExpiryPayload({
      mode: cosignerHook.GATE_EXPIRY_UNIX_TIMESTAMP,
      value: 300n,
      cosigner,
    });

    expect(payload).toHaveLength(cosignerHook.GATE_EXPIRY_PAYLOAD_LEN);
    expect(cosignerHook.decodeCosignerGateExpiryPayload(payload)).toEqual({
      mode: cosignerHook.GATE_EXPIRY_UNIX_TIMESTAMP,
      value: 300n,
      cosigner,
    });
  });

  it('encodes a per-launch slot expiry payload with a cosigner hint', () => {
    const payload = cosignerHook.encodeCosignerGateExpiryPayload({
      mode: cosignerHook.GATE_EXPIRY_SLOT,
      value: 20n,
      cosigner,
    });

    expect(payload).toHaveLength(cosignerHook.GATE_EXPIRY_PAYLOAD_LEN);
    expect(cosignerHook.decodeCosignerGateExpiryPayload(payload)).toEqual({
      mode: cosignerHook.GATE_EXPIRY_SLOT,
      value: 20n,
      cosigner,
    });
  });

  it('encodes disabled gates as empty payloads', () => {
    expect(
      cosignerHook.encodeCosignerGateExpiryPayload({
        mode: cosignerHook.GATE_EXPIRY_DISABLED,
        value: 0n,
      }),
    ).toHaveLength(0);
  });

  it('reports whether timestamp and slot expiries still enforce the gate', () => {
    const timestampPayload = cosignerHook.encodeCosignerGateExpiryPayload({
      mode: cosignerHook.GATE_EXPIRY_UNIX_TIMESTAMP,
      value: 1_000n,
      cosigner,
    });
    const slotPayload = cosignerHook.encodeCosignerGateExpiryPayload({
      mode: cosignerHook.GATE_EXPIRY_SLOT,
      value: 20n,
      cosigner,
    });

    expect(
      cosignerHook.getCosignerGateStatus(timestampPayload, {
        unixTimestamp: 999n,
      }),
    ).toMatchObject({ gateEnforced: true, reason: 'timestamp_pending' });
    expect(
      cosignerHook.getCosignerGateStatus(timestampPayload, {
        unixTimestamp: 1_000n,
      }),
    ).toMatchObject({ gateEnforced: false, reason: 'timestamp_expired' });
    expect(
      cosignerHook.getCosignerGateStatus(slotPayload, { slot: 19n }),
    ).toMatchObject({ gateEnforced: true, reason: 'slot_pending' });
    expect(
      cosignerHook.getCosignerGateStatus(slotPayload, { slot: 20n }),
    ).toMatchObject({ gateEnforced: false, reason: 'slot_expired' });
  });

  it('keeps the gate enforced for empty or invalid payloads', () => {
    expect(cosignerHook.getCosignerGateStatus(new Uint8Array())).toMatchObject({
      gateEnforced: true,
      reason: 'expiry_disabled',
    });
    expect(
      cosignerHook.getCosignerGateStatus(new Uint8Array([1, 9, 0])),
    ).toMatchObject({
      gateEnforced: true,
      reason: 'invalid_expiry_payload',
    });
    expect(
      cosignerHook.getCosignerGateStatus(
        new Uint8Array([1, 2, 20, 0, 0, 0, 0, 0, 0, 0]),
      ),
    ).toMatchObject({
      gateEnforced: true,
      reason: 'invalid_expiry_payload',
    });
    expect(
      cosignerHook.getCosignerGateStatus(
        cosignerHook.encodeCosignerGateExpiryPayload({
          mode: cosignerHook.GATE_EXPIRY_SLOT,
          value: 20n,
          cosigner,
        }),
      ),
    ).toMatchObject({ gateEnforced: true, reason: 'slot_unavailable' });
  });

  it('rejects invalid expiry args before encoding', () => {
    const encodeUnchecked =
      cosignerHook.encodeCosignerGateExpiryPayload as (expiry: {
        mode: number;
        value: bigint | number;
        cosigner?: Address;
      }) => Uint8Array;

    expect(() => encodeUnchecked({ mode: 99, value: 0n })).toThrow(
      /Invalid cosigner gate expiry mode/,
    );
    expect(() =>
      cosignerHook.encodeCosignerGateExpiryPayload({
        mode: cosignerHook.GATE_EXPIRY_SLOT,
        value: -1n,
        cosigner,
      }),
    ).toThrow(/Invalid cosigner gate expiry value/);
    expect(() =>
      cosignerHook.encodeCosignerGateExpiryPayload({
        mode: cosignerHook.GATE_EXPIRY_SLOT,
        value: 1n << 64n,
        cosigner,
      }),
    ).toThrow(/Invalid cosigner gate expiry value/);
    expect(() =>
      encodeUnchecked({
        mode: cosignerHook.GATE_EXPIRY_SLOT,
        value: 20n,
      }),
    ).toThrow(/Cosigner hint is required/);
    expect(() =>
      encodeUnchecked({
        mode: cosignerHook.GATE_EXPIRY_DISABLED,
        value: 0n,
        cosigner,
      }),
    ).toThrow(/Cosigner hint cannot be encoded/);
  });
});
