// Constants
export {
  INITIALIZER_PROGRAM_ID,
  DEVNET_INITIALIZER_PROGRAM_ID,
  MAINNET_INITIALIZER_PROGRAM_ID,
  BPF_LOADER_UPGRADEABLE_PROGRAM_ID,
  PREDICTION_HOOK_PROGRAM_ID,
  SEED_CONFIG,
  SEED_LAUNCH,
  SEED_LAUNCH_AUTHORITY,
  SEED_LAUNCH_FEE_STATE,
  MAX_MIGRATOR_ALLOWLIST,
  MAX_HOOK_ALLOWLIST,
  MAX_PAYLOAD,
  EMPTY_REMAINING_ACCOUNTS_HASH,
  PHASE_TRADING,
  PHASE_MIGRATED,
  PHASE_ABORTED,
  TRADE_DIRECTION_BUY,
  TRADE_DIRECTION_SELL,
  CURVE_KIND_XYK,
  CURVE_PARAMS_FORMAT_XYK_V0,
  HF_BEFORE_SWAP,
  HF_AFTER_SWAP,
  HF_BEFORE_CREATE,
  HF_AFTER_CREATE,
  HF_BEFORE_MIGRATE,
  HF_AFTER_MIGRATE,
  HF_FORWARD_READONLY_SIGNERS,
  HOOK_NO_CHANGE,
  INITIALIZER_INSTRUCTION_DISCRIMINATORS,
  INITIALIZER_ACCOUNT_DISCRIMINATORS,
} from './constants.js';

// Generated types and codec factories
export type {
  InitConfig,
  InitConfigArgs,
  Launch,
  LaunchArgs,
  LaunchFeeState,
  LaunchFeeStateArgs,
  FeeBeneficiary,
  FeeBeneficiaryArgs,
  FeeBeneficiaryInput,
  FeeBeneficiaryInputArgs,
  InitializeConfigArgs,
  InitializeConfigArgsArgs,
  InitializeLaunchArgs,
  InitializeLaunchArgsArgs,
  ClaimFeesAsyncInput,
  HarvestMigratedFeesAsyncInput,
  ReplaceFeeBeneficiaryAsyncInput,
  SetFeePolicyAsyncInput,
  PayloadBuf,
} from '../generated/initializer/index.js';

export {
  getInitConfigDecoder,
  getInitConfigEncoder,
  getInitConfigCodec,
  getInitConfigSize,
  getLaunchDecoder,
  getLaunchEncoder,
  getLaunchCodec,
  getLaunchFeeStateDecoder,
  getLaunchFeeStateEncoder,
  getLaunchFeeStateCodec,
  getInitializeConfigArgsEncoder,
  getInitializeConfigArgsDecoder,
  getInitializeConfigArgsCodec,
  getInitializeLaunchArgsEncoder,
  getInitializeLaunchArgsDecoder,
  getInitializeLaunchArgsCodec,
  getClaimFeesInstructionAsync,
  getHarvestMigratedFeesInstructionAsync,
  getReplaceFeeBeneficiaryInstructionAsync,
  getSetFeePolicyInstructionAsync,
} from '../generated/initializer/index.js';

// PDA helpers
export {
  getConfigAddress,
  getProgramDataAddress,
  getLaunchAddress,
  getLaunchAuthorityAddress,
  getLaunchFeeStateAddress,
  encodeU64LE,
  launchIdFromU64,
} from './pda.js';

// Instruction builders
export {
  createInitializeConfigInstruction,
  type InitializeConfigAccounts,
  createSetMigratorAllowlistInstruction,
  type SetMigratorAllowlistAccounts,
  createSetHookAllowlistInstruction,
  type SetHookAllowlistAccounts,
  createInitializeLaunchInstruction,
  getTokenMetadataAddress,
  type InitializeLaunchAccounts,
  createCurveSwapExactInInstruction,
  type CurveSwapExactInAccounts,
  createMigrateLaunchInstruction,
  type MigrateLaunchAccounts,
  createPreviewSwapExactInInstruction,
  decodePreviewSwapExactInResult,
  type PreviewSwapExactInAccounts,
  type PreviewSwapExactInResult,
  createPreviewMigrationInstruction,
  decodePreviewMigrationResult,
  type PreviewMigrationAccounts,
  type PreviewMigrationResult,
} from './instructions/index.js';

// High-level launch helpers
export {
  createLaunchId,
  deriveCreateLaunchAddresses,
  launchTokenPrograms,
} from './createLaunch.js';
export type {
  CreateLaunchAccountSigners,
  CreateLaunchAddresses,
  CreateLaunchCpmmMigrationConfig,
  CreateLaunchCustomMigrationConfig,
  CreateLaunchInput,
  CreateLaunchMigrationConfig,
  CreateLaunchResult,
  DeriveCreateLaunchAddressesInput,
  LaunchMetadata,
  LaunchSupply,
  LaunchTokenPrograms,
  XykCurveConfig,
} from './createLaunch.js';

// Helpers
export {
  computeRemainingAccountsHash,
  getCurveSwapFeeAmount,
  phaseLabel,
} from './helpers.js';
export {
  DEFAULT_LOOKUP_TABLE_ADDRESSES_PER_EXTEND,
  getInstructionLookupTableAddresses,
  buildAddressLookupTableSetupInstructions,
  compressTransactionMessageWithLookupTable,
} from './addressLookupTables.js';
export type {
  BuildAddressLookupTableSetupInstructionsInput,
  BuildAddressLookupTableSetupInstructionsResult,
} from './addressLookupTables.js';
export {
  SOLANA_TRANSACTION_SIZE_LIMIT,
  measureTransactionMessageSize,
  measureTransactionMessageSizeWithLookupTable,
  assertTransactionMessageFits,
  assertTransactionMessageFitsWithLookupTable,
} from './transactionSize.js';
export type {
  TransactionSizeAssertOptions,
  TransactionSizeReport,
} from './transactionSize.js';

// Client helpers
export {
  fetchLaunch,
  fetchAllLaunches,
  fetchLaunchesByAuthority,
  launchExists,
  type FetchLaunchesConfig,
  type LaunchWithAddress,
} from './client/index.js';
