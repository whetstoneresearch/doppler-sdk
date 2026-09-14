import {
  type Address,
  type Rpc,
  type GetAccountInfoApi,
  type GetMultipleAccountsApi,
  type GetProgramAccountsApi,
} from '@solana/kit';
import * as prediction from '../migrators/predictionMigrator/index.js';
import * as oracleClient from '../trustedOracle/index.js';
import {
  addressToBase58EncodedBytes,
  base64ToBytes,
  normalizeProgramAccountsResponse,
} from '../core/accounts.js';
import { assertOutcomeIds } from './validation.js';

export function getPredictionMarketStatus(
  market: prediction.Market,
  oracle: oracleClient.OracleState,
  entries: readonly prediction.Entry[] = [],
) {
  assertOutcomeIds(oracle.outcomeIds.slice(0, oracle.outcomeCount));
  if (market.outcomeCount !== oracle.outcomeCount)
    throw new Error('Market outcome count differs from oracle');
  if (
    market.registeredBitmap < 0 ||
    market.registeredBitmap > (1 << market.outcomeCount) - 1
  )
    throw new Error('Invalid registration bitmap');
  const missingOutcomeIndexes = Array.from(
    { length: oracle.outcomeCount },
    (_, i) => i,
  ).filter((i) => (market.registeredBitmap & (1 << i)) === 0);
  const unsettledMints = entries
    .filter((e) => !e.isMigrated)
    .map((e) => e.baseMint);
  const phase = missingOutcomeIndexes.length
    ? 'registering'
    : !oracle.isFinalized
      ? 'trading'
      : market.isVoid
        ? 'void'
        : market.isResolved && market.claimableSupply > 0n
          ? 'claimable'
          : 'settling';
  return {
    phase,
    missingOutcomeIndexes,
    unsettledMints,
    canBuy: phase === 'trading',
    canSettle: oracle.isFinalized && missingOutcomeIndexes.length === 0,
    canClaim: phase === 'claimable',
    canRefund: phase === 'void',
    allEntriesSettled:
      entries.length === market.outcomeCount && unsettledMints.length === 0,
  };
}
function validateOwner(account: { programAddress: Address }, owner: Address) {
  if (account.programAddress !== owner)
    throw new Error(`Unexpected account owner; expected ${owner}`);
}
/** Fetches known registered entries, avoiding a global scan for the common market view. */
export async function fetchPredictionMarket(
  rpc: Rpc<GetAccountInfoApi & GetMultipleAccountsApi>,
  marketAddress: Address,
) {
  const market = await prediction.fetchMarket(rpc, marketAddress, {
    commitment: 'confirmed',
  });
  validateOwner(market, prediction.PREDICTION_MIGRATOR_PROGRAM_ADDRESS);
  if (
    !market.data.discriminator.every(
      (v, i) => v === prediction.MARKET_DISCRIMINATOR[i],
    )
  )
    throw new Error('Invalid Market discriminator');
  const oracle = await oracleClient.fetchOracleState(rpc, market.data.oracle, {
    commitment: 'confirmed',
  });
  validateOwner(oracle, oracleClient.TRUSTED_ORACLE_PROGRAM_ADDRESS);
  if (
    !oracle.data.discriminator.every(
      (v, i) => v === oracleClient.ORACLE_STATE_DISCRIMINATOR[i],
    )
  )
    throw new Error('Invalid OracleState discriminator');
  const [expectedMarket] = await prediction.getPredictionMarketAddress(
    market.data.oracle,
    market.data.quoteMint,
    market.data.creator,
  );
  if (expectedMarket !== marketAddress) throw new Error('Invalid market PDA');
  const [expectedOracle] = await oracleClient.getOracleStateAddress(
    oracle.data.oracleAuthority,
    oracle.data.nonce,
  );
  const [expectedPot] =
    await prediction.getPredictionPotVaultAddress(marketAddress);
  if (
    expectedOracle !== market.data.oracle ||
    expectedPot !== market.data.potVault
  )
    throw new Error('Invalid oracle or pot PDA');
  const entryAddresses = await Promise.all(
    market.data.outcomeMints
      .slice(0, market.data.outcomeCount)
      .filter((_, i) => (market.data.registeredBitmap & (1 << i)) !== 0)
      .map(
        async (mint) =>
          (await prediction.getPredictionEntryAddress(marketAddress, mint))[0],
      ),
  );
  const entries = await prediction.fetchAllEntry(rpc, entryAddresses, {
    commitment: 'confirmed',
  });
  for (const entry of entries) {
    const [expectedEntry] = await prediction.getPredictionEntryAddress(
      marketAddress,
      entry.data.baseMint,
    );
    if (expectedEntry !== entry.address) throw new Error('Invalid entry PDA');
    validateOwner(entry, prediction.PREDICTION_MIGRATOR_PROGRAM_ADDRESS);
    if (
      entry.data.market !== marketAddress ||
      !entry.data.discriminator.every(
        (v, i) => v === prediction.ENTRY_DISCRIMINATOR[i],
      )
    )
      throw new Error('Invalid market entry');
  }
  return {
    market,
    oracle,
    entries,
    status: getPredictionMarketStatus(
      market.data,
      oracle.data,
      entries.map((e) => e.data),
    ),
  };
}
/** Filtered discovery. Creator offset follows the fixed merged Market layout, including its discriminator. */
export async function listPredictionMarkets(
  rpc: Rpc<GetProgramAccountsApi>,
  filter: { creator?: Address; oracle?: Address } = {},
) {
  const filters = [
    { dataSize: 486n },
    ...(filter.oracle
      ? [
          {
            memcmp: {
              offset: 8n,
              bytes: addressToBase58EncodedBytes(filter.oracle),
              encoding: 'base58' as const,
            },
          },
        ]
      : []),
    ...(filter.creator
      ? [
          {
            memcmp: {
              offset: 195n,
              bytes: addressToBase58EncodedBytes(filter.creator),
              encoding: 'base58' as const,
            },
          },
        ]
      : []),
  ];
  const result = await rpc
    .getProgramAccounts(prediction.PREDICTION_MIGRATOR_PROGRAM_ADDRESS, {
      encoding: 'base64',
      filters,
    })
    .send();
  return normalizeProgramAccountsResponse(result)
    .map((a) => ({
      address: a.pubkey,
      data: prediction
        .getMarketDecoder()
        .decode(base64ToBytes(a.account.data[0])),
    }))
    .filter((a) =>
      a.data.discriminator.every(
        (v, i) => v === prediction.MARKET_DISCRIMINATOR[i],
      ),
    );
}
/** Reuse only an unfinalized oracle whose immutable outcome order exactly matches the requested book. */
export function assertReusableOracle(
  oracle: oracleClient.OracleState,
  outcomeIds: readonly Uint8Array[],
) {
  assertOutcomeIds(outcomeIds);
  if (oracle.isFinalized) throw new Error('Oracle is already finalized');
  if (
    oracle.outcomeCount !== outcomeIds.length ||
    outcomeIds.some((id, i) => id.some((v, j) => v !== oracle.outcomeIds[i][j]))
  )
    throw new Error('Oracle outcome set/order does not match');
}

