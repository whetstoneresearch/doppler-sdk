import { address } from '@solana/kit';
import { generateKeyPairSigner } from '@solana/signers';
import { describe, expect, it } from 'vitest';

import { cosignerHook, dynamicFeeHook, initializer } from '@/solana/index.js';

describe('dynamicFeeHook helpers', () => {
  it('encodes a fee schedule payload with the on-chain hook layout', () => {
    const payload = dynamicFeeHook.encodeDynamicFeeSchedule({
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

    expect(payload).toHaveLength(dynamicFeeHook.DYNAMIC_FEE_SCHEDULE_LEN);
    expect(payload.slice(0, 8)).toEqual(
      dynamicFeeHook.DYNAMIC_FEE_SCHEDULE_MAGIC,
    );
    expect(payload[8]).toBe(dynamicFeeHook.DYNAMIC_FEE_SCHEDULE_VERSION);
    expect(view.getBigInt64(16, true)).toBe(1_000n);
    expect(view.getUint16(24, true)).toBe(8_000);
    expect(view.getUint16(26, true)).toBe(120);
    expect(view.getUint32(28, true)).toBe(600);
    expect(dynamicFeeHook.isDynamicFeeSchedulePayload(payload)).toBe(true);
  });

  it('exposes Anchor cosigner config admin instructions', async () => {
    const payer = await generateKeyPairSigner();
    const adminAuthority = await generateKeyPairSigner();
    const cosigner = await generateKeyPairSigner();
    const [config] = await dynamicFeeHook.getDynamicFeeHookConfigAddress();
    const programData = address('Sysvar1nstructions1111111111111111111111111');

    const initializeIx = dynamicFeeHook.getInitializeConfigInstruction({
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
      dynamicFeeHook.DYNAMIC_FEE_HOOK_PROGRAM_ID,
    );
    expect(initializeData.slice(0, 8)).toEqual(
      dynamicFeeHook.INITIALIZE_CONFIG_DISCRIMINATOR,
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
      dynamicFeeHook
        .getAddCosignerInstruction({
          adminAuthority,
          config,
          cosigner: cosigner.address,
        })
        .data!.slice(0, 8),
    ).toEqual(dynamicFeeHook.ADD_COSIGNER_DISCRIMINATOR);
    expect(
      dynamicFeeHook
        .getRemoveCosignerInstruction({
          adminAuthority,
          config,
          cosigner: cosigner.address,
        })
        .data!.slice(0, 8),
    ).toEqual(dynamicFeeHook.REMOVE_COSIGNER_DISCRIMINATOR);
    expect(
      dynamicFeeHook
        .getSetAuthorityInstruction({
          adminAuthority,
          config,
          adminAuthorityArg: adminAuthority.address,
        })
        .data!.slice(0, 8),
    ).toEqual(dynamicFeeHook.SET_AUTHORITY_DISCRIMINATOR);
  });

  it('combines fee schedules with cosigner gate payloads', () => {
    const cosigner = cosignerHook.DOPPLER_NATIVE_COSIGNER_HOOK_PROGRAM_ID;
    const payload = dynamicFeeHook.encodeDynamicFeeHookPayload({
      schedule: {
        startingTime: 0n,
        startFeeBps: 8_000,
        endFeeBps: 120,
        durationSeconds: 600n,
      },
      gateExpiry: {
        mode: cosignerHook.GATE_EXPIRY_UNIX_TIMESTAMP,
        value: 1_000n,
        cosigner,
      },
    });

    expect(payload).toHaveLength(
      dynamicFeeHook.DYNAMIC_FEE_SCHEDULE_LEN +
        cosignerHook.GATE_EXPIRY_PAYLOAD_LEN,
    );
    expect(
      dynamicFeeHook.isDynamicFeeSchedulePayload(
        payload.slice(0, dynamicFeeHook.DYNAMIC_FEE_SCHEDULE_LEN),
      ),
    ).toBe(true);
    expect(
      cosignerHook.decodeCosignerGateExpiryPayload(
        payload.slice(dynamicFeeHook.DYNAMIC_FEE_SCHEDULE_LEN),
      ),
    ).toEqual({
      mode: cosignerHook.GATE_EXPIRY_UNIX_TIMESTAMP,
      value: 1_000n,
      cosigner,
    });
  });

  it('rejects schedule params that the on-chain hook rejects', () => {
    expect(() =>
      dynamicFeeHook.encodeDynamicFeeSchedule({
        startingTime: -1n,
        startFeeBps: 8_000,
        endFeeBps: 120,
        durationSeconds: 600n,
      }),
    ).toThrow(/startingTime/);
    expect(() =>
      dynamicFeeHook.encodeDynamicFeeSchedule({
        startingTime: 0n,
        startFeeBps: 10_001,
        endFeeBps: 120,
        durationSeconds: 600n,
      }),
    ).toThrow(/startFeeBps/);
    expect(() =>
      dynamicFeeHook.encodeDynamicFeeSchedule({
        startingTime: 0n,
        startFeeBps: 120,
        endFeeBps: 8_000,
        durationSeconds: 600n,
      }),
    ).toThrow(/endFeeBps/);
    expect(() =>
      dynamicFeeHook.encodeDynamicFeeSchedule({
        startingTime: 0n,
        startFeeBps: 8_000,
        endFeeBps: 120,
        durationSeconds: 0n,
      }),
    ).toThrow(/durationSeconds/);
  });

  it('builds dynamic-fee-only remaining accounts and commitment hash', () => {
    const namespace = address('Sysvar1nstructions1111111111111111111111111');
    const remainingAccounts = dynamicFeeHook.getDynamicFeeHookRemainingAccounts(
      {
        namespace,
      },
    );

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
    const [config] = await dynamicFeeHook.getDynamicFeeHookConfigAddress();
    const remainingAccounts = dynamicFeeHook.getDynamicFeeHookRemainingAccounts(
      {
        namespace,
        config,
        cosigner: signer,
      },
    );

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
