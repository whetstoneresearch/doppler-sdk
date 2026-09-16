import {
  address,
  unixTimestamp,
  type Address,
  type ReadonlyUint8Array,
} from '@solana/kit';
import {
  AccountState,
  findAssociatedTokenPda,
  getTokenEncoder,
} from '@solana-program/token';
import { getSysvarClockEncoder, SYSVAR_CLOCK_ADDRESS } from '@solana/sysvars';
import { generateKeyPairSigner } from '@solana/signers';
import { describe, expect, it } from 'vitest';

import {
  dopplerLaunchHookV2,
  deriveSolanaFeeRehypothecationDeployment,
  feeRehypothecation,
  initializer,
} from '@/solana/index.js';
import type { FeeRehypothecationRpc } from '@/solana/feeRehypothecation/index.js';
import {
  getLaunchEncoder,
  getLaunchFeeStateEncoder,
  type LaunchArgs,
  type LaunchFeeStateArgs,
} from '@/solana/generated/initializer/index.js';
import {
  getClaimFeesInstructionDataDecoder,
  getRehypeStateEncoder,
  getSettleFeesInstructionDataDecoder,
  type RehypeStateArgs,
} from '@/solana/generated/dopplerRehypeRouterV1/index.js';
import {
  SYSTEM_PROGRAM_ADDRESS,
  TOKEN_PROGRAM_ADDRESS,
  TOKEN_2022_PROGRAM_ADDRESS,
} from '@/solana/core/constants.js';
import { mintBytes, uncappedFee, type FeeSchedule } from './mintFixtures.js';

type RpcAccount = {
  data: [string, 'base64'];
  executable: boolean;
  lamports: bigint;
  owner: Address;
  space: bigint;
};

function encodeRpcAccount(
  data: ReadonlyUint8Array,
  owner: Address,
): RpcAccount {
  return {
    data: [Buffer.from(Uint8Array.from(data)).toString('base64'), 'base64'],
    executable: false,
    lamports: 1n,
    owner,
    space: BigInt(data.length),
  };
}

function payloadBuffer(bytes = new Uint8Array()): {
  len: number;
  bytes: Uint8Array;
} {
  const storage = new Uint8Array(256);
  storage.set(bytes);
  return { len: bytes.length, bytes: storage };
}

type SettlementFixtureOptions = {
  quoteToken2022?: boolean;
  transferFees?: { older: FeeSchedule; newer: FeeSchedule };
  epoch?: bigint;
  feeState?: Partial<LaunchFeeStateArgs>;
  routingState?: Partial<RehypeStateArgs>;
  launch?: Partial<LaunchArgs>;
  routerBaseBalance?: bigint;
  routerQuoteBalance?: bigint;
};

