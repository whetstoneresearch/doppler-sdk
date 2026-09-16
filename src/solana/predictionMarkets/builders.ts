import {
  AccountRole,
  type Address,
  type Instruction,
  type Rpc,
  type GetAccountInfoApi,
  type GetMultipleAccountsApi,
  type GetProgramAccountsApi,
  type TransactionSigner,
} from '@solana/kit';
import {
  TOKEN_PROGRAM_ADDRESS,
  SYSVAR_RENT_ADDRESS,
} from '../core/constants.js';
import { getAddressFromAddressOrSigner } from '../core/accounts.js';
import * as oracleClient from '../trustedOracle/index.js';
import * as prediction from '../migrators/predictionMigrator/index.js';
import {
  createLaunchWithResolvedHook,
  type CreateLaunchInput,
  type CreateLaunchResult,
} from '../initializer/createLaunch.js';
import {
  computeRemainingAccountsHash,
  HF_BEFORE_SWAP,
  HF_LAUNCH_CONTEXT_V2,
  PREDICTION_HOOK_PROGRAM_ID,
  INITIALIZER_PROGRAM_ID,
  createMigrateLaunchInstruction,
} from '../initializer/index.js';
import type { MigrateLaunchAccounts } from '../initializer/instructions/migrateLaunch.js';
import {
  curveSwapExactIn,
  type CurveSwapExactInInput,
  type CurveSwapExactInResult,
} from '../swaps.js';
import {
  fetchPredictionMarket,
  fetchPredictionMarketWithLaunches,
} from './reads.js';
import { assertOutcomeId, assertOutcomeIds, assertU64 } from './validation.js';

