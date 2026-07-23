import { describe, expect, it } from 'vitest';
import {
  address,
  type Address,
  type GetAccountInfoApi,
  type Rpc,
} from '@solana/kit';
import { SYSTEM_PROGRAM_ADDRESS } from '@solana-program/system';

import { cpmmHook } from '@/solana/index.js';
import { bytesToBase64 } from '@/solana/core/accounts.js';

type MockConfig = {
  bump?: number;
  cosigners?: readonly Address[];
  exists?: boolean;
  owner?: Address;
  version?: number;
};

async function createConfigRpc({
  bump: bumpOverride,
  cosigners = [],
  exists = true,
  owner = cpmmHook.CPMM_HOOK_PROGRAM_ID,
  version = 1,
}: MockConfig): Promise<Rpc<GetAccountInfoApi>> {
  const [, derivedBump] = await cpmmHook.getCpmmHookConfigAddress(
    cpmmHook.CPMM_HOOK_PROGRAM_ID,
  );
  const encodedConfig = cpmmHook.getCosignerConfigEncoder().encode({
    adminAuthority: SYSTEM_PROGRAM_ADDRESS,
    cosignerCount: cosigners.length,
    bump: bumpOverride ?? derivedBump,
    version,
    reserved: new Uint8Array(37),
    cosigners: [
      ...cosigners,
      ...Array.from(
        { length: cpmmHook.MAX_COSIGNERS - cosigners.length },
        () => SYSTEM_PROGRAM_ADDRESS,
      ),
    ],
  });

  return {
    getAccountInfo: () => ({
      send: async () => ({
        value: exists
          ? {
              data: [bytesToBase64(encodedConfig), 'base64'],
              executable: false,
              lamports: 1n,
              owner,
              rentEpoch: 0n,
              space: encodedConfig.length,
            }
          : null,
      }),
    }),
  } as unknown as Rpc<GetAccountInfoApi>;
}

describe('managed CPMM hook cosigner resolution', () => {
  it('selects the first active config cosigner for new launches', async () => {
    const first = address('BPFLoaderUpgradeab1e11111111111111111111111');
    const second = address('ComputeBudget111111111111111111111111111111');
    const rpc = await createConfigRpc({ cosigners: [first, second] });
    const [config] = await cpmmHook.getCpmmHookConfigAddress();

    const resolvedGate = await cpmmHook.resolveManagedCosignerGate(rpc, {
      expiresAt: 1_000n,
    });

    expect(resolvedGate).toEqual({
      programId: cpmmHook.CPMM_HOOK_PROGRAM_ID,
      config,
      cosigner: first,
      activeCosigners: [first, second],
      expiresAt: 1_000n,
    });
    expect(Object.isFrozen(resolvedGate)).toBe(true);
    expect(Object.isFrozen(resolvedGate.activeCosigners)).toBe(true);
  });

  it('rejects a missing managed config', async () => {
    const rpc = await createConfigRpc({ exists: false });

    await expect(cpmmHook.resolveManagedCosignerGate(rpc)).rejects.toThrow(
      /does not exist/,
    );
  });

  it('rejects a config owned by another program', async () => {
    const rpc = await createConfigRpc({
      cosigners: [SYSTEM_PROGRAM_ADDRESS],
      owner: SYSTEM_PROGRAM_ADDRESS,
    });

    await expect(cpmmHook.resolveManagedCosignerGate(rpc)).rejects.toThrow(
      /is owned by/,
    );
  });

  it('rejects a config without an active cosigner', async () => {
    const rpc = await createConfigRpc({ cosigners: [] });

    await expect(cpmmHook.resolveManagedCosignerGate(rpc)).rejects.toThrow(
      /no valid active cosigner/,
    );
  });

  it('rejects a config with the wrong PDA bump', async () => {
    const [, bump] = await cpmmHook.getCpmmHookConfigAddress();
    const rpc = await createConfigRpc({
      bump: (bump + 1) & 0xff,
      cosigners: [address('ComputeBudget111111111111111111111111111111')],
    });

    await expect(cpmmHook.resolveManagedCosignerGate(rpc)).rejects.toThrow(
      /no valid active cosigner/,
    );
  });

  it('rejects invalid active cosigner keys', async () => {
    const duplicate = address('ComputeBudget111111111111111111111111111111');
    const defaultKeyRpc = await createConfigRpc({
      cosigners: [SYSTEM_PROGRAM_ADDRESS],
    });
    const duplicateKeyRpc = await createConfigRpc({
      cosigners: [duplicate, duplicate],
    });

    await expect(
      cpmmHook.resolveManagedCosignerGate(defaultKeyRpc),
    ).rejects.toThrow(/contains invalid active cosigners/);
    await expect(
      cpmmHook.resolveManagedCosignerGate(duplicateKeyRpc),
    ).rejects.toThrow(/contains invalid active cosigners/);
  });
});
