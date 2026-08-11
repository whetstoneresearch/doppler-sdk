import {
  fetchEncodedAccount,
  type Address,
  type GetAccountInfoApi,
  type Instruction,
  type Rpc,
  type TransactionSigner,
} from '@solana/kit';
import { findAssociatedTokenPda } from '@solana-program/token';

import { decodeDopplerLaunchHookV2Payload } from '../dopplerLaunchHookV2/index.js';
import {
  fetchLaunch,
  fetchLaunchFeeState,
} from '../generated/initializer/index.js';
import {
  fetchRehypeState,
  getSettleFeesInstructionAsync,
} from '../dopplerRehypeRouterV1/index.js';
import {
  DOPPLER_SOLANA_DEVNET_FEE_REHYPOTHECATION_PROGRAM_ADDRESSES,
  deriveSolanaFeeRehypothecationDeployment,
  type SolanaFeeRehypothecationDeployment,
} from '../deployment.js';
import { PHASE_TRADING } from '../initializer/index.js';
import {
  getLaunchAuthorityAddress,
  getLaunchFeeStateAddress,
} from '../initializer/pda.js';
import {
  calculateInitializerBeneficiaryEntitlement,
  calculatePendingInitializerFees,
  quoteZeroFeeExactIn,
  resolveProtectedMinimumOutput,
  splitCumulativeFeeIncrement,
} from './math.js';
import { deriveFeeRehypothecationAddresses } from './pda.js';

type Commitment = 'processed' | 'confirmed' | 'finalized';

export type FeeRehypothecationRpc = Rpc<GetAccountInfoApi> & {
  getTokenAccountBalance(
    address: Address,
    config?: { commitment?: Commitment },
  ): { send(): Promise<{ value: { amount: string } }> };
};

export type PrepareFeeRehypothecationSettlementInput = {
  rpc: FeeRehypothecationRpc;
  launch: Address;
  settlementAuthority: TransactionSigner;
  deployment?: SolanaFeeRehypothecationDeployment;
  slippageBps?: number;
  minBaseToQuoteOut?: bigint;
  minQuoteToBaseOut?: bigint;
  commitment?: Commitment;
};

export type FeeRehypothecationSettlementQuote = {
  claimedBaseFees: bigint;
  claimedQuoteFees: bigint;
  baseToQuoteAmountIn: bigint;
  baseToQuoteExpectedAmountOut: bigint;
  minBaseToQuoteOut: bigint;
  quoteToBaseAmountIn: bigint;
  quoteToBaseExpectedAmountOut: bigint;
  minQuoteToBaseOut: bigint;
};

export type PrepareFeeRehypothecationSettlementResult = {
  instruction: Instruction;
  quote: FeeRehypothecationSettlementQuote;
  addresses: {
    state: Address;
    authority: Address;
    settlementSigner: Address;
    routerBaseAta: Address;
    routerQuoteAta: Address;
    buybackBaseAta: Address;
    buybackQuoteAta: Address;
  };
};

function activeValues<T>(values: ReadonlyArray<T>, count: number): T[] {
  return values.slice(0, count);
}

async function getMintProgram(
  rpc: Rpc<GetAccountInfoApi>,
  mint: Address,
  commitment: Commitment,
): Promise<Address> {
  const account = await fetchEncodedAccount(rpc, mint, { commitment });
  if (!account.exists) {
    throw new Error(`mint ${mint} does not exist`);
  }
  return account.programAddress;
}