/** Recover launch bindings by creator so callers need only a market address, not a saved manifest. */
export async function fetchPredictionMarketWithLaunches(
  rpc: Rpc<GetAccountInfoApi & GetMultipleAccountsApi & GetProgramAccountsApi>,
  marketAddress: Address,
) {
  const view = await fetchPredictionMarket(rpc, marketAddress);
  const candidates = await initializer.fetchLaunchesByAuthority(
    rpc,
    view.market.data.creator,
    { commitment: 'confirmed' },
  );
  const outcomes = await Promise.all(
    view.entries.map(async (entry) => {
      const matches = candidates.filter(
        (candidate) =>
          candidate.account.baseMint === entry.data.baseMint &&
          candidate.account.namespace === view.market.data.oracle &&
          candidate.account.quoteMint === view.market.data.quoteMint &&
          candidate.account.migratorProgram ===
            prediction.PREDICTION_MIGRATOR_PROGRAM_ADDRESS &&
          candidate.account.hookProgram ===
            initializer.PREDICTION_HOOK_PROGRAM_ID,
      );
      if (matches.length !== 1)
        throw new Error(
          `Expected one prediction launch for ${entry.data.baseMint}, found ${matches.length}`,
        );
      const launch = matches[0];
      const [expectedLaunch] = await initializer.getLaunchAddress(
        launch.account.namespace,
        Uint8Array.from(launch.account.launchId),
      );
      if (expectedLaunch !== launch.address)
        throw new Error('Invalid launch PDA');
      const [[launchAuthority], [launchFeeState], [config]] = await Promise.all(
        [
          initializer.getLaunchAuthorityAddress(launch.address),
          initializer.getLaunchFeeStateAddress(launch.address),
          initializer.getConfigAddress(),
        ],
      );
      return { entry, launch, launchAuthority, launchFeeState, config };
    }),
  );
  return { ...view, outcomes };
}
export async function fetchPredictionClaimReceipt(
  rpc: Rpc<GetAccountInfoApi>,
  market: Address,
  claimer: Address,
) {
  const [receipt] = await prediction.getPredictionClaimReceiptAddress(
    market,
    claimer,
  );
  const account = await prediction.fetchMaybeClaimReceipt(rpc, receipt, {
    commitment: 'confirmed',
  });
  if (!account.exists) return null;
  validateOwner(account, prediction.PREDICTION_MIGRATOR_PROGRAM_ADDRESS);
  if (
    account.data.market !== market ||
    account.data.claimer !== claimer ||
    !account.data.discriminator.every(
      (v, i) => v === prediction.CLAIM_RECEIPT_DISCRIMINATOR[i],
    )
  )
    throw new Error('Invalid prediction claim receipt');
  return account;
}
import * as initializer from '../initializer/index.js';
import * as initGenerated from '../generated/initializer/index.js';
import {
  fetchToken,
  fetchMint,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import { quoteBuy } from './quotes.js';
import { prepareSettlement } from './builders.js';
import type { TransactionSigner } from '@solana/kit';
/** Validates token ownership and reserve accounts and excludes fees reserved for beneficiaries. */
export async function fetchPredictionBuyQuote(
  rpc: Rpc<GetAccountInfoApi & GetMultipleAccountsApi & GetProgramAccountsApi>,
  input: {
    market: Address;
    baseMint: Address;
    amountIn: bigint;
    slippageBps?: number;
  },
) {
  const view = await fetchPredictionMarketWithLaunches(rpc, input.market);
  if (!view.status.canBuy) throw new Error('Market is not open for buys');
  const outcome = view.outcomes.find(
    (o) => o.entry.data.baseMint === input.baseMint,
  );
  if (!outcome) throw new Error('Mint is not registered in market');
  if (
    outcome.entry.data.isMigrated ||
    outcome.launch.account.phase !== initializer.PHASE_TRADING ||
    outcome.launch.account.allowBuy === 0
  )
    throw new Error('Outcome launch is not open for buys');
  if (outcome.launch.account.curveKind !== initializer.CURVE_KIND_XYK)
    throw new Error('Prediction buy quotes require an XYK curve');
  const [[baseMint, quoteMint], [baseVault, quoteVault], feeState] =
    await Promise.all([
      Promise.all([
        fetchMint(rpc, input.baseMint, { commitment: 'confirmed' }),
        fetchMint(rpc, view.market.data.quoteMint, { commitment: 'confirmed' }),
      ]),
      Promise.all([
        fetchToken(rpc, outcome.launch.account.baseVault, {
          commitment: 'confirmed',
        }),
        fetchToken(rpc, outcome.launch.account.quoteVault, {
          commitment: 'confirmed',
        }),
      ]),
      initGenerated.fetchLaunchFeeState(rpc, outcome.launchFeeState, {
        commitment: 'confirmed',
      }),
    ]);
  for (const account of [baseMint, quoteMint, baseVault, quoteVault])
    validateOwner(account, TOKEN_PROGRAM_ADDRESS);
  validateOwner(feeState, initializer.INITIALIZER_PROGRAM_ID);
  if (
    baseVault.data.mint !== input.baseMint ||
    quoteVault.data.mint !== view.market.data.quoteMint ||
    baseVault.data.owner !== outcome.launchAuthority ||
    quoteVault.data.owner !== outcome.launchAuthority ||
    feeState.data.launch !== outcome.launch.address ||
    !feeState.data.discriminator.every(
      (v, i) => v === initGenerated.LAUNCH_FEE_STATE_DISCRIMINATOR[i],
    )
  )
    throw new Error('Invalid launch reserves or fee state');
  const fee = feeState.data;
  if (
    fee.beneficiaryLen > fee.beneficiaries.length ||
    fee.swapFeeBps !== outcome.launch.account.swapFeeBps
  )
    throw new Error('Invalid beneficiary count or swap fee state');
  const pendingBaseFees =
    fee.cumulatedBaseFees -
    fee.distributedProtocolBaseFees -
    fee.distributedBaseByBeneficiary
      .slice(0, fee.beneficiaryLen)
      .reduce((a, b) => a + b, 0n);
  const pendingQuoteFees =
    fee.cumulatedQuoteFees -
    fee.distributedProtocolQuoteFees -
    fee.distributedQuoteByBeneficiary
      .slice(0, fee.beneficiaryLen)
      .reduce((a, b) => a + b, 0n);
  const reservedBase =
    outcome.launch.account.baseForDistribution +
    outcome.launch.account.baseForLiquidity;
  if (
    pendingBaseFees < 0n ||
    pendingQuoteFees < 0n ||
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
      virtualBase: outcome.launch.account.curveVirtualBase,
      virtualQuote: outcome.launch.account.curveVirtualQuote,
      swapFeeBps: outcome.launch.account.swapFeeBps,
    }),
    outcome,
    oracle: view.market.data.oracle,
    market: input.market,
    pendingBaseFees,
    pendingQuoteFees,
  };
}
/** One plan per outstanding entry. Submit separately and refetch after each confirmation. */
export async function prepareRemainingSettlements(
  rpc: Rpc<GetAccountInfoApi & GetMultipleAccountsApi & GetProgramAccountsApi>,
  input: { market: Address; payer: TransactionSigner; winnerFirst?: boolean },
) {
  const view = await fetchPredictionMarketWithLaunches(rpc, input.market);
  if (!view.status.canSettle)
    throw new Error(
      'Settlement requires finalized oracle and complete registration',
    );
  const winnerIndex = view.oracle.data.outcomeIds.findIndex((id) =>
    id.every((v, i) => v === view.oracle.data.winningOutcomeId[i]),
  );
  const winnerMint = view.market.data.outcomeMints[winnerIndex];
  const pending = view.outcomes.filter((o) => !o.entry.data.isMigrated);
  if (input.winnerFirst !== false)
    pending.sort(
      (a, b) =>
        Number(b.entry.data.baseMint === winnerMint) -
        Number(a.entry.data.baseMint === winnerMint),
    );
  return Promise.all(
    pending.map(async (outcome) => ({
      baseMint: outcome.entry.data.baseMint,
      ...(await prepareSettlement({
        config: outcome.config,
        launch: outcome.launch.address,
        launchAuthority: outcome.launchAuthority,
        launchFeeState: outcome.launchFeeState,
        baseMint: outcome.entry.data.baseMint,
        quoteMint: view.market.data.quoteMint,
        baseVault: outcome.launch.account.baseVault,
        quoteVault: outcome.launch.account.quoteVault,
        payer: input.payer,
        oracle: view.market.data.oracle,
        market: input.market,
      })),
    })),
  );
}

