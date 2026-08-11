import { address } from '@solana/kit';
import { generateKeyPairSigner } from '@solana/signers';
import { describe, expect, it } from 'vitest';

import {
  dopplerLaunchHookV2,
  feeRehypothecation,
  initializer,
} from '@/solana/index.js';
import { getInitializeLaunchInstructionDataDecoder } from '@/solana/generated/initializer/index.js';
import { getInitializeRehypeInstructionDataDecoder } from '@/solana/generated/dopplerRehypeRouterV1/index.js';

describe('fee rehypothecation launch preparation', () => {
  it('prepares routing before a non-migrating Hook v2 launch', async () => {
    const payer = await generateKeyPairSigner();
    const baseMint = await generateKeyPairSigner();
    const baseVault = await generateKeyPairSigner();
    const quoteVault = await generateKeyPairSigner();
    const quoteMint = address('So11111111111111111111111111111111111111112');
    const prepared = await feeRehypothecation.prepareLaunch({
      launchAccounts: { baseMint, quoteMint, baseVault, quoteVault },
      payer,
      authority: payer,
      supply: {
        baseDecimals: 6,
        baseTotalSupply: 1_000_000n,
        baseForDistribution: 0n,
        baseForLiquidity: 0n,
      },
      curve: {
        curveVirtualBase: 1_000_000n,
        curveVirtualQuote: 10_000n,
        swapFeeBps: 200,
      },
      buybackDestination: payer.address,
      settlementAuthority: payer.address,
      beneficiaries: [{ wallet: payer.address, shareBps: 10_000 }],
      strategy: feeRehypothecation.allFeesToBeneficiariesInNumeraire(),
      metadata: null,
    });

    const routingData = getInitializeRehypeInstructionDataDecoder().decode(
      prepared.initializeRoutingInstruction.data!,
    );
    const launchData = getInitializeLaunchInstructionDataDecoder().decode(
      prepared.initializeLaunchInstruction.data!,
    );
    const payload = dopplerLaunchHookV2.decodeDopplerLaunchHookV2Payload(
      launchData.hookPayload,
    );

    expect(routingData.launchId).toEqual(prepared.launchId);
    expect(routingData.feeRouting).toEqual(
      feeRehypothecation.allFeesToBeneficiariesInNumeraire().feeRouting,
    );
    expect(launchData.migratorInitPayload).toHaveLength(0);
    expect(launchData.migratorMigratePayload).toHaveLength(0);
    expect(launchData.feeBeneficiaries).toEqual([
      { wallet: prepared.routingAddresses.authority, shareBps: 10_000 },
    ]);
    expect(launchData.hookFlags).toBe(
      initializer.HF_BEFORE_CREATE |
        initializer.HF_BEFORE_SWAP |
        initializer.HF_BEFORE_MIGRATE |
        initializer.HF_FORWARD_READONLY_SIGNERS |
        initializer.HF_LAUNCH_CONTEXT_V2,
    );
    expect(payload.feeRehypothecationState).toBe(
      prepared.routingAddresses.state,
    );
    expect(
      prepared.initializeLaunchInstruction
        .accounts!.slice(-4)
        .map(({ address }) => address),
    ).toEqual(prepared.unsignedSwapHook.remainingAccounts);
  });

  it('rejects allocations that would remain reserved without migration', async () => {
    const payer = await generateKeyPairSigner();
    const baseMint = await generateKeyPairSigner();
    const baseVault = await generateKeyPairSigner();
    const quoteVault = await generateKeyPairSigner();

    await expect(
      feeRehypothecation.prepareLaunch({
        launchAccounts: {
          baseMint,
          quoteMint: address('So11111111111111111111111111111111111111112'),
          baseVault,
          quoteVault,
        },
        payer,
        authority: payer,
        supply: {
          baseDecimals: 6,
          baseTotalSupply: 1_000_000n,
          baseForDistribution: 1n,
          baseForLiquidity: 0n,
        },
        curve: {
          curveVirtualBase: 1_000_000n,
          curveVirtualQuote: 10_000n,
          swapFeeBps: 200,
        },
        buybackDestination: payer.address,
        settlementAuthority: payer.address,
        beneficiaries: [{ wallet: payer.address, shareBps: 10_000 }],
        strategy: feeRehypothecation.inKindBeneficiaryFees(),
      }),
    ).rejects.toThrow(/zero distribution and liquidity reserves/);
  });
});
