import { AccountRole, address } from '@solana/kit';
import { generateKeyPairSigner } from '@solana/signers';
import { describe, expect, it } from 'vitest';

import { dopplerLaunchHookV2 } from '@/solana/index.js';

describe('Doppler launch hook v2 gate administration', () => {
  it('appends each launch and writable control PDA in program order', async () => {
    const adminAuthority = await generateKeyPairSigner();
    const launches = [
      address('SysvarC1ock11111111111111111111111111111111'),
      address('SysvarS1otHashes111111111111111111111111111'),
    ];
    const prepared = await dopplerLaunchHookV2.prepareDisableCosignGates({
      adminAuthority,
      launches,
    });

    expect(prepared.instruction.accounts?.slice(3)).toEqual([
      { address: launches[0], role: AccountRole.READONLY },
      {
        address: prepared.cosignGateControls[0],
        role: AccountRole.WRITABLE,
      },
      { address: launches[1], role: AccountRole.READONLY },
      {
        address: prepared.cosignGateControls[1],
        role: AccountRole.WRITABLE,
      },
    ]);
    expect(
      dopplerLaunchHookV2
        .getDisableCosignGatesInstructionDataDecoder()
        .decode(prepared.instruction.data!).launches,
    ).toEqual(launches);
  });

  it('rejects empty, oversized, and duplicate batches', async () => {
    const adminAuthority = await generateKeyPairSigner();
    const launch = address('SysvarC1ock11111111111111111111111111111111');

    await expect(
      dopplerLaunchHookV2.prepareDisableCosignGates({
        adminAuthority,
        launches: [],
      }),
    ).rejects.toThrow(/between 1 and 8/);
    await expect(
      dopplerLaunchHookV2.prepareDisableCosignGates({
        adminAuthority,
        launches: Array.from({ length: 9 }, () => launch),
      }),
    ).rejects.toThrow(/between 1 and 8/);
    await expect(
      dopplerLaunchHookV2.prepareDisableCosignGates({
        adminAuthority,
        launches: [launch, launch],
      }),
    ).rejects.toThrow(/duplicate/);
  });
});
