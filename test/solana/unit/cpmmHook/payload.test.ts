import { address } from '@solana/kit';
import { generateKeyPairSigner } from '@solana/signers';
import { describe, expect, it } from 'vitest';

import { cpmmHook, initializer } from '@/solana/index.js';

describe('CPMM hook helpers', () => {
  it('encodes a fee schedule payload with the on-chain hook layout', () => {
    const payload = cpmmHook.encodeDynamicFeeSchedule({
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

    expect(payload).toHaveLength(cpmmHook.DYNAMIC_FEE_SCHEDULE_LEN);
    expect(payload.slice(0, 8)).toEqual(
      cpmmHook.DYNAMIC_FEE_SCHEDULE_MAGIC,
    );
    expect(payload[8]).toBe(cpmmHook.DYNAMIC_FEE_SCHEDULE_VERSION);
    expect(view.getBigInt64(16, true)).toBe(1_000n);
    expect(view.getUint16(24, true)).toBe(8_000);
    expect(view.getUint16(26, true)).toBe(120);
    expect(view.getUint32(28, true)).toBe(600);
    expect(cpmmHook.isDynamicFeeSchedulePayload(payload)).toBe(true);
  });

  it('exposes Anchor cosigner config admin instructions', async () => {
    const payer = await generateKeyPairSigner();
    const adminAuthority = await generateKeyPairSigner();
    const cosigner = await generateKeyPairSigner();
    const [config] = await cpmmHook.getCpmmHookConfigAddress();
    const programData = address('Sysvar1nstructions1111111111111111111111111');

    const initializeIx = cpmmHook.getInitializeConfigInstruction({
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
      cpmmHook.CPMM_HOOK_PROGRAM_ID,
    );
    expect(initializeData.slice(0, 8)).toEqual(
      cpmmHook.INITIALIZE_CONFIG_DISCRIMINATOR,
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
      cpmmHook
        .getAddCosignerInstruction({
          adminAuthority,
          config,
          cosigner: cosigner.address,
        })
        .data!.slice(0, 8),
    ).toEqual(cpmmHook.ADD_COSIGNER_DISCRIMINATOR);
    expect(
      cpmmHook
        .getRemoveCosignerInstruction({
          adminAuthority,
          config,
          cosigner: cosigner.address,
        })
        .data!.slice(0, 8),
    ).toEqual(cpmmHook.REMOVE_COSIGNER_DISCRIMINATOR);
    expect(
      cpmmHook
        .getSetAuthorityInstruction({
          adminAuthority,
          config,
          adminAuthorityArg: adminAuthority.address,
        })
        .data!.slice(0, 8),
    ).toEqual(cpmmHook.SET_AUTHORITY_DISCRIMINATOR);
  });

  it('combines fee schedules with cosigner gate payloads', () => {
    const cosigner = cpmmHook.CPMM_HOOK_PROGRAM_ID;
    const payload = cpmmHook.encodeCpmmHookPayload({
      schedule: {
        startingTime: 0n,
        startFeeBps: 8_000,
        endFeeBps: 120,
        durationSeconds: 600n,
      },
      gateExpiry: {
        mode: cpmmHook.GATE_EXPIRY_UNIX_TIMESTAMP,
        value: 1_000n,
        cosigner,
      },
    });

    expect(payload).toHaveLength(
      cpmmHook.DYNAMIC_FEE_SCHEDULE_LEN +
        cpmmHook.GATE_EXPIRY_PAYLOAD_LEN,
    );
    expect(
      cpmmHook.isDynamicFeeSchedulePayload(
        payload.slice(0, cpmmHook.DYNAMIC_FEE_SCHEDULE_LEN),
      ),
    ).toBe(true);
    expect(
      cpmmHook.decodeCosignerGateExpiryPayload(
        payload.slice(cpmmHook.DYNAMIC_FEE_SCHEDULE_LEN),
      ),
    ).toEqual({
      mode: cpmmHook.GATE_EXPIRY_UNIX_TIMESTAMP,
      value: 1_000n,
      cosigner,
    });
  });

  it('rejects schedule params that the on-chain hook rejects', () => {
    expect(() =>
      cpmmHook.encodeDynamicFeeSchedule({
        startingTime: -1n,
        startFeeBps: 8_000,
        endFeeBps: 120,
        durationSeconds: 600n,
      }),
    ).toThrow(/startingTime/);
    expect(() =>
      cpmmHook.encodeDynamicFeeSchedule({
        startingTime: 0n,
        startFeeBps: 10_001,
        endFeeBps: 120,
        durationSeconds: 600n,
      }),
    ).toThrow(/startFeeBps/);
    expect(() =>
      cpmmHook.encodeDynamicFeeSchedule({
        startingTime: 0n,
        startFeeBps: 120,
        endFeeBps: 8_000,
        durationSeconds: 600n,
      }),
    ).toThrow(/endFeeBps/);
    expect(() =>
      cpmmHook.encodeDynamicFeeSchedule({
        startingTime: 0n,
        startFeeBps: 8_000,
        endFeeBps: 120,
        durationSeconds: 0n,
      }),
    ).toThrow(/durationSeconds/);
  });

  it('builds static or dynamic-fee remaining accounts and commitment hash', () => {
    const namespace = address('Sysvar1nstructions1111111111111111111111111');
    const remainingAccounts = cpmmHook.getCpmmHookRemainingAccounts(
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
    const [config] = await cpmmHook.getCpmmHookConfigAddress();
    const remainingAccounts = cpmmHook.getCpmmHookRemainingAccounts(
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
