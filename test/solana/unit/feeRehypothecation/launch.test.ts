import {
  address,
  type Address,
  type GetAccountInfoApi,
  type Rpc,
} from '@solana/kit';
import { generateKeyPairSigner } from '@solana/signers';
import { SYSTEM_PROGRAM_ADDRESS } from '@solana-program/system';
import { describe, expect, it } from 'vitest';

import { bytesToBase64 } from '@/solana/core/accounts.js';
import {
  dopplerLaunchHookV2,
  dopplerRehypeRouterV1,
  feeRehypothecation,
  initializer,
  vesting,
} from '@/solana/index.js';
import { getInitializeLaunchInstructionDataDecoder } from '@/solana/generated/initializer/index.js';
import { getInitializeRehypeInstructionDataDecoder } from '@/solana/generated/dopplerRehypeRouterV1/index.js';

async function resolveCosignerGate(cosigner: Address) {
  const [, bump] =
    await dopplerLaunchHookV2.getDopplerLaunchHookV2ConfigAddress();
  const encodedConfig = dopplerLaunchHookV2.getHookConfigEncoder().encode({
    adminAuthority: SYSTEM_PROGRAM_ADDRESS,
    initializerProgram: initializer.INITIALIZER_PROGRAM_ID,
    rehypeRouterProgram:
      dopplerRehypeRouterV1.DOPPLER_REHYPE_ROUTER_V1_PROGRAM_ADDRESS,
    cosignerCount: 1,
    bump,
    version: 1,
    reserved: new Uint8Array(29),
    cosigners: [
      cosigner,
      ...Array.from(
        {
          length: dopplerLaunchHookV2.DOPPLER_LAUNCH_HOOK_V2_MAX_COSIGNERS - 1,
        },
        () => SYSTEM_PROGRAM_ADDRESS,
      ),
    ],
  });
  const rpc = {
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

  return dopplerLaunchHookV2.resolveManagedCosignerGate(rpc, {
    expiresAt: 1_000n,
  });
}

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
    expect(prepared.namespace).toBe(
      dopplerRehypeRouterV1.DOPPLER_REHYPE_ROUTER_V1_PROGRAM_ADDRESS,
    );
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

  it('prepares direct in-kind buybacks without beneficiaries', async () => {
    const payer = await generateKeyPairSigner();
    const prepared = await feeRehypothecation.prepareLaunch({
      launchAccounts: {
        baseMint: await generateKeyPairSigner(),
        quoteMint: address('So11111111111111111111111111111111111111112'),
        baseVault: await generateKeyPairSigner(),
        quoteVault: await generateKeyPairSigner(),
      },
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
      beneficiaries: [],
      strategy: {
        routingMode:
          feeRehypothecation.FEE_REHYPOTHECATION_ROUTING_MODE_DIRECT_BUYBACK,
        feeRouting: {
          assetFees: {
            assetBuybackBps: 10_000,
            numeraireBuybackBps: 0,
            beneficiaryBps: 0,
            lpBps: 0,
          },
          numeraireFees: {
            assetBuybackBps: 0,
            numeraireBuybackBps: 10_000,
            beneficiaryBps: 0,
            lpBps: 0,
          },
        },
      },
      metadata: null,
    });

    const routingData = getInitializeRehypeInstructionDataDecoder().decode(
      prepared.initializeRoutingInstruction.data!,
    );
    expect(routingData.beneficiaries).toEqual([]);
  });

  it('composes fee rehypothecation with immutable vesting', async () => {
    const payer = await generateKeyPairSigner();
    const prepared = await feeRehypothecation.prepareLaunch({
      launchAccounts: {
        baseMint: await generateKeyPairSigner(),
        quoteMint: address('So11111111111111111111111111111111111111112'),
        baseVault: await generateKeyPairSigner(),
        quoteVault: await generateKeyPairSigner(),
      },
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
      strategy: feeRehypothecation.inKindBeneficiaryFees(),
      vesting: {
        schedules: [{ cliffSeconds: 0n, durationSeconds: 86_400n }],
        allocations: [
          {
            beneficiary: payer.address,
            scheduleId: 0,
            amount: 200_000n,
          },
        ],
      },
      metadata: null,
    });
    const launchData = getInitializeLaunchInstructionDataDecoder().decode(
      prepared.initializeLaunchInstruction.data!,
    );

    expect(prepared.vesting?.totalAllocation).toBe(200_000n);
    expect(prepared.vesting?.initializeInstruction.programAddress).toBe(
      vesting.DOPPLER_VESTING_PROGRAM_ADDRESS,
    );
    expect(prepared.vesting?.fundInstruction.programAddress).toBe(
      initializer.INITIALIZER_PROGRAM_ID,
    );
    expect(launchData.baseForDistribution).toBe(200_000n);
    expect(prepared.initializeLaunchInstruction.accounts![18].address).toBe(
      prepared.vesting?.addresses.config,
    );
    expect(
      prepared.initializeLaunchInstruction
        .accounts!.slice(-4)
        .map(({ address }) => address),
    ).toEqual(prepared.unsignedSwapHook.remainingAccounts);
  });

  it('builds signed and unsigned swap hooks for a gated launch', async () => {
    const payer = await generateKeyPairSigner();
    const cosigner = await generateKeyPairSigner();
    const wrongCosigner = await generateKeyPairSigner();
    const gate = await resolveCosignerGate(cosigner.address);
    const prepared = await feeRehypothecation.prepareLaunch({
      launchAccounts: {
        baseMint: await generateKeyPairSigner(),
        quoteMint: address('So11111111111111111111111111111111111111112'),
        baseVault: await generateKeyPairSigner(),
        quoteVault: await generateKeyPairSigner(),
      },
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
      strategy: feeRehypothecation.inKindBeneficiaryFees(),
      cosignerGate: gate,
      metadata: null,
    });

    expect(prepared.getSwapHook()).toEqual(prepared.unsignedSwapHook);
    expect(prepared.unsignedSwapHook.remainingAccounts?.at(-1)).toBe(
      cosigner.address,
    );
    expect(prepared.getSwapHook(cosigner).remainingAccounts?.at(-1)).toBe(
      cosigner,
    );
    expect(() => prepared.getSwapHook(wrongCosigner)).toThrow(
      /does not match the launch cosigner/,
    );
  });
});
