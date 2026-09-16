import { getCurveSwapFeeAmount } from '../initializer/helpers.js';
import {
  assertAccountsExist,
  fetchEncodedAccounts,
  type Address,
  type Rpc,
  type GetAccountInfoApi,
  type GetMultipleAccountsApi,
  type GetProgramAccountsApi,
} from '@solana/kit';
import { decodeToken, TOKEN_PROGRAM_ADDRESS } from '@solana-program/token';
import * as initializer from '../initializer/index.js';
import * as generated from '../generated/initializer/index.js';
import * as prediction from '../migrators/predictionMigrator/index.js';
import * as oracleClient from '../trustedOracle/index.js';
import { calculatePendingInitializerFees } from '../initializer/fees.js';
import {
  fetchPredictionMarketWithLaunches,
  getPredictionMarketStatus,
  validatePredictionMarketAccounts,
  validateOwner,
  type PredictionOutcomeBinding,
} from './reads.js';
import { assertU64 } from './validation.js';
export type PredictionBuyQuote = {
  amountOut: bigint;
  feeAmount: bigint;
  minAmountOut: bigint;
};
/** Independent bonding-curve price; it is not a normalized probability. Reserves exclude pending fees. */
export function quoteBuy(input: {
  amountIn: bigint;
  baseReserve: bigint;
  quoteReserve: bigint;
  virtualBase: bigint;
  virtualQuote: bigint;
  swapFeeBps: number;
  slippageBps?: number;
}): PredictionBuyQuote {
  for (const [name, value] of Object.entries(input))
    if (typeof value === 'bigint') assertU64(value, name);
  const slippage = input.slippageBps ?? 50;
  if (!Number.isInteger(slippage) || slippage < 0 || slippage > 10000)
    throw new Error('slippageBps must be an integer from 0 to 10000');
  if (input.amountIn === 0n || input.virtualQuote === 0n)
    throw new Error('Input and virtual quote reserve must be positive');
  const feeAmount = getCurveSwapFeeAmount(input.amountIn, input.swapFeeBps);
  const net = input.amountIn - feeAmount;
  const amountOut =
    ((input.baseReserve + input.virtualBase) * net) /
    (input.quoteReserve + input.virtualQuote + net);
  if (amountOut === 0n || amountOut > input.baseReserve)
    throw new Error('Insufficient curve liquidity or input after fees');
  return {
    amountOut,
    feeAmount,
    minAmountOut: (amountOut * BigInt(10000 - slippage)) / 10000n,
  };
}

export type FetchPredictionBuyQuoteInput = {
  market: Address;
  baseMint: Address;
  amountIn: bigint;
  slippageBps?: number;
  /** Reuse a discovered launch address to avoid a creator-wide scan on every refresh. */
  launch?: Address;
};
export type FetchedPredictionBuyQuote = PredictionBuyQuote & {
  outcome: PredictionOutcomeBinding;
  oracle: Address;
  market: Address;
  pendingBaseFees: bigint;
  pendingQuoteFees: bigint;
};

