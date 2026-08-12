import {
  address,
  type Address,
  type GetAccountInfoApi,
  type Rpc,
} from '@solana/kit';
import { SYSTEM_PROGRAM_ADDRESS } from '@solana-program/system';
import { describe, expect, it } from 'vitest';

import { bytesToBase64 } from '@/solana/core/accounts.js';
import {
  dopplerLaunchHookV2,
  dopplerRehypeRouterV1,
  initializer,
} from '@/solana/index.js';

async function createConfigRpc({
  cosigners,
  initializerProgram = initializer.INITIALIZER_PROGRAM_ID,
  routerProgram = dopplerRehypeRouterV1.DOPPLER_REHYPE_ROUTER_V1_PROGRAM_ADDRESS,
}: {
  cosigners: readonly Address[];
  initializerProgram?: Address;
  routerProgram?: Address;
}): Promise<Rpc<GetAccountInfoApi>> {
  const [, bump] =
    await dopplerLaunchHookV2.getDopplerLaunchHookV2ConfigAddress();
  const encodedConfig = dopplerLaunchHookV2.getHookConfigEncoder().encode({
    adminAuthority: SYSTEM_PROGRAM_ADDRESS,
    initializerProgram,
    rehypeRouterProgram: routerProgram,
    cosignerCount: cosigners.length,
    bump,
    version: 1,
    reserved: new Uint8Array(29),
    cosigners: [
      ...cosigners,
      ...Array.from(
        {
          length:
            dopplerLaunchHookV2.DOPPLER_LAUNCH_HOOK_V2_MAX_COSIGNERS -
            cosigners.length,
        },
        () => SYSTEM_PROGRAM_ADDRESS,
      ),
    ],
  });

  return {
    getAccountInfo: () => ({
      send: async () => ({
        value: {
          data: [bytesToBase64(encodedConfig), 'base64'],
          executable: false,
          lamports: 1n,
          owner: dopplerLaunchHookV2.DOPPLER_LAUNCH_HOOK_V2_PROGRAM_ID,
          rentEpoch: 0n,
          space: encodedConfig.length,
        },
      }),
    }),
  } as unknown as Rpc<GetAccountInfoApi>;
}

describe('managed Doppler launch hook v2 cosigner resolution', () => {
  it('selects the first active cosigner and defaults to no expiry', async () => {
    const first = address('BPFLoaderUpgradeab1e11111111111111111111111');
    const second = address('ComputeBudget111111111111111111111111111111');
    const rpc = await createConfigRpc({ cosigners: [first, second] });

    const gate = await dopplerLaunchHookV2.resolveManagedCosignerGate(rpc);

    expect(gate.cosigner).toBe(first);
    expect(gate.activeCosigners).toEqual([first, second]);
    expect(gate.expiresAt).toBe((1n << 64n) - 1n);
    expect(Object.isFrozen(gate)).toBe(true);
  });

  it('rejects configs bound to a different protocol deployment', async () => {
    const cosigner = address('ComputeBudget111111111111111111111111111111');
    const rpc = await createConfigRpc({
      cosigners: [cosigner],
      initializerProgram: SYSTEM_PROGRAM_ADDRESS,
    });

    await expect(
      dopplerLaunchHookV2.resolveManagedCosignerGate(rpc),
    ).rejects.toThrow(/not valid for this deployment/);
  });

  it('rejects empty configs and imprecise numeric expiries', async () => {
    const emptyRpc = await createConfigRpc({ cosigners: [] });
    const cosignerRpc = await createConfigRpc({
      cosigners: [address('ComputeBudget111111111111111111111111111111')],
    });

    await expect(
      dopplerLaunchHookV2.resolveManagedCosignerGate(emptyRpc),
    ).rejects.toThrow(/not valid for this deployment/);
    await expect(
      dopplerLaunchHookV2.resolveManagedCosignerGate(cosignerRpc, {
        expiresAt: Number.MAX_SAFE_INTEGER + 1,
      }),
    ).rejects.toThrow(/safe integer/);
  });
});