async function settlementFixture(options: SettlementFixtureOptions = {}) {
  const payer = await generateKeyPairSigner();
  const baseMint = await generateKeyPairSigner();
  const quoteMint = address('So11111111111111111111111111111111111111112');
  const quoteTokenProgram =
    options.quoteToken2022 || options.transferFees
      ? TOKEN_2022_PROGRAM_ADDRESS
      : TOKEN_PROGRAM_ADDRESS;
  const baseVault = address('SysvarRecentB1ockHashes11111111111111111111');
  const quoteVault = address('SysvarS1otHashes111111111111111111111111111');
  const namespace = SYSTEM_PROGRAM_ADDRESS;
  const launchId = initializer.launchIdFromU64(42n);
  const deployment = await deriveSolanaFeeRehypothecationDeployment();
  const [launch, launchBump] = await initializer.getLaunchAddress(
    namespace,
    launchId,
    deployment.initializerProgram,
  );
  const [launchAuthority, launchAuthorityBump] =
    await initializer.getLaunchAuthorityAddress(
      launch,
      deployment.initializerProgram,
    );
  const [launchFeeState, launchFeeStateBump] =
    await initializer.getLaunchFeeStateAddress(
      launch,
      deployment.initializerProgram,
    );
  const routingAddresses =
    await feeRehypothecation.deriveFeeRehypothecationAddresses(
      baseMint.address,
      deployment.dopplerRehypeRouterV1Program,
    );
  const [, routingStateBump] =
    await feeRehypothecation.getFeeRehypothecationStateAddress(
      baseMint.address,
      deployment.dopplerRehypeRouterV1Program,
    );
  const [, routingAuthorityBump] =
    await feeRehypothecation.getFeeRehypothecationAuthorityAddress(
      routingAddresses.state,
      deployment.dopplerRehypeRouterV1Program,
    );
  const [, settlementSignerBump] =
    await feeRehypothecation.getFeeRehypothecationSettlementSignerAddress(
      routingAddresses.state,
      deployment.dopplerRehypeRouterV1Program,
    );
  const strategy = feeRehypothecation.allFeesToBeneficiariesInNumeraire();
  const hookPayload = dopplerLaunchHookV2.encodeDopplerLaunchHookV2Payload({
    cosignerGate: {
      mode: dopplerLaunchHookV2.DOPPLER_LAUNCH_HOOK_V2_GATE_UNIX_TIMESTAMP,
      value: 1_000n,
      cosigner: payer.address,
    },
    feeRehypothecationState: routingAddresses.state,
  });
  const emptyInitializerBeneficiary = {
    wallet: SYSTEM_PROGRAM_ADDRESS,
    shareBps: 0,
    pad: new Uint8Array(6),
  };
  const emptyRoutingBeneficiary = {
    wallet: SYSTEM_PROGRAM_ADDRESS,
    shareBps: 0,
    padding: new Uint8Array(6),
  };

  const launchData = getLaunchEncoder().encode({
    authority: payer.address,
    namespace,
    launchId,
    phase: initializer.PHASE_TRADING,
    bump: launchBump,
    launchAuthorityBump,
    pad0: new Uint8Array(5),
    baseMint: baseMint.address,
    quoteMint,
    baseVault,
    quoteVault,
    baseTotalSupply: 1_000_000n,
    baseForDistribution: 0n,
    baseForLiquidity: 0n,
    baseForCurve: 1_000_000n,
    curveVirtualBase: 100n,
    curveVirtualQuote: 200n,
    swapFeeBps: 200,
    pad1: new Uint8Array(6),
    allowBuy: 1,
    allowSell: 1,
    pad2: new Uint8Array(6),
    hookProgram: deployment.dopplerLaunchHookV2Program,
    hookFlags:
      initializer.HF_BEFORE_CREATE |
      initializer.HF_BEFORE_SWAP |
      initializer.HF_BEFORE_MIGRATE |
      initializer.HF_FORWARD_READONLY_SIGNERS |
      initializer.HF_LAUNCH_CONTEXT_V2,
    pad3: new Uint8Array(4),
    hookPayload: payloadBuffer(hookPayload),
    migratorProgram: SYSTEM_PROGRAM_ADDRESS,
    migratorInitPayload: payloadBuffer(),
    migratorMigratePayload: payloadBuffer(),
    curveKind: initializer.CURVE_KIND_XYK,
    swapLock: 0,
    pad4: new Uint8Array(5),
    curveParams: payloadBuffer(
      new Uint8Array([initializer.CURVE_PARAMS_FORMAT_XYK_V0]),
    ),
    vestingEnabled: 0,
    createdAt: 0n,
    reserved: new Uint8Array(64),
    ...options.launch,
  });
  const launchFeeStateData = getLaunchFeeStateEncoder().encode({
    launch,
    beneficiaryLen: 1,
    bump: launchFeeStateBump,
    protocolFeeBps: 500,
    swapFeeBps: 200,
    version: 1,
    pad0: new Uint8Array(1),
    beneficiaries: [
      {
        wallet: routingAddresses.authority,
        shareBps: 10_000,
        pad: new Uint8Array(6),
      },
      ...Array.from({ length: 7 }, () => emptyInitializerBeneficiary),
    ],
    cumulatedBaseFees: 100n,
    cumulatedQuoteFees: 200n,
    distributedProtocolBaseFees: 0n,
    distributedProtocolQuoteFees: 0n,
    distributedBaseByBeneficiary: Array<bigint>(8).fill(0n),
    distributedQuoteByBeneficiary: Array<bigint>(8).fill(0n),
    reserved: new Uint8Array(128),
    ...options.feeState,
  });
  const routingStateData = getRehypeStateEncoder().encode({
    launch,
    baseMint: baseMint.address,
    quoteMint,
    hookProgram: deployment.dopplerLaunchHookV2Program,
    buybackDestination: payer.address,
    feeRouting: strategy.feeRouting,
    beneficiaries: [
      {
        wallet: payer.address,
        shareBps: 10_000,
        padding: new Uint8Array(6),
      },
      ...Array.from({ length: 7 }, () => emptyRoutingBeneficiary),
    ],
    cumulativeBeneficiaryBase: 0n,
    cumulativeBeneficiaryQuote: 50n,
    distributedBaseByBeneficiary: Array<bigint>(8).fill(0n),
    distributedQuoteByBeneficiary: Array<bigint>(8).fill(0n),
    pendingCrossBase: 0n,
    pendingCrossQuote: 0n,
    pendingLpBase: 0n,
    pendingLpQuote: 0n,
    inflightAmountIn: 0n,
    inflightExpectedAmountOut: 0n,
    version: 1,
    bump: routingStateBump,
    authorityBump: routingAuthorityBump,
    settlementSignerBump,
    routingMode: strategy.routingMode,
    beneficiaryCount: 1,
    inflightKind: 0,
    inflightDirection: 0,
    reservedSettlementAuthority: new Uint8Array(32),
    cumulativeRoutedBaseFees: 0n,
    cumulativeRoutedQuoteFees: 0n,
    settledInitializerBaseFees: 0n,
    settledInitializerQuoteFees: 0n,
    reserved: new Uint8Array(8),
    ...options.routingState,
  });

  const accounts = new Map<Address, RpcAccount>([
    [launch, encodeRpcAccount(launchData, deployment.initializerProgram)],
    [
      launchFeeState,
      encodeRpcAccount(launchFeeStateData, deployment.initializerProgram),
    ],
    [
      routingAddresses.state,
      encodeRpcAccount(
        routingStateData,
        deployment.dopplerRehypeRouterV1Program,
      ),
    ],
    [baseMint.address, encodeRpcAccount(mintBytes(), TOKEN_PROGRAM_ADDRESS)],
    [
      quoteMint,
      encodeRpcAccount(mintBytes(options.transferFees), quoteTokenProgram),
    ],
    [
      SYSVAR_CLOCK_ADDRESS,
      encodeRpcAccount(
        getSysvarClockEncoder().encode({
          slot: 1n,
          epoch: options.epoch ?? 1n,
          leaderScheduleEpoch: 1n,
          epochStartTimestamp: unixTimestamp(0n),
          unixTimestamp: unixTimestamp(0n),
        }),
        address('Sysvar1111111111111111111111111111111111111'),
      ),
    ],
    [
      baseVault,
      encodeRpcAccount(
        getTokenEncoder().encode({
          mint: baseMint.address,
          owner: launchAuthority,
          amount:
            1_000n +
            BigInt(options.feeState?.cumulatedBaseFees ?? 100n) -
            BigInt(options.feeState?.distributedBaseByBeneficiary?.[0] ?? 0n),
          delegate: null,
          state: AccountState.Initialized,
          isNative: null,
          delegatedAmount: 0n,
          closeAuthority: null,
        }),
        TOKEN_PROGRAM_ADDRESS,
      ),
    ],
    [
      quoteVault,
      encodeRpcAccount(
        getTokenEncoder().encode({
          mint: quoteMint,
          owner: launchAuthority,
          amount:
            2_000n +
            BigInt(options.feeState?.cumulatedQuoteFees ?? 200n) -
            BigInt(options.feeState?.distributedQuoteByBeneficiary?.[0] ?? 0n),
          delegate: null,
          state: AccountState.Initialized,
          isNative: null,
          delegatedAmount: 0n,
          closeAuthority: null,
        }),
        quoteTokenProgram,
      ),
    ],
  ]);
  for (const [mint, tokenProgram, balance] of [
    [baseMint.address, TOKEN_PROGRAM_ADDRESS, options.routerBaseBalance],
    [quoteMint, quoteTokenProgram, options.routerQuoteBalance ?? 50n],
  ] as const) {
    if (balance === undefined) continue;
    const [ata] = await findAssociatedTokenPda({
      owner: routingAddresses.authority,
      mint,
      tokenProgram,
    });
    accounts.set(
      ata,
      encodeRpcAccount(
        getTokenEncoder().encode({
          mint,
          owner: routingAddresses.authority,
          amount: balance,
          delegate: null,
          state: AccountState.Initialized,
          isNative: null,
          delegatedAmount: 0n,
          closeAuthority: null,
        }),
        tokenProgram,
      ),
    );
  }
  let snapshotFetches = 0;
  const rpc = {
    getAccountInfo: (account: Address) => ({
      send: async () => ({ value: accounts.get(account) ?? null }),
    }),
    getMultipleAccounts: (addresses: readonly Address[]) => ({
      send: async () => {
        snapshotFetches += 1;
        return {
          value: addresses.map((account) => accounts.get(account) ?? null),
        };
      },
    }),
  } as unknown as FeeRehypothecationRpc;

  return {
    rpc,
    deployment,
    launch,
    payer,
    baseMint,
    launchAuthority,
    snapshotFetches: () => snapshotFetches,
  };
}