export async function prepareSettlement(
  input: PrepareFeeRehypothecationSettlementInput,
): Promise<PrepareFeeRehypothecationSettlementResult> {
  const commitment = input.commitment ?? 'confirmed';
  const deployment =
    input.deployment ??
    (await deriveSolanaFeeRehypothecationDeployment(
      DOPPLER_SOLANA_DEVNET_FEE_REHYPOTHECATION_PROGRAM_ADDRESSES,
    ));
  const launchAccount = await fetchLaunch(input.rpc, input.launch, {
    commitment,
  });
  const launch = launchAccount.data;
  if (
    launch.phase !== PHASE_TRADING ||
    launch.hookProgram !== deployment.dopplerLaunchHookV2Program
  ) {
    throw new Error('launch is not an active fee rehypothecation launch');
  }

  const routingAddresses = await deriveFeeRehypothecationAddresses(
    launch.baseMint,
    deployment.dopplerRehypeRouterV1Program,
  );
  const payload = decodeDopplerLaunchHookV2Payload(
    launch.hookPayload.bytes.slice(0, launch.hookPayload.len),
  );
  if (payload.feeRehypothecationState !== routingAddresses.state) {
    throw new Error('launch payload does not match its router state');
  }

  const [launchFeeState] = await getLaunchFeeStateAddress(
    input.launch,
    deployment.initializerProgram,
  );
  const [launchAuthority] = await getLaunchAuthorityAddress(
    input.launch,
    deployment.initializerProgram,
  );

  const [
    feeStateAccount,
    routingStateAccount,
    baseTokenProgram,
    quoteTokenProgram,
  ] = await Promise.all([
    fetchLaunchFeeState(input.rpc, launchFeeState, {
      commitment,
    }),
    fetchRehypeState(input.rpc, routingAddresses.state, { commitment }),
    getMintProgram(input.rpc, launch.baseMint, commitment),
    getMintProgram(input.rpc, launch.quoteMint, commitment),
  ]);
  const feeState = feeStateAccount.data;
  const routingState = routingStateAccount.data;
  if (
    feeState.launch !== input.launch ||
    feeState.beneficiaryLen !== 1 ||
    feeState.beneficiaries[0]?.wallet !== routingAddresses.authority ||
    feeState.beneficiaries[0]?.shareBps !== 10_000 ||
    routingState.launch !== input.launch ||
    routingState.baseMint !== launch.baseMint ||
    routingState.quoteMint !== launch.quoteMint ||
    routingState.hookProgram !== launch.hookProgram ||
    routingState.settlementAuthority !== input.settlementAuthority.address
  ) {
    throw new Error('fee rehypothecation state does not match the launch');
  }
  if (
    routingState.pendingCrossBase !== 0n ||
    routingState.pendingCrossQuote !== 0n ||
    routingState.pendingLpBase !== 0n ||
    routingState.pendingLpQuote !== 0n ||
    routingState.inflightKind !== 0 ||
    routingState.inflightAmountIn !== 0n ||
    routingState.inflightExpectedAmountOut !== 0n
  ) {
    throw new Error('fee settlement is already in progress');
  }

  const beneficiary = feeState.beneficiaries[0];
  if (!beneficiary) {
    throw new Error('launch has no router fee beneficiary');
  }
  const claimedBaseFees =
    calculateInitializerBeneficiaryEntitlement(
      feeState.cumulatedBaseFees,
      feeState.protocolFeeBps,
      beneficiary.shareBps,
    ) - feeState.distributedBaseByBeneficiary[0]!;
  const claimedQuoteFees =
    calculateInitializerBeneficiaryEntitlement(
      feeState.cumulatedQuoteFees,
      feeState.protocolFeeBps,
      beneficiary.shareBps,
    ) - feeState.distributedQuoteByBeneficiary[0]!;
  if (claimedBaseFees < 0n || claimedQuoteFees < 0n) {
    throw new Error('distributed router fees exceed its entitlement');
  }
  if (claimedBaseFees === 0n && claimedQuoteFees === 0n) {
    throw new Error('no fees are available to settle');
  }

  const pendingBaseFees = calculatePendingInitializerFees({
    cumulativeFees: feeState.cumulatedBaseFees,
    distributedProtocolFees: feeState.distributedProtocolBaseFees,
    distributedBeneficiaryFees: activeValues(
      feeState.distributedBaseByBeneficiary,
      feeState.beneficiaryLen,
    ),
  });
  const pendingQuoteFees = calculatePendingInitializerFees({
    cumulativeFees: feeState.cumulatedQuoteFees,
    distributedProtocolFees: feeState.distributedProtocolQuoteFees,
    distributedBeneficiaryFees: activeValues(
      feeState.distributedQuoteByBeneficiary,
      feeState.beneficiaryLen,
    ),
  });
  const [baseVaultBalance, quoteVaultBalance] = await Promise.all([
    input.rpc.getTokenAccountBalance(launch.baseVault, { commitment }).send(),
    input.rpc.getTokenAccountBalance(launch.quoteVault, { commitment }).send(),
  ]);
  let baseReserve =
    BigInt(baseVaultBalance.value.amount) -
    launch.baseForDistribution -
    launch.baseForLiquidity -
    pendingBaseFees;
  let quoteReserve = BigInt(quoteVaultBalance.value.amount) - pendingQuoteFees;
  if (baseReserve < 0n || quoteReserve < 0n) {
    throw new Error('launch vault balances are inconsistent with fee state');
  }

  const [, baseToQuoteAmountIn] = splitCumulativeFeeIncrement(
    routingState.feeRouting.assetFees,
    routingState.cumulativeRoutedBaseFees,
    claimedBaseFees,
  );
  const [quoteToBaseAmountIn] = splitCumulativeFeeIncrement(
    routingState.feeRouting.numeraireFees,
    routingState.cumulativeRoutedQuoteFees,
    claimedQuoteFees,
  );
  const baseToQuoteExpectedAmountOut =
    baseToQuoteAmountIn === 0n
      ? 0n
      : quoteZeroFeeExactIn({
          amountIn: baseToQuoteAmountIn,
          reserveIn: baseReserve,
          reserveOut: quoteReserve,
          virtualIn: launch.curveVirtualBase,
          virtualOut: launch.curveVirtualQuote,
        });
  if (baseToQuoteExpectedAmountOut > 0n) {
    baseReserve += baseToQuoteAmountIn;
    quoteReserve -= baseToQuoteExpectedAmountOut;
  }
  const quoteToBaseExpectedAmountOut =
    quoteToBaseAmountIn === 0n
      ? 0n
      : quoteZeroFeeExactIn({
          amountIn: quoteToBaseAmountIn,
          reserveIn: quoteReserve,
          reserveOut: baseReserve,
          virtualIn: launch.curveVirtualQuote,
          virtualOut: launch.curveVirtualBase,
        });
  const minBaseToQuoteOut = resolveProtectedMinimumOutput({
    expectedAmountOut: baseToQuoteExpectedAmountOut,
    minimumAmountOut: input.minBaseToQuoteOut,
    slippageBps: input.slippageBps,
  });
  const minQuoteToBaseOut = resolveProtectedMinimumOutput({
    expectedAmountOut: quoteToBaseExpectedAmountOut,
    minimumAmountOut: input.minQuoteToBaseOut,
    slippageBps: input.slippageBps,
  });

  const [routerBaseAta] = await findAssociatedTokenPda({
    owner: routingAddresses.authority,
    mint: launch.baseMint,
    tokenProgram: baseTokenProgram,
  });
  const [routerQuoteAta] = await findAssociatedTokenPda({
    owner: routingAddresses.authority,
    mint: launch.quoteMint,
    tokenProgram: quoteTokenProgram,
  });
  const [buybackBaseAta] = await findAssociatedTokenPda({
    owner: routingState.buybackDestination,
    mint: launch.baseMint,
    tokenProgram: baseTokenProgram,
  });
  const [buybackQuoteAta] = await findAssociatedTokenPda({
    owner: routingState.buybackDestination,
    mint: launch.quoteMint,
    tokenProgram: quoteTokenProgram,
  });
  const instruction = await getSettleFeesInstructionAsync(
    {
      settlementAuthority: input.settlementAuthority,
      initializerProgram: deployment.initializerProgram,
      initializerConfig: deployment.initializerConfig,
      launch: input.launch,
      launchFeeState: feeStateAccount.address,
      launchAuthority,
      baseMint: launch.baseMint,
      quoteMint: launch.quoteMint,
      baseVault: launch.baseVault,
      quoteVault: launch.quoteVault,
      rehypeState: routingAddresses.state,
      rehypeAuthority: routingAddresses.authority,
      settlementSigner: routingAddresses.settlementSigner,
      routerBaseAta,
      routerQuoteAta,
      buybackDestination: routingState.buybackDestination,
      buybackBaseAta,
      buybackQuoteAta,
      namespace: launch.namespace,
      hookConfig: deployment.dopplerLaunchHookV2Config,
      hookProgram: deployment.dopplerLaunchHookV2Program,
      baseTokenProgram,
      quoteTokenProgram,
      gateCosigner: payload.cosignerGate?.cosigner,
      minBaseToQuoteOut,
      minQuoteToBaseOut,
    },
    { programAddress: deployment.dopplerRehypeRouterV1Program },
  );

  return {
    instruction,
    quote: {
      claimedBaseFees,
      claimedQuoteFees,
      baseToQuoteAmountIn,
      baseToQuoteExpectedAmountOut,
      minBaseToQuoteOut,
      quoteToBaseAmountIn,
      quoteToBaseExpectedAmountOut,
      minQuoteToBaseOut,
    },
    addresses: {
      ...routingAddresses,
      routerBaseAta,
      routerQuoteAta,
      buybackBaseAta,
      buybackQuoteAta,
    },
  };
}
