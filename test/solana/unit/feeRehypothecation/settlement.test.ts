import { address, type Address, type ReadonlyUint8Array } from '@solana/kit';
import { AccountState, getTokenEncoder } from '@solana-program/token';
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
} from '@/solana/generated/initializer/index.js';
import {
  getClaimFeesInstructionDataDecoder,
  getRehypeStateEncoder,
  getSettleFeesInstructionDataDecoder,
} from '@/solana/generated/dopplerRehypeRouterV1/index.js';
import {
  SYSTEM_PROGRAM_ADDRESS,
  TOKEN_PROGRAM_ADDRESS,
} from '@/solana/core/constants.js';

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

describe('fee rehypothecation settlement preparation', () => {
  it('quotes settlement from account state and prepares a beneficiary claim', async () => {
    const payer = await generateKeyPairSigner();
    const baseMint = await generateKeyPairSigner();
    const quoteMint = address('So11111111111111111111111111111111111111112');
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
      pad4: new Uint8Array(6),
      curveParams: payloadBuffer(
        new Uint8Array([initializer.CURVE_PARAMS_FORMAT_XYK_V0]),
      ),
      quoteDeposited: 0n,
      reserved: new Uint8Array(64),
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
      settlementAuthority: payer.address,
      cumulativeRoutedBaseFees: 0n,
      cumulativeRoutedQuoteFees: 0n,
      reserved: new Uint8Array(24),
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
      [
        baseMint.address,
        encodeRpcAccount(new Uint8Array(), TOKEN_PROGRAM_ADDRESS),
      ],
      [quoteMint, encodeRpcAccount(new Uint8Array(), TOKEN_PROGRAM_ADDRESS)],
      [
        baseVault,
        encodeRpcAccount(
          getTokenEncoder().encode({
            mint: baseMint.address,
            owner: launchAuthority,
            amount: 1_100n,
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
            amount: 2_200n,
            delegate: null,
            state: AccountState.Initialized,
            isNative: null,
            delegatedAmount: 0n,
            closeAuthority: null,
          }),
          TOKEN_PROGRAM_ADDRESS,
        ),
      ],
    ]);
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

    const settlement = await feeRehypothecation.prepareSettlement({
      rpc,
      deployment,
      launch,
      settlementAuthority: payer,
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
    expect(snapshotFetches).toBe(1);

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
});