/** Read price-sensitive state in one RPC snapshot, excluding reserved launch fees. */
export async function fetchPredictionBuyQuote(
  rpc: Rpc<GetAccountInfoApi & GetMultipleAccountsApi & GetProgramAccountsApi>,
  input: FetchPredictionBuyQuoteInput,
): Promise<FetchedPredictionBuyQuote> {
  let launch: initializer.LaunchWithAddress;
  if (input.launch) {
    const account = await generated.fetchLaunch(rpc, input.launch, {
      commitment: 'confirmed',
    });
    validateOwner(account, initializer.INITIALIZER_PROGRAM_ID);
    launch = { address: account.address, account: account.data };
  } else {
    const view = await fetchPredictionMarketWithLaunches(rpc, input.market);
    const outcome = view.outcomes.find(
      (candidate) => candidate.entry.data.baseMint === input.baseMint,
    );
    if (!outcome) throw new Error('Mint is not registered in market');
    launch = outcome.launch;
  }
  const [[launchAuthority], [launchFeeState], [config], [entryAddress]] =
    await Promise.all([
      initializer.getLaunchAuthorityAddress(launch.address),
      initializer.getLaunchFeeStateAddress(launch.address),
      initializer.getConfigAddress(),
      prediction.getPredictionEntryAddress(input.market, input.baseMint),
    ]);
  const snapshot = await fetchEncodedAccounts(
    rpc,
    [
      input.market,
      launch.account.namespace,
      launch.address,
      launchFeeState,
      input.baseMint,
      launch.account.quoteMint,
      launch.account.baseVault,
      launch.account.quoteVault,
      entryAddress,
    ],
    { commitment: 'confirmed' },
  );
  assertAccountsExist(snapshot);
  const [
    rawMarket,
    rawOracle,
    rawLaunch,
    rawFees,
    baseMint,
    quoteMint,
    rawBaseVault,
    rawQuoteVault,
    rawEntry,
  ] = snapshot;
  const market = prediction.decodeMarket(rawMarket);
  const oracle = oracleClient.decodeOracleState(rawOracle);
  const currentLaunch = generated.decodeLaunch(rawLaunch);
  const feeState = generated.decodeLaunchFeeState(rawFees);
  const baseVault = decodeToken(rawBaseVault);
  const quoteVault = decodeToken(rawQuoteVault);
  const entry = prediction.decodeEntry(rawEntry);
  await validatePredictionMarketAccounts(market, oracle);
  const status = getPredictionMarketStatus(market.data, oracle.data);
  if (!status.canBuy) throw new Error('Market is not open for buys');
  validateOwner(currentLaunch, initializer.INITIALIZER_PROGRAM_ID);
  validateOwner(entry, prediction.PREDICTION_MIGRATOR_PROGRAM_ADDRESS);
  const [expectedLaunch] = await initializer.getLaunchAddress(
    currentLaunch.data.namespace,
    Uint8Array.from(currentLaunch.data.launchId),
  );
  const outcomeIndex = market.data.outcomeMints
    .slice(0, market.data.outcomeCount)
    .indexOf(input.baseMint);
  if (
    expectedLaunch !== launch.address ||
    !currentLaunch.data.discriminator.every(
      (byte, index) => byte === generated.LAUNCH_DISCRIMINATOR[index],
    ) ||
    currentLaunch.data.authority !== market.data.creator ||
    currentLaunch.data.namespace !== market.data.oracle ||
    currentLaunch.data.baseMint !== input.baseMint ||
    currentLaunch.data.quoteMint !== market.data.quoteMint ||
    currentLaunch.data.hookProgram !== initializer.PREDICTION_HOOK_PROGRAM_ID ||
    currentLaunch.data.migratorProgram !==
      prediction.PREDICTION_MIGRATOR_PROGRAM_ADDRESS ||
    entry.data.market !== input.market ||
    entry.data.baseMint !== input.baseMint ||
    !entry.data.discriminator.every(
      (byte, index) => byte === prediction.ENTRY_DISCRIMINATOR[index],
    ) ||
    outcomeIndex < 0 ||
    (market.data.registeredBitmap & (1 << outcomeIndex)) === 0
  )
    throw new Error('Invalid prediction launch binding');
  if (
    entry.data.isMigrated ||
    currentLaunch.data.phase !== initializer.PHASE_TRADING ||
    currentLaunch.data.allowBuy === 0
  )
    throw new Error('Outcome launch is not open for buys');
  if (currentLaunch.data.curveKind !== initializer.CURVE_KIND_XYK)
    throw new Error('Prediction buy quotes require an XYK curve');
  for (const account of [baseMint, quoteMint, baseVault, quoteVault])
    validateOwner(account, TOKEN_PROGRAM_ADDRESS);
  validateOwner(feeState, initializer.INITIALIZER_PROGRAM_ID);
  if (
    baseVault.address !== currentLaunch.data.baseVault ||
    quoteVault.address !== currentLaunch.data.quoteVault ||
    quoteMint.address !== currentLaunch.data.quoteMint ||
    baseVault.data.mint !== input.baseMint ||
    quoteVault.data.mint !== market.data.quoteMint ||
    baseVault.data.owner !== launchAuthority ||
    quoteVault.data.owner !== launchAuthority ||
    feeState.data.launch !== launch.address ||
    !feeState.data.discriminator.every(
      (byte, index) => byte === generated.LAUNCH_FEE_STATE_DISCRIMINATOR[index],
    )
  )
    throw new Error('Invalid launch reserves or fee state');
  const fee = feeState.data;
  if (
    fee.beneficiaryLen > fee.beneficiaries.length ||
    fee.swapFeeBps !== currentLaunch.data.swapFeeBps
  )
    throw new Error('Invalid beneficiary count or swap fee state');
  const pendingBaseFees = calculatePendingInitializerFees({
    cumulativeFees: fee.cumulatedBaseFees,
    distributedProtocolFees: fee.distributedProtocolBaseFees,
    distributedBeneficiaryFees: fee.distributedBaseByBeneficiary.slice(
      0,
      fee.beneficiaryLen,
    ),
  });
  const pendingQuoteFees = calculatePendingInitializerFees({
    cumulativeFees: fee.cumulatedQuoteFees,
    distributedProtocolFees: fee.distributedProtocolQuoteFees,
    distributedBeneficiaryFees: fee.distributedQuoteByBeneficiary.slice(
      0,
      fee.beneficiaryLen,
    ),
  });
  const reservedBase =
    currentLaunch.data.baseForDistribution +
    currentLaunch.data.baseForLiquidity;
  if (
    baseVault.data.amount < pendingBaseFees + reservedBase ||
    quoteVault.data.amount < pendingQuoteFees
  )
    throw new Error('Inconsistent reserve/fee snapshot; refresh state');
  return {
    ...quoteBuy({
      amountIn: input.amountIn,
      slippageBps: input.slippageBps,
      baseReserve: baseVault.data.amount - pendingBaseFees - reservedBase,
      quoteReserve: quoteVault.data.amount - pendingQuoteFees,
      virtualBase: currentLaunch.data.curveVirtualBase,
      virtualQuote: currentLaunch.data.curveVirtualQuote,
      swapFeeBps: currentLaunch.data.swapFeeBps,
    }),
    outcome: {
      entry,
      launch: { address: currentLaunch.address, account: currentLaunch.data },
      launchAuthority,
      launchFeeState,
      config,
    },
    oracle: market.data.oracle,
    market: input.market,
    pendingBaseFees,
    pendingQuoteFees,
  };
}