/** The programs embed cross-program IDs. These builders target the matching compiled stack. */
function assertInitializer(program?: Address) {
  if (program && program !== INITIALIZER_PROGRAM_ID)
    throw new Error(
      'Prediction markets require the canonical compiled Initializer program',
    );
}
export function assertPredictionTokenProgram(program?: Address) {
  if (program && program !== TOKEN_PROGRAM_ADDRESS)
    throw new Error(
      'High-level prediction markets currently support SPL Token only; Token-2022 extensions require separate settlement verification',
    );
}
export type PrepareOracleInput = {
  oracleAuthority: TransactionSigner;
  nonce: bigint;
  outcomeIds: Uint8Array[];
};
export type PrepareOracleResult = {
  oracle: Address;
  instructions: Instruction[];
};
/** Prepare an oracle with immutable declared outcomes. */
export async function prepareOracle(
  input: PrepareOracleInput,
): Promise<PrepareOracleResult> {
  assertU64(input.nonce, 'nonce');
  assertOutcomeIds(input.outcomeIds);
  const [oracle] = await oracleClient.getOracleStateAddress(
    input.oracleAuthority.address,
    input.nonce,
  );
  return {
    oracle,
    instructions: [
      oracleClient.getInitializeOracleInstruction({
        ...input,
        oracleState: oracle,
      }),
    ],
  };
}
export type PrepareMarketInput = {
  creator: TransactionSigner;
  oracle: Address;
  quoteMint: Address;
  quoteTokenProgram?: Address;
};
export type PrepareMarketResult = {
  market: Address;
  potVault: Address;
  marketAuthority: Address;
  instructions: Instruction[];
};
/** Prepare a creator-owned market for an existing oracle. */
export async function prepareMarket(
  input: PrepareMarketInput,
): Promise<PrepareMarketResult> {
  assertPredictionTokenProgram(input.quoteTokenProgram);
  const [market] = await prediction.getPredictionMarketAddress(
    input.oracle,
    input.quoteMint,
    input.creator.address,
  );
  const [[potVault], [marketAuthority]] = await Promise.all([
    prediction.getPredictionPotVaultAddress(market),
    prediction.getPredictionMarketAuthorityAddress(market),
  ]);
  return {
    market,
    potVault,
    marketAuthority,
    instructions: [
      prediction.getCreateMarketInstruction({
        ...input,
        market,
        potVault,
        marketAuthority,
        quoteTokenProgram: TOKEN_PROGRAM_ADDRESS,
      }),
    ],
  };
}
export async function derivePredictionAccounts(input: {
  oracle: Address;
  market: Address;
  baseMint: Address;
}) {
  const [[potVault], [marketAuthority], [entry]] = await Promise.all([
    prediction.getPredictionPotVaultAddress(input.market),
    prediction.getPredictionMarketAuthorityAddress(input.market),
    prediction.getPredictionEntryAddress(input.market, input.baseMint),
  ]);
  const registration = [
    { address: input.oracle, role: AccountRole.READONLY },
    { address: input.market, role: AccountRole.WRITABLE },
    { address: entry, role: AccountRole.WRITABLE },
  ];
  const hook = [
    { address: input.oracle, role: AccountRole.READONLY },
    { address: input.market, role: AccountRole.READONLY },
  ];
  const settlement = [
    { address: input.oracle, role: AccountRole.READONLY },
    { address: input.market, role: AccountRole.WRITABLE },
    { address: potVault, role: AccountRole.WRITABLE },
    { address: marketAuthority, role: AccountRole.READONLY },
    { address: entry, role: AccountRole.WRITABLE },
  ];
  return { potVault, marketAuthority, entry, registration, hook, settlement };
}
export type PrepareOutcomeLaunchInput = {
  oracle: Address;
  creator: TransactionSigner;
  outcomeId: Uint8Array;
  launch: Omit<
    CreateLaunchInput,
    | 'namespace'
    | 'authority'
    | 'migration'
    | 'allowBuy'
    | 'allowSell'
    | 'cosignerGate'
    | 'dynamicFee'
    | 'vestingConfig'
  >;
};
export type PrepareOutcomeLaunchResult = CreateLaunchResult & {
  market: Address;
  entry: Address;
  potVault: Address;
  marketAuthority: Address;
  instructions: Instruction[];
};
/** Register one outcome through the Initializer with the required prediction hook. */
export async function prepareOutcomeLaunch(
  input: PrepareOutcomeLaunchInput,
): Promise<PrepareOutcomeLaunchResult> {
  assertOutcomeId(input.outcomeId);
  if (input.launch.feeBeneficiaries?.length === 0)
    throw new Error(
      'Prediction launch feeBeneficiaries must be nonempty; omit it to route the beneficiary share to the creator',
    );
  assertInitializer(
    input.launch.programId ?? input.launch.deployment?.initializerProgram,
  );
  assertPredictionTokenProgram(input.launch.tokenPrograms?.baseTokenProgram);
  assertPredictionTokenProgram(input.launch.tokenPrograms?.quoteTokenProgram);
  if (
    input.launch.supply.baseForDistribution !== 0n ||
    input.launch.supply.baseForLiquidity !== 0n
  )
    throw new Error('Prediction outcomes require all supply on the curve');
  const [market] = await prediction.getPredictionMarketAddress(
    input.oracle,
    input.launch.launchAccounts.quoteMint,
    input.creator.address,
  );
  const accounts = await derivePredictionAccounts({
    oracle: input.oracle,
    market,
    baseMint: getAddressFromAddressOrSigner(
      input.launch.launchAccounts.baseMint,
    ),
  });
  const result = await createLaunchWithResolvedHook(
    {
      ...input.launch,
      feeBeneficiaries: input.launch.feeBeneficiaries ?? [
        { wallet: input.creator.address, shareBps: 10_000 },
      ],
      namespace: input.oracle,
      authority: input.creator,
      allowBuy: true,
      allowSell: false,
      migration: {
        kind: 'custom',
        program: prediction.PREDICTION_MIGRATOR_PROGRAM_ADDRESS,
        initPayload: prediction
          .getRegisterEntryInstructionDataEncoder()
          .encode({ outcomeId: input.outcomeId }),
        migratePayload: prediction
          .getMigrateEntryInstructionDataEncoder()
          .encode({}),
        initRemainingAccounts: accounts.registration,
        remainingAccounts: accounts.settlement,
      },
    },
    {
      program: PREDICTION_HOOK_PROGRAM_ID,
      flags: HF_BEFORE_SWAP | HF_LAUNCH_CONTEXT_V2,
      payload: new Uint8Array(),
      remainingAccountsHash: computeRemainingAccountsHash(
        accounts.hook.map((a) => a.address),
      ),
    },
  );
  return {
    ...result,
    market,
    entry: accounts.entry,
    potVault: accounts.potVault,
    marketAuthority: accounts.marketAuthority,
    instructions: [result.instruction],
  };
}
export type PrepareBuyInput = Omit<
  CurveSwapExactInInput,
  'tradeDirection' | 'hook' | 'remainingAccounts'