describe('fee rehypothecation settlement preparation', () => {
  it('quotes settlement from account state and prepares a beneficiary claim', async () => {
    const {
      rpc,
      deployment,
      launch,
      payer,
      baseMint,
      launchAuthority,
      snapshotFetches,
    } = await settlementFixture();

    const settlement = await feeRehypothecation.prepareSettlement({
      rpc,
      deployment,
      launch,
      payer,
    });
    const settlementData = getSettleFeesInstructionDataDecoder().decode(
      settlement.instruction.data!,
    );

    expect(settlement.quote).toEqual({
      claimedBaseFees: 95n,
      claimedQuoteFees: 190n,
      baseToQuoteAmountIn: 95n,
      baseToQuoteExpectedAmountOut: 174n,
      minBaseToQuoteOut: 173n,
      quoteToBaseAmountIn: 0n,
      quoteToBaseExpectedAmountOut: 0n,
      minQuoteToBaseOut: 0n,
    });
    expect(settlementData.minBaseToQuoteOut).toBe(173n);
    expect(settlementData.minQuoteToBaseOut).toBe(0n);
    expect(settlement.instruction.accounts![5].address).toBe(launchAuthority);
    expect(settlement.instruction.accounts![25].address).toBe(payer.address);
    expect(settlement.instruction.accounts![26].address).toBe(
      (
        await dopplerLaunchHookV2.getDopplerLaunchHookV2CosignGateControlAddress(
          launch,
        )
      )[0],
    );
    expect(snapshotFetches()).toBe(2);

    const claim = await feeRehypothecation.prepareClaim({
      rpc,
      deployment,
      baseMint: baseMint.address,
      beneficiary: payer.address,
      payer,
    });
    expect(claim.pendingBaseFees).toBe(0n);
    expect(claim.pendingQuoteFees).toBe(50n);
    expect(
      getClaimFeesInstructionDataDecoder().decode(claim.instruction.data!)
        .beneficiaryIndex,
    ).toBe(0);
  });

  it('preserves ordinary Token-2022 quote results without transfer fees', async () => {
    const fixture = await settlementFixture({ quoteToken2022: true });
    const { quote } = await feeRehypothecation.prepareSettlement(fixture);
    expect(quote.claimedQuoteFees).toBe(190n);
    expect(quote.baseToQuoteExpectedAmountOut).toBe(174n);
  });

  it('protects the net quote receipt instead of requiring an unattainable gross output', async () => {
    const fixture = await settlementFixture({
      transferFees: { older: uncappedFee, newer: uncappedFee },
    });
    const settlement = await feeRehypothecation.prepareSettlement(fixture);
    expect(settlement.quote.claimedBaseFees).toBe(95n);
    expect(settlement.quote.claimedQuoteFees).toBe(185n);
    expect(settlement.quote.baseToQuoteExpectedAmountOut).toBe(169n);
    expect(settlement.quote.minBaseToQuoteOut).toBe(168n);
    expect(
      getSettleFeesInstructionDataDecoder().decode(settlement.instruction.data!)
        .minBaseToQuoteOut,
    ).toBe(168n);
    await expect(
      feeRehypothecation.prepareSettlement({
        ...fixture,
        minBaseToQuoteOut: 170n,
      }),
    ).rejects.toThrow(/incompatible/);
    expect(
      (
        await feeRehypothecation.prepareSettlement({
          ...fixture,
          minBaseToQuoteOut: 169n,
        })
      ).quote.minBaseToQuoteOut,
    ).toBe(169n);
  });

  it('charges quote transfer fees on both the claim and the quote-to-base swap input', async () => {
    const fixture = await settlementFixture({
      transferFees: { older: uncappedFee, newer: uncappedFee },
      routingState: {
        feeRouting:
          feeRehypothecation.allFeesToBeneficiariesInAsset().feeRouting,
      },
    });
    const { quote } = await feeRehypothecation.prepareSettlement(fixture);
    expect(quote.quoteToBaseAmountIn).toBe(185n);
    // 190 gross claimed -> 185 received -> 180 enters the curve -> floor(1100 * 180 / 2380).
    expect(quote.quoteToBaseExpectedAmountOut).toBe(83n);
  });

  it('updates sequential reserves using gross vault output rather than the net receipt', async () => {
    const fixture = await settlementFixture({
      transferFees: { older: uncappedFee, newer: uncappedFee },
      routingState: {
        feeRouting: {
          assetFees:
            feeRehypothecation.allFeesToBeneficiariesInNumeraire().feeRouting
              .assetFees,
          numeraireFees:
            feeRehypothecation.allFeesToBeneficiariesInAsset().feeRouting
              .numeraireFees,
        },
      },
    });
    const { quote } = await feeRehypothecation.prepareSettlement(fixture);
    expect(quote.baseToQuoteExpectedAmountOut).toBe(169n);
    // First swap removes 174 from the vault, although only 169 reaches the router.
    expect(quote.quoteToBaseExpectedAmountOut).toBe(97n);
  });

  it.each([
    { epoch: 9n, received: 185n, output: 169n },
    { epoch: 10n, received: 171n, output: 156n },
  ])(
    'uses the fee schedule active at epoch $epoch',
    async ({ epoch, received, output }) => {
      const fixture = await settlementFixture({
        epoch,
        transferFees: {
          older: uncappedFee,
          newer: { ...uncappedFee, epoch: 10n, basisPoints: 1000 },
        },
      });
      const { quote } = await feeRehypothecation.prepareSettlement(fixture);
      expect(quote.claimedQuoteFees).toBe(received);
      expect(quote.baseToQuoteExpectedAmountOut).toBe(output);
    },
  );

  it('caps the fee on each transfer independently', async () => {
    const capped = { ...uncappedFee, maximumFee: 1n };
    const fixture = await settlementFixture({
      transferFees: { older: capped, newer: capped },
      routingState: {
        feeRouting:
          feeRehypothecation.allFeesToBeneficiariesInAsset().feeRouting,
      },
    });
    const { quote } = await feeRehypothecation.prepareSettlement(fixture);
    expect(quote.claimedQuoteFees).toBe(189n);
    expect(quote.quoteToBaseExpectedAmountOut).toBe(86n);
  });

  it('settles previously claimed receipts without taxing them again or spending old beneficiary funds', async () => {
    const fixture = await settlementFixture({
      transferFees: { older: uncappedFee, newer: uncappedFee },
      feeState: {
        distributedBaseByBeneficiary: [95n, ...Array<bigint>(7).fill(0n)],
        distributedQuoteByBeneficiary: [190n, ...Array<bigint>(7).fill(0n)],
      },
      routerBaseBalance: 95n,
      routerQuoteBalance: 235n,
    });
    const { quote } = await feeRehypothecation.prepareSettlement(fixture);
    expect(quote.claimedBaseFees).toBe(95n);
    expect(quote.claimedQuoteFees).toBe(185n);
    expect(quote.baseToQuoteExpectedAmountOut).toBe(169n);
  });

  it('combines prior receipts with net newly claimed fees', async () => {
    const fixture = await settlementFixture({
      transferFees: { older: uncappedFee, newer: uncappedFee },
      feeState: {
        distributedBaseByBeneficiary: [45n, ...Array<bigint>(7).fill(0n)],
        distributedQuoteByBeneficiary: [100n, ...Array<bigint>(7).fill(0n)],
      },
      routerBaseBalance: 45n,
      routerQuoteBalance: 147n,
    });
    const { quote } = await feeRehypothecation.prepareSettlement(fixture);
    expect(quote.claimedBaseFees).toBe(95n);
    expect(quote.claimedQuoteFees).toBe(184n);
  });

  it('caps spendable receipts at gross unsettled fees even if the router receives donations', async () => {
    const fixture = await settlementFixture({
      routerBaseBalance: 1000n,
      routerQuoteBalance: 1000n,
    });
    const { quote } = await feeRehypothecation.prepareSettlement(fixture);
    expect(quote.claimedBaseFees).toBe(95n);
    expect(quote.claimedQuoteFees).toBe(190n);
  });

  it('rejects settled fees and insolvent beneficiary liabilities', async () => {
    const settled = await settlementFixture({
      routingState: {
        settledInitializerBaseFees: 95n,
        settledInitializerQuoteFees: 190n,
      },
    });
    await expect(feeRehypothecation.prepareSettlement(settled)).rejects.toThrow(
      /no fees/,
    );
    const insolvent = await settlementFixture({
      routingState: { cumulativeBeneficiaryQuote: 500n },
    });
    await expect(
      feeRehypothecation.prepareSettlement(insolvent),
    ).rejects.toThrow(/does not cover/);
  });

  it('allows a zero-net fully taxed claim to be marked settled', async () => {
    const fullTax = { ...uncappedFee, basisPoints: 10000 };
    const fixture = await settlementFixture({
      transferFees: { older: fullTax, newer: fullTax },
      feeState: { cumulatedBaseFees: 0n },
    });
    const { quote } = await feeRehypothecation.prepareSettlement(fixture);
    expect(quote.claimedBaseFees).toBe(0n);
    expect(quote.claimedQuoteFees).toBe(0n);
    expect(quote.minBaseToQuoteOut).toBe(0n);
    expect(quote.minQuoteToBaseOut).toBe(0n);
  });

  it('rejects a conversion whose output is fully withheld instead of disabling slippage protection', async () => {
    const fullTax = { ...uncappedFee, basisPoints: 10000 };
    const fixture = await settlementFixture({
      transferFees: { older: fullTax, newer: fullTax },
    });
    await expect(feeRehypothecation.prepareSettlement(fixture)).rejects.toThrow(
      /no spendable settlement output/,
    );
  });
});