/** Prepare only missing registrations after refetching the creator-owned market. */
export async function prepareMissingOutcomeLaunches(
  rpc: Rpc<GetAccountInfoApi & GetMultipleAccountsApi>,
  input: {
    market: Address;
    outcomes: readonly import('./builders.js').PrepareOutcomeLaunchInput[];
  },
) {
  const view = await fetchPredictionMarket(rpc, input.market);
  if (view.oracle.data.isFinalized)
    throw new Error('Cannot register after oracle finalization');
  const seen = new Set<number>();
  const plans = [];
  for (const outcome of input.outcomes) {
    if (
      outcome.oracle !== view.market.data.oracle ||
      outcome.creator.address !== view.market.data.creator ||
      outcome.launch.launchAccounts.quoteMint !== view.market.data.quoteMint
    )
      throw new Error('Outcome does not belong to this creator-owned market');
    const index = view.oracle.data.outcomeIds
      .slice(0, view.oracle.data.outcomeCount)
      .findIndex(
        (id) =>
          id.length === outcome.outcomeId.length &&
          id.every((v, i) => v === outcome.outcomeId[i]),
      );
    if (index < 0 || seen.has(index))
      throw new Error('Unknown or duplicate outcome');
    seen.add(index);
    if (view.status.missingOutcomeIndexes.includes(index))
      plans.push(await prepareOutcomeLaunch(outcome));
  }
  return plans;
}
import { prepareOutcomeLaunch } from './builders.js';