> & { oracle: Address; market: Address };
export async function prepareBuy(
  input: PrepareBuyInput,
): Promise<CurveSwapExactInResult> {
  assertInitializer(input.programId ?? input.deployment?.initializerProgram);
  assertPredictionTokenProgram(input.baseTokenProgram);
  assertPredictionTokenProgram(input.quoteTokenProgram);
  assertU64(input.amountIn, 'amountIn');
  assertU64(input.minAmountOut, 'minAmountOut');
  if (input.amountIn === 0n) throw new Error('amountIn must be positive');
  return curveSwapExactIn({
    ...input,
    tradeDirection: 0,
    hook: {
      program: PREDICTION_HOOK_PROGRAM_ID,
      remainingAccounts: [input.oracle, input.market],
    },
  });
}
export type PrepareFinalizeInput = {
  oracleAuthority: TransactionSigner;
  oracle: Address;
  winningOutcomeId: Uint8Array;
};
export function prepareFinalize(input: PrepareFinalizeInput): {
  instructions: Instruction[];
} {
  assertOutcomeId(input.winningOutcomeId);
  return {
    instructions: [
      oracleClient.getFinalizeInstruction({
        ...input,
        oracleState: input.oracle,
      }),
    ],
  };
}
export type PrepareSettlementInput = Omit<
  MigrateLaunchAccounts,
  'migratorProgram' | 'rent'
> & { oracle: Address; market: Address; rent?: Address; programId?: Address };
export type PrepareSettlementResult = {
  entry: Address;
  instructions: Instruction[];
};
export async function prepareSettlement(
  input: PrepareSettlementInput,
): Promise<PrepareSettlementResult> {
  assertInitializer(input.programId);
  assertPredictionTokenProgram(input.baseTokenProgram);
  assertPredictionTokenProgram(input.quoteTokenProgram);
  const accounts = await derivePredictionAccounts(input);
  const instruction = createMigrateLaunchInstruction({
    ...input,
    migratorProgram: prediction.PREDICTION_MIGRATOR_PROGRAM_ADDRESS,
    rent: input.rent ?? SYSVAR_RENT_ADDRESS,
  });
  // migrate_entry burns unsold supply; reserved fees stay in the launch vault.
  if (!instruction.accounts)
    throw new Error('Settlement instruction is missing accounts');
  const metas = instruction.accounts.map((a) =>
    a.address === input.baseMint || a.address === input.launchFeeState
      ? { ...a, role: AccountRole.WRITABLE }
      : a,
  );
  return {
    entry: accounts.entry,
    instructions: [
      { ...instruction, accounts: [...metas, ...accounts.settlement] },
    ],
  };
}

/** One plan per outstanding entry. Submit separately and refetch after each confirmation. */
export async function prepareRemainingSettlements(
  rpc: Rpc<GetAccountInfoApi & GetMultipleAccountsApi & GetProgramAccountsApi>,
  input: { market: Address; payer: TransactionSigner; winnerFirst?: boolean },
): Promise<(PrepareSettlementResult & { baseMint: Address })[]> {
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
    outcomes: readonly PrepareOutcomeLaunchInput[];
  },
): Promise<PrepareOutcomeLaunchResult[]> {
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
