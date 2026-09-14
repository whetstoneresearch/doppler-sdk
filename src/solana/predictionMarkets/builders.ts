import {
  AccountRole,
  type Address,
  type Instruction,
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
import { curveSwapExactIn, type CurveSwapExactInInput } from '../swaps.js';
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
export async function prepareOracle(input: {
  oracleAuthority: TransactionSigner;
  nonce: bigint;
  outcomeIds: Uint8Array[];
}) {
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
    ] as Instruction[],
  };
}
export async function prepareMarket(input: {
  creator: TransactionSigner;
  oracle: Address;
  quoteMint: Address;
  quoteTokenProgram?: Address;
}) {
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
    ] as Instruction[],
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
export async function prepareOutcomeLaunch(input: PrepareOutcomeLaunchInput) {
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
export async function prepareBuy(input: PrepareBuyInput) {
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
export function prepareFinalize(input: {
  oracleAuthority: TransactionSigner;
  oracle: Address;
  winningOutcomeId: Uint8Array;
}) {
  assertOutcomeId(input.winningOutcomeId);
  return {
    instructions: [
      oracleClient.getFinalizeInstruction({
        ...input,
        oracleState: input.oracle,
      }),
    ] as Instruction[],
  };
}
export type PrepareSettlementInput = Omit<
  MigrateLaunchAccounts,
  'migratorProgram' | 'rent'
> & { oracle: Address; market: Address; rent?: Address; programId?: Address };
export async function prepareSettlement(input: PrepareSettlementInput) {
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
  const metas = instruction.accounts!.map((a) =>
    a.address === input.baseMint || a.address === input.launchFeeState
      ? { ...a, role: AccountRole.WRITABLE }
      : a,
  );
  return {
    entry: accounts.entry,
    instructions: [
      { ...instruction, accounts: [...metas, ...accounts.settlement] },
    ] as Instruction[],
  };
}
