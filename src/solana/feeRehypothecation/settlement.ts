import {
  assertAccountsExist,
  fetchEncodedAccounts,
  type Address,
  type GetAccountInfoApi,
  type GetMultipleAccountsApi,
  type Instruction,
  type Rpc,
  type TransactionSigner,
  type MaybeEncodedAccount,
} from '@solana/kit';
import { decodeToken, findAssociatedTokenPda } from '@solana-program/token';
import { getSysvarClockDecoder, SYSVAR_CLOCK_ADDRESS } from '@solana/sysvars';

import {
  decodeDopplerLaunchHookV2Payload,
  DOPPLER_LAUNCH_HOOK_V2_FEATURE_MANUAL_COSIGN_DISABLE,
  getDopplerLaunchHookV2CosignGateControlAddress,
} from '../dopplerLaunchHookV2/index.js';
import {
  decodeLaunch,
  decodeLaunchFeeState,
  fetchLaunch,
} from '../generated/initializer/index.js';
import {
  decodeRehypeState,
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
import {
  getMintTransferFee,
  netTransferAmount,
  type TransferFee,
} from './transferFees.js';

type Commitment = 'processed' | 'confirmed' | 'finalized';

export type FeeRehypothecationRpc = Rpc<
  GetAccountInfoApi & GetMultipleAccountsApi
>;

export type PrepareFeeRehypothecationSettlementInput = {
  rpc: FeeRehypothecationRpc;
  launch: Address;
  payer: TransactionSigner;
  deployment?: SolanaFeeRehypothecationDeployment;
  slippageBps?: number;
  minBaseToQuoteOut?: bigint;
  minQuoteToBaseOut?: bigint;
  commitment?: Commitment;
};

export type FeeRehypothecationSettlementQuote = {
  /** Spendable fees to settle, including previously claimed but unsettled receipts. */
  claimedBaseFees: bigint;
  claimedQuoteFees: bigint;
  baseToQuoteAmountIn: bigint;
  /** Expected receipt in the router, after the output token's transfer fee. */
  baseToQuoteExpectedAmountOut: bigint;
  minBaseToQuoteOut: bigint;
  quoteToBaseAmountIn: bigint;
  /** Expected receipt in the router, after the output token's transfer fee. */
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

function routerTokenBalance(
  account: MaybeEncodedAccount,
  mint: Address,
  authority: Address,
  tokenProgram: Address,
): bigint {
  if (!account.exists) return 0n;
  const token = decodeToken(account);
  if (
    token.programAddress !== tokenProgram ||
    token.data.mint !== mint ||
    token.data.owner !== authority
  ) {
    throw new Error('router token account does not match the launch');
  }
  return token.data.amount;
}

function spendableFeesToSettle(
  balance: bigint,
  newlyReceived: bigint,
  cumulativeBeneficiaryFees: bigint,
  distributedBeneficiaryFees: ReadonlyArray<bigint>,
  grossUnsettled: bigint,
): bigint {
  const outstanding =
    cumulativeBeneficiaryFees -
    distributedBeneficiaryFees.reduce((sum, amount) => sum + amount, 0n);
  const available = balance + newlyReceived - outstanding;
  if (outstanding < 0n || available < 0n)
    throw new Error('router balance does not cover beneficiary fees');
  return available < grossUnsettled ? available : grossUnsettled;
}

function quoteSettlementSwap(
  input: Parameters<typeof quoteZeroFeeExactIn>[0],
  inputFee: TransferFee | undefined,
  outputFee: TransferFee | undefined,
) {
  // The router checks the untaxed preview first and falls back to in-kind fees if it is zero.
  if (input.amountIn === 0n || quoteZeroFeeExactIn(input) === 0n) {
    return { netAmountIn: 0n, grossAmountOut: 0n, netAmountOut: 0n };
  }
  const netAmountIn = netTransferAmount(input.amountIn, inputFee);
  if (netAmountIn === 0n)
    throw new Error('transfer fee leaves no spendable settlement input');
  const grossAmountOut = quoteZeroFeeExactIn({
    ...input,
    amountIn: netAmountIn,
  });
  const netAmountOut = netTransferAmount(grossAmountOut, outputFee);
  if (netAmountOut === 0n)
    throw new Error(
      'transfer fee or rounding leaves no spendable settlement output',
    );
  return { netAmountIn, grossAmountOut, netAmountOut };
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
  const discoveredLaunch = await fetchLaunch(input.rpc, input.launch, {
    commitment,
  });
  const routingAddresses = await deriveFeeRehypothecationAddresses(
    discoveredLaunch.data.baseMint,
    deployment.dopplerRehypeRouterV1Program,
  );
  const [launchFeeState] = await getLaunchFeeStateAddress(
    input.launch,
    deployment.initializerProgram,
  );
  const [launchAuthority] = await getLaunchAuthorityAddress(
    input.launch,
    deployment.initializerProgram,
  );

  const discoveredMints = await fetchEncodedAccounts(
    input.rpc,
    [discoveredLaunch.data.baseMint, discoveredLaunch.data.quoteMint],
    { commitment },
  );
  assertAccountsExist(discoveredMints);
  const [baseTokenProgram, quoteTokenProgram] = discoveredMints.map(
    (mint) => mint.programAddress,
  );
  const [[routerBaseAta], [routerQuoteAta]] = await Promise.all([
    findAssociatedTokenPda({
      owner: routingAddresses.authority,
      mint: discoveredLaunch.data.baseMint,
      tokenProgram: baseTokenProgram,
    }),
    findAssociatedTokenPda({
      owner: routingAddresses.authority,
      mint: discoveredLaunch.data.quoteMint,
      tokenProgram: quoteTokenProgram,
    }),
  ]);

  const [encodedRouterBase, encodedRouterQuote, ...snapshot] =
    await fetchEncodedAccounts(
      input.rpc,
      [
        routerBaseAta,
        routerQuoteAta,
        input.launch,
        launchFeeState,
        routingAddresses.state,
        discoveredLaunch.data.baseMint,
        discoveredLaunch.data.quoteMint,
        discoveredLaunch.data.baseVault,
        discoveredLaunch.data.quoteVault,
        SYSVAR_CLOCK_ADDRESS,
      ],
      { commitment },
    );
  assertAccountsExist(snapshot);
  const [
    launchAccount,
    encodedFeeState,
    encodedRoutingState,
    baseMintAccount,
    quoteMintAccount,
    encodedBaseVault,
    encodedQuoteVault,
    clockAccount,
  ] = snapshot;
  const launch = decodeLaunch(launchAccount).data;
  const feeStateAccount = decodeLaunchFeeState(encodedFeeState);
  const routingStateAccount = decodeRehypeState(encodedRoutingState);
  const baseVaultAccount = decodeToken(encodedBaseVault);
  const quoteVaultAccount = decodeToken(encodedQuoteVault);
  const epoch = getSysvarClockDecoder().decode(clockAccount.data).epoch;
  const baseTransferFee = getMintTransferFee(baseMintAccount, epoch);
  const quoteTransferFee = getMintTransferFee(quoteMintAccount, epoch);

  if (
    launch.phase !== PHASE_TRADING ||
    launch.hookProgram !== deployment.dopplerLaunchHookV2Program
  ) {
    throw new Error('launch is not an active fee rehypothecation launch');
  }
  const payload = decodeDopplerLaunchHookV2Payload(
    launch.hookPayload.bytes.slice(0, launch.hookPayload.len),
  );
  if (payload.feeRehypothecationState !== routingAddresses.state) {
    throw new Error('launch payload does not match its router state');
  }
  const cosignGateControl =
    (payload.featureFlags &
      DOPPLER_LAUNCH_HOOK_V2_FEATURE_MANUAL_COSIGN_DISABLE) !==
    0
      ? (
          await getDopplerLaunchHookV2CosignGateControlAddress(
            input.launch,
            deployment.dopplerLaunchHookV2Program,
          )
        )[0]
      : undefined;
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
    baseMintAccount.address !== launch.baseMint ||
    quoteMintAccount.address !== launch.quoteMint ||
    baseMintAccount.programAddress !== baseTokenProgram ||
    quoteMintAccount.programAddress !== quoteTokenProgram ||
    baseVaultAccount.address !== launch.baseVault ||
    quoteVaultAccount.address !== launch.quoteVault ||
    baseVaultAccount.programAddress !== baseTokenProgram ||
    quoteVaultAccount.programAddress !== quoteTokenProgram ||
    baseVaultAccount.data.mint !== launch.baseMint ||
    quoteVaultAccount.data.mint !== launch.quoteMint ||
    baseVaultAccount.data.owner !== launchAuthority ||
    quoteVaultAccount.data.owner !== launchAuthority
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
  const baseEntitlement = calculateInitializerBeneficiaryEntitlement(
    feeState.cumulatedBaseFees,
    feeState.protocolFeeBps,
    beneficiary.shareBps,
  );
  const quoteEntitlement = calculateInitializerBeneficiaryEntitlement(
    feeState.cumulatedQuoteFees,
    feeState.protocolFeeBps,
    beneficiary.shareBps,
  );
  const unclaimedBaseFees =
    baseEntitlement - feeState.distributedBaseByBeneficiary[0]!;
  const unclaimedQuoteFees =
    quoteEntitlement - feeState.distributedQuoteByBeneficiary[0]!;
  const unsettledBaseFees =
    baseEntitlement - routingState.settledInitializerBaseFees;
  const unsettledQuoteFees =
    quoteEntitlement - routingState.settledInitializerQuoteFees;
  if (
    unclaimedBaseFees < 0n ||
    unclaimedQuoteFees < 0n ||
    unsettledBaseFees < 0n ||
    unsettledQuoteFees < 0n
  ) {
    throw new Error('distributed router fees exceed its entitlement');
  }
  if (unsettledBaseFees === 0n && unsettledQuoteFees === 0n) {
    throw new Error('no fees are available to settle');
  }
  const claimedBaseFees = spendableFeesToSettle(
    routerTokenBalance(
      encodedRouterBase,
      launch.baseMint,
      routingAddresses.authority,
      baseTokenProgram,
    ),
    netTransferAmount(unclaimedBaseFees, baseTransferFee),
    routingState.cumulativeBeneficiaryBase,
    activeValues(
      routingState.distributedBaseByBeneficiary,
      routingState.beneficiaryCount,
    ),
    unsettledBaseFees,
  );
  const claimedQuoteFees = spendableFeesToSettle(
    routerTokenBalance(
      encodedRouterQuote,
      launch.quoteMint,
      routingAddresses.authority,
      quoteTokenProgram,
    ),
    netTransferAmount(unclaimedQuoteFees, quoteTransferFee),
    routingState.cumulativeBeneficiaryQuote,
    activeValues(
      routingState.distributedQuoteByBeneficiary,
      routingState.beneficiaryCount,
    ),
    unsettledQuoteFees,
  );

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
  let baseReserve =
    baseVaultAccount.data.amount -
    launch.baseForDistribution -
    launch.baseForLiquidity -
    pendingBaseFees;
  let quoteReserve = quoteVaultAccount.data.amount - pendingQuoteFees;
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
  const baseToQuote = quoteSettlementSwap(
    {
      amountIn: baseToQuoteAmountIn,
      reserveIn: baseReserve,
      reserveOut: quoteReserve,
      virtualIn: launch.curveVirtualBase,
      virtualOut: launch.curveVirtualQuote,
    },
    baseTransferFee,
    quoteTransferFee,
  );
  const baseToQuoteExpectedAmountOut = baseToQuote.netAmountOut;
  if (baseToQuote.grossAmountOut > 0n) {
    baseReserve += baseToQuote.netAmountIn;
    quoteReserve -= baseToQuote.grossAmountOut;
  }
  const quoteToBaseExpectedAmountOut = quoteSettlementSwap(
    {
      amountIn: quoteToBaseAmountIn,
      reserveIn: quoteReserve,
      reserveOut: baseReserve,
      virtualIn: launch.curveVirtualQuote,
      virtualOut: launch.curveVirtualBase,
    },
    quoteTransferFee,
    baseTransferFee,
  ).netAmountOut;
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
      payer: input.payer,
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
      cosignGateControl,
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
