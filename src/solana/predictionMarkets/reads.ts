import {
  type Address,
  type Account,
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
import * as initializer from '../initializer/index.js';
import { assertOutcomeIds } from './validation.js';

export type PredictionMarketPhase =
  | 'registering'
  | 'trading'
  | 'void'
  | 'claimable'
  | 'settling';
export type PredictionMarketStatus = {
  phase: PredictionMarketPhase;
  missingOutcomeIndexes: number[];
  unsettledMints: Address[];
  canBuy: boolean;
  canSettle: boolean;
  canClaim: boolean;
  canRefund: boolean;
  allEntriesSettled: boolean;
};
export type PredictionMarketView = {
  market: Account<prediction.Market>;
  oracle: Account<oracleClient.OracleState>;
  entries: Account<prediction.Entry>[];
  status: PredictionMarketStatus;
};
export type PredictionOutcomeBinding = {
  entry: Account<prediction.Entry>;
  launch: initializer.LaunchWithAddress;
  launchAuthority: Address;
  launchFeeState: Address;
  config: Address;
};
export type PredictionMarketWithLaunches = PredictionMarketView & {
  outcomes: PredictionOutcomeBinding[];
};

export function getPredictionMarketStatus(
  market: prediction.Market,
  oracle: oracleClient.OracleState,
  entries: readonly prediction.Entry[] = [],
): PredictionMarketStatus {
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
export function validateOwner(
  account: { programAddress: Address },
  owner: Address,
) {
  if (account.programAddress !== owner)
    throw new Error(`Unexpected account owner; expected ${owner}`);
}
/** @internal Validates decoded market/oracle relationships from a single read snapshot. */
export async function validatePredictionMarketAccounts(
  market: Account<prediction.Market>,
  oracle: Account<oracleClient.OracleState>,
): Promise<void> {
  validateOwner(market, prediction.PREDICTION_MIGRATOR_PROGRAM_ADDRESS);
  if (
    !market.data.discriminator.every(
      (v, i) => v === prediction.MARKET_DISCRIMINATOR[i],
    )
  )
    throw new Error('Invalid Market discriminator');
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
  if (expectedMarket !== market.address) throw new Error('Invalid market PDA');
  const [expectedOracle] = await oracleClient.getOracleStateAddress(
    oracle.data.oracleAuthority,
    oracle.data.nonce,
  );
  const [expectedPot] = await prediction.getPredictionPotVaultAddress(
    market.address,
  );
  if (
    expectedOracle !== market.data.oracle ||
    expectedPot !== market.data.potVault
  )
    throw new Error('Invalid oracle or pot PDA');
  if (oracle.address !== market.data.oracle)
    throw new Error('Invalid market oracle');
}
/** Fetches known registered entries, avoiding a global scan for the common market view. */
export async function fetchPredictionMarket(
  rpc: Rpc<GetAccountInfoApi & GetMultipleAccountsApi>,
  marketAddress: Address,
): Promise<PredictionMarketView> {
  const market = await prediction.fetchMarket(rpc, marketAddress, {
    commitment: 'confirmed',
  });
  const oracle = await oracleClient.fetchOracleState(rpc, market.data.oracle, {
    commitment: 'confirmed',
  });
  await validatePredictionMarketAccounts(market, oracle);
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
): Promise<{ address: Address; data: prediction.Market }[]> {
  const filters = [
    { dataSize: BigInt(prediction.getMarketSize()) },
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
): void {
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
): Promise<PredictionMarketWithLaunches> {
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
): Promise<Account<prediction.ClaimReceipt> | null> {
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
