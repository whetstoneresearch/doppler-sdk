import { address } from '@solana/kit';
import { generateKeyPairSigner } from '@solana/signers';
import { describe, expect, it } from 'vitest';

import { dopplerLaunchHookV1, initializer } from '@/solana/index.js';

describe('Doppler launch hook v1 helpers', () => {
  it('encodes a fee schedule payload with the on-chain hook layout', () => {
    const payload = dopplerLaunchHookV1.encodeDynamicFeeSchedule({
      startingTime: 1_000n,
      startFeeBps: 8_000,
      endFeeBps: 120,
      durationSeconds: 600n,
    });
    const view = new DataView(
      payload.buffer,
      payload.byteOffset,
      payload.byteLength,
    );

    expect(payload).toHaveLength(dopplerLaunchHookV1.DYNAMIC_FEE_SCHEDULE_LEN);
    expect(payload.slice(0, 8)).toEqual(
      dopplerLaunchHookV1.DYNAMIC_FEE_SCHEDULE_MAGIC,
    );
    expect(payload[8]).toBe(dopplerLaunchHookV1.DYNAMIC_FEE_SCHEDULE_VERSION);
    expect(view.getBigInt64(16, true)).toBe(1_000n);
    expect(view.getUint16(24, true)).toBe(8_000);
    expect(view.getUint16(26, true)).toBe(120);
    expect(view.getUint32(28, true)).toBe(600);
    expect(dopplerLaunchHookV1.isDynamicFeeSchedulePayload(payload)).toBe(true);
  });

  it('exposes Anchor cosigner config admin instructions', async () => {
    const payer = await generateKeyPairSigner();
    const adminAuthority = await generateKeyPairSigner();
    const cosigner = await generateKeyPairSigner();
    const [config] =
      await dopplerLaunchHookV1.getDopplerLaunchHookV1ConfigAddress();
    const programData = address('Sysvar1nstructions1111111111111111111111111');

    const initializeIx = dopplerLaunchHookV1.getInitializeConfigInstruction({
      payer,
      adminAuthority,
      config,
      programData,
      cosigners: [cosigner.address],
    });
    const initializeData = initializeIx.data!;
    const initializeView = new DataView(
      initializeData.buffer,
      initializeData.byteOffset,
      initializeData.byteLength,
    );

    expect(initializeIx.programAddress).toBe(
      dopplerLaunchHookV1.DOPPLER_LAUNCH_HOOK_V1_PROGRAM_ID,
    );
    expect(initializeData.slice(0, 8)).toEqual(
      dopplerLaunchHookV1.INITIALIZE_CONFIG_DISCRIMINATOR,
    );
    expect(initializeView.getUint32(8, true)).toBe(1);
    expect(initializeIx.accounts?.map((account) => account.address)).toEqual([
      payer.address,
      adminAuthority.address,
      config,
      programData,
      '11111111111111111111111111111111',
    ]);

    expect(
      dopplerLaunchHookV1
        .getAddCosignerInstruction({
          adminAuthority,
          config,
          cosigner: cosigner.address,
        })
        .data!.slice(0, 8),
    ).toEqual(dopplerLaunchHookV1.ADD_COSIGNER_DISCRIMINATOR);
    expect(
      dopplerLaunchHookV1
        .getRemoveCosignerInstruction({
          adminAuthority,
          config,
          cosigner: cosigner.address,
        })
        .data!.slice(0, 8),
    ).toEqual(dopplerLaunchHookV1.REMOVE_COSIGNER_DISCRIMINATOR);
    expect(
      dopplerLaunchHookV1
        .getSetAuthorityInstruction({
          adminAuthority,
          config,
          adminAuthorityArg: adminAuthority.address,
        })
        .data!.slice(0, 8),
    ).toEqual(dopplerLaunchHookV1.SET_AUTHORITY_DISCRIMINATOR);
  });

  it('combines fee schedules with cosigner gate payloads', () => {
    const cosigner = dopplerLaunchHookV1.DOPPLER_LAUNCH_HOOK_V1_PROGRAM_ID;
    const payload = dopplerLaunchHookV1.encodeDopplerLaunchHookV1Payload({
      schedule: {
        startingTime: 0n,
        startFeeBps: 8_000,
        endFeeBps: 120,
        durationSeconds: 600n,
      },
      gateExpiry: {
        mode: dopplerLaunchHookV1.GATE_EXPIRY_UNIX_TIMESTAMP,
        value: 1_000n,
        cosigner,
      },
    });

    expect(payload).toHaveLength(
      dopplerLaunchHookV1.DYNAMIC_FEE_SCHEDULE_LEN +
        dopplerLaunchHookV1.GATE_EXPIRY_PAYLOAD_LEN,
    );
    expect(
      dopplerLaunchHookV1.isDynamicFeeSchedulePayload(
        payload.slice(0, dopplerLaunchHookV1.DYNAMIC_FEE_SCHEDULE_LEN),
      ),
    ).toBe(true);
    expect(
      dopplerLaunchHookV1.decodeCosignerGateExpiryPayload(
        payload.slice(dopplerLaunchHookV1.DYNAMIC_FEE_SCHEDULE_LEN),
      ),
    ).toEqual({
      mode: dopplerLaunchHookV1.GATE_EXPIRY_UNIX_TIMESTAMP,
      value: 1_000n,
      cosigner,
    });
  });

  it('rejects schedule params that the on-chain hook rejects', () => {
    expect(() =>
      dopplerLaunchHookV1.encodeDynamicFeeSchedule({
        startingTime: -1n,
        startFeeBps: 8_000,
        endFeeBps: 120,
        durationSeconds: 600n,
      }),
    ).toThrow(/startingTime/);
    expect(() =>
      dopplerLaunchHookV1.encodeDynamicFeeSchedule({
        startingTime: 0n,
        startFeeBps: 10_001,
        endFeeBps: 120,
        durationSeconds: 600n,
      }),
    ).toThrow(/startFeeBps/);
    expect(() =>
      dopplerLaunchHookV1.encodeDynamicFeeSchedule({
        startingTime: 0n,
        startFeeBps: 120,
        endFeeBps: 8_000,
        durationSeconds: 600n,
      }),
    ).toThrow(/endFeeBps/);
    expect(() =>
      dopplerLaunchHookV1.encodeDynamicFeeSchedule({
        startingTime: 0n,
        startFeeBps: 8_000,
        endFeeBps: 120,
        durationSeconds: 0n,
      }),
    ).toThrow(/durationSeconds/);
  });

  it('builds static or dynamic-fee remaining accounts and commitment hash', () => {
    const namespace = address('Sysvar1nstructions1111111111111111111111111');
    const remainingAccounts =
      dopplerLaunchHookV1.getDopplerLaunchHookV1RemainingAccounts({
        namespace,
      });

    expect(remainingAccounts.signedHookRemainingAccounts).toEqual([namespace]);
    expect(remainingAccounts.unsignedHookRemainingAccounts).toEqual([
      namespace,
    ]);
    expect(remainingAccounts.hookRemainingAccountsHash).toEqual(
      initializer.computeRemainingAccountsHash([namespace]),
    );
  });

  it('builds dynamic fee plus cosigner remaining accounts and commitment hash', async () => {
    const namespace = address('Sysvar1nstructions1111111111111111111111111');
    const signer = await generateKeyPairSigner();
    const [config] =
      await dopplerLaunchHookV1.getDopplerLaunchHookV1ConfigAddress();
    const remainingAccounts =
      dopplerLaunchHookV1.getDopplerLaunchHookV1RemainingAccounts({
        namespace,
        config,
        cosigner: signer,
      });

    expect(remainingAccounts.signedHookRemainingAccounts).toEqual([
      namespace,
      config,
      signer,
    ]);
    expect(remainingAccounts.unsignedHookRemainingAccounts).toEqual([
      namespace,
      config,
      signer.address,
    ]);
    expect(remainingAccounts.hookRemainingAccountsHash).toEqual(
      initializer.computeRemainingAccountsHash([
        namespace,
        config,
        signer.address,
      ]),
    );
  });
});
