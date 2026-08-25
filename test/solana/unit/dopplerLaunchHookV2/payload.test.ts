import { address, getAddressEncoder } from '@solana/kit';
import { generateKeyPairSigner } from '@solana/signers';
import { describe, expect, it } from 'vitest';

import {
  dopplerLaunchHookV2,
  feeRehypothecation,
  initializer,
} from '@/solana/index.js';

describe('Doppler launch hook v2 payload helpers', () => {
  it('encodes and decodes the fixed v2 payload layout', async () => {
    const cosigner = await generateKeyPairSigner();
    const state = address('SysvarC1ock11111111111111111111111111111111');
    const payload = dopplerLaunchHookV2.encodeDopplerLaunchHookV2Payload({
      dynamicFee: {
        startingTime: 0n,
        startFeeBps: 8_000,
        endFeeBps: 200,
        durationSeconds: 600n,
      },
      cosignerGate: {
        mode: dopplerLaunchHookV2.DOPPLER_LAUNCH_HOOK_V2_GATE_UNIX_TIMESTAMP,
        value: 1_000n,
        cosigner: cosigner.address,
      },
      feeRehypothecationState: state,
    });
    const view = new DataView(
      payload.buffer,
      payload.byteOffset,
      payload.byteLength,
    );

    expect(payload).toHaveLength(
      dopplerLaunchHookV2.DOPPLER_LAUNCH_HOOK_V2_PAYLOAD_LEN,
    );
    expect(payload.slice(0, 8)).toEqual(
      dopplerLaunchHookV2.DOPPLER_LAUNCH_HOOK_V2_PAYLOAD_MAGIC,
    );
    expect(payload[9]).toBe(
      dopplerLaunchHookV2.DOPPLER_LAUNCH_HOOK_V2_FEATURE_MASK,
    );
    expect(view.getUint16(24, true)).toBe(8_000);
    expect(view.getUint16(26, true)).toBe(200);
    expect(view.getBigUint64(40, true)).toBe(1_000n);
    expect(payload.slice(48, 80)).toEqual(
      getAddressEncoder().encode(cosigner.address),
    );
    expect(payload.slice(80, 112)).toEqual(getAddressEncoder().encode(state));
    expect(
      dopplerLaunchHookV2.decodeDopplerLaunchHookV2Payload(payload),
    ).toEqual({
      featureFlags: dopplerLaunchHookV2.DOPPLER_LAUNCH_HOOK_V2_FEATURE_MASK,
      dynamicFee: {
        startingTime: 0n,
        startFeeBps: 8_000,
        endFeeBps: 200,
        durationSeconds: 600n,
      },
      cosignerGate: {
        mode: dopplerLaunchHookV2.DOPPLER_LAUNCH_HOOK_V2_GATE_UNIX_TIMESTAMP,
        value: 1_000n,
        cosigner: cosigner.address,
      },
      feeRehypothecationState: state,
    });
  });

  it('commits the canonical fee routing account order', async () => {
    const launch = address('BPFLoaderUpgradeab1e11111111111111111111111');
    const namespace = address('Sysvar1nstructions1111111111111111111111111');
    const config = address('SysvarC1ock11111111111111111111111111111111');
    const state = address('SysvarS1otHashes111111111111111111111111111');
    const settlementSigner = address(
      'SysvarRecentB1ockHashes11111111111111111111',
    );
    const cosigner = await generateKeyPairSigner();
    const [cosignGateControl] =
      await dopplerLaunchHookV2.getDopplerLaunchHookV2CosignGateControlAddress(
        launch,
      );
    const result = dopplerLaunchHookV2.getDopplerLaunchHookV2RemainingAccounts({
      namespace,
      config,
      feeRehypothecationState: state,
      settlementSigner,
      cosignGateControl,
      cosigner,
    });

    expect(result.signedHookRemainingAccounts).toEqual([
      namespace,
      config,
      state,
      settlementSigner,
      cosignGateControl,
      cosigner,
    ]);
    expect(result.hookRemainingAccountsHash).toEqual(
      initializer.computeRemainingAccountsHash([
        namespace,
        config,
        state,
        settlementSigner,
        cosignGateControl,
        cosigner.address,
      ]),
    );
  });

  it('rejects payload bytes that the on-chain hook treats as invalid', async () => {
    const cosigner = await generateKeyPairSigner();
    const gated = dopplerLaunchHookV2.encodeDopplerLaunchHookV2Payload({
      cosignerGate: {
        mode: dopplerLaunchHookV2.DOPPLER_LAUNCH_HOOK_V2_GATE_SLOT,
        value: 100n,
        cosigner: cosigner.address,
      },
    });
    const reserved = gated.slice();
    reserved[10] = 1;
    expect(() =>
      dopplerLaunchHookV2.decodeDopplerLaunchHookV2Payload(reserved),
    ).toThrow(/payload header/);

    const disabledGate = gated.slice();
    disabledGate[9] = 0;
    expect(() =>
      dopplerLaunchHookV2.decodeDopplerLaunchHookV2Payload(disabledGate),
    ).toThrow(/disabled.*cosigner gate/);

    const manualDisableWithoutGate = gated.slice();
    manualDisableWithoutGate[9] =
      dopplerLaunchHookV2.DOPPLER_LAUNCH_HOOK_V2_FEATURE_MANUAL_COSIGN_DISABLE;
    expect(() =>
      dopplerLaunchHookV2.decodeDopplerLaunchHookV2Payload(
        manualDisableWithoutGate,
      ),
    ).toThrow(/manual cosigner disable/);

    const missingCosigner = gated.slice();
    missingCosigner.fill(0, 48, 80);
    expect(() =>
      dopplerLaunchHookV2.decodeDopplerLaunchHookV2Payload(missingCosigner),
    ).toThrow(/cosigner/);
  });

  it('requires the control PDA alongside a cosigner account', async () => {
    const cosigner = await generateKeyPairSigner();

    expect(() =>
      dopplerLaunchHookV2.getDopplerLaunchHookV2RemainingAccounts({
        namespace: address('Sysvar1nstructions1111111111111111111111111'),
        config: address('SysvarC1ock11111111111111111111111111111111'),
        cosigner,
      }),
    ).toThrow(/must be provided together/);
  });

  it('rejects invalid cosigner gate modes before encoding', async () => {
    const cosigner = await generateKeyPairSigner();

    for (const mode of [
      dopplerLaunchHookV2.DOPPLER_LAUNCH_HOOK_V2_GATE_DISABLED,
      257,
    ]) {
      expect(() =>
        dopplerLaunchHookV2.encodeDopplerLaunchHookV2Payload({
          cosignerGate: {
            mode: mode as never,
            value: 100n,
            cosigner: cosigner.address,
          },
        }),
      ).toThrow(/cosigner gate mode/);
    }
  });

  it('derives the router PDAs from the base mint', async () => {
    const baseMint = address('So11111111111111111111111111111111111111112');
    const addresses =
      await feeRehypothecation.deriveFeeRehypothecationAddresses(baseMint);

    expect(addresses.state).not.toBe(addresses.authority);
    expect(addresses.authority).not.toBe(addresses.settlementSigner);
  });
});
