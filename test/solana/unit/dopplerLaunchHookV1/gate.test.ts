import { describe, expect, it } from 'vitest';
import type { Address } from '@solana/kit';
import { dopplerLaunchHookV1 } from '@/solana/index.js';

describe('Doppler launch hook v1 gate payload helpers', () => {
  const cosigner = 'So11111111111111111111111111111111111111112' as Address;

  it('encodes a per-launch unix timestamp expiry payload with a cosigner hint', () => {
    const payload = dopplerLaunchHookV1.encodeCosignerGateExpiryPayload({
      mode: dopplerLaunchHookV1.GATE_EXPIRY_UNIX_TIMESTAMP,
      value: 300n,
      cosigner,
    });

    expect(payload).toHaveLength(dopplerLaunchHookV1.GATE_EXPIRY_PAYLOAD_LEN);
    expect(
      dopplerLaunchHookV1.decodeCosignerGateExpiryPayload(payload),
    ).toEqual({
      mode: dopplerLaunchHookV1.GATE_EXPIRY_UNIX_TIMESTAMP,
      value: 300n,
      cosigner,
    });
  });

  it('encodes a per-launch slot expiry payload with a cosigner hint', () => {
    const payload = dopplerLaunchHookV1.encodeCosignerGateExpiryPayload({
      mode: dopplerLaunchHookV1.GATE_EXPIRY_SLOT,
      value: 20n,
      cosigner,
    });

    expect(payload).toHaveLength(dopplerLaunchHookV1.GATE_EXPIRY_PAYLOAD_LEN);
    expect(
      dopplerLaunchHookV1.decodeCosignerGateExpiryPayload(payload),
    ).toEqual({
      mode: dopplerLaunchHookV1.GATE_EXPIRY_SLOT,
      value: 20n,
      cosigner,
    });
  });

  it('encodes disabled gates as empty payloads', () => {
    expect(
      dopplerLaunchHookV1.encodeCosignerGateExpiryPayload({
        mode: dopplerLaunchHookV1.GATE_EXPIRY_DISABLED,
        value: 0n,
      }),
    ).toHaveLength(0);
  });

  it('reports whether timestamp and slot expiries still enforce the gate', () => {
    const timestampPayload =
      dopplerLaunchHookV1.encodeCosignerGateExpiryPayload({
        mode: dopplerLaunchHookV1.GATE_EXPIRY_UNIX_TIMESTAMP,
        value: 1_000n,
        cosigner,
      });
    const slotPayload = dopplerLaunchHookV1.encodeCosignerGateExpiryPayload({
      mode: dopplerLaunchHookV1.GATE_EXPIRY_SLOT,
      value: 20n,
      cosigner,
    });

    expect(
      dopplerLaunchHookV1.getCosignerGateStatus(timestampPayload, {
        unixTimestamp: 999n,
      }),
    ).toMatchObject({ gateEnforced: true, reason: 'timestamp_pending' });
    expect(
      dopplerLaunchHookV1.getCosignerGateStatus(timestampPayload, {
        unixTimestamp: 1_000n,
      }),
    ).toMatchObject({ gateEnforced: false, reason: 'timestamp_expired' });
    expect(
      dopplerLaunchHookV1.getCosignerGateStatus(slotPayload, { slot: 19n }),
    ).toMatchObject({ gateEnforced: true, reason: 'slot_pending' });
    expect(
      dopplerLaunchHookV1.getCosignerGateStatus(slotPayload, { slot: 20n }),
    ).toMatchObject({ gateEnforced: false, reason: 'slot_expired' });
  });

  it('keeps the gate enforced for empty or invalid payloads', () => {
    expect(
      dopplerLaunchHookV1.getCosignerGateStatus(new Uint8Array()),
    ).toMatchObject({
      gateEnforced: true,
      reason: 'expiry_disabled',
    });
    expect(
      dopplerLaunchHookV1.getCosignerGateStatus(new Uint8Array([1, 9, 0])),
    ).toMatchObject({
      gateEnforced: true,
      reason: 'invalid_expiry_payload',
    });
    expect(
      dopplerLaunchHookV1.getCosignerGateStatus(
        new Uint8Array([1, 2, 20, 0, 0, 0, 0, 0, 0, 0]),
      ),
    ).toMatchObject({
      gateEnforced: true,
      reason: 'invalid_expiry_payload',
    });
    expect(
      dopplerLaunchHookV1.getCosignerGateStatus(
        dopplerLaunchHookV1.encodeCosignerGateExpiryPayload({
          mode: dopplerLaunchHookV1.GATE_EXPIRY_SLOT,
          value: 20n,
          cosigner,
        }),
      ),
    ).toMatchObject({ gateEnforced: true, reason: 'slot_unavailable' });
  });

  it('rejects invalid expiry args before encoding', () => {
    const encodeUnchecked =
      dopplerLaunchHookV1.encodeCosignerGateExpiryPayload as (expiry: {
        mode: number;
        value: bigint | number;
        cosigner?: Address;
      }) => Uint8Array;

    expect(() => encodeUnchecked({ mode: 99, value: 0n })).toThrow(
      /Invalid cosigner gate expiry mode/,
    );
    expect(() =>
      dopplerLaunchHookV1.encodeCosignerGateExpiryPayload({
        mode: dopplerLaunchHookV1.GATE_EXPIRY_SLOT,
        value: -1n,
        cosigner,
      }),
    ).toThrow(/Invalid cosigner gate expiry value/);
    expect(() =>
      dopplerLaunchHookV1.encodeCosignerGateExpiryPayload({
        mode: dopplerLaunchHookV1.GATE_EXPIRY_SLOT,
        value: 1n << 64n,
        cosigner,
      }),
    ).toThrow(/Invalid cosigner gate expiry value/);
    expect(() =>
      encodeUnchecked({
        mode: dopplerLaunchHookV1.GATE_EXPIRY_SLOT,
        value: 20n,
      }),
    ).toThrow(/Cosigner hint is required/);
    expect(() =>
      encodeUnchecked({
        mode: dopplerLaunchHookV1.GATE_EXPIRY_DISABLED,
        value: 0n,
        cosigner,
      }),
    ).toThrow(/Cosigner hint cannot be encoded/);
  });
});
