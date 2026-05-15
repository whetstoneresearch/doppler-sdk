// Constants
export {
  INITIALIZER_PROGRAM_ID,
  BPF_LOADER_UPGRADEABLE_PROGRAM_ID,
  CPMM_HOOK_PROGRAM_ID,
  PREDICTION_HOOK_PROGRAM_ID,
  SEED_CONFIG,
  SEED_LAUNCH,
  SEED_LAUNCH_AUTHORITY,
  SEED_FEE_LOCKER,
  MAX_MIGRATOR_ALLOWLIST,
  MAX_HOOK_ALLOWLIST,
  MAX_PAYLOAD,
  MAX_FEE_BENEFICIARIES,
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
  FeeBeneficiary,
  FeeBeneficiaryArgs,
  FeeBeneficiaryInput,
  FeeBeneficiaryInputArgs,
  FeeLocker,
  FeeLockerArgs,
  Launch,
  LaunchArgs,
  InitializeConfigArgs,
  InitializeConfigArgsArgs,
  InitializeLaunchArgs,
  InitializeLaunchArgsArgs,
  PayloadBuf,
} from '../generated/initializer/index.js';

export {
  getInitConfigDecoder,
  getInitConfigEncoder,
  getInitConfigCodec,
  getFeeBeneficiaryEncoder,
  getFeeBeneficiaryDecoder,
  getFeeBeneficiaryCodec,
  getFeeBeneficiaryInputEncoder,
  getFeeBeneficiaryInputDecoder,
  getFeeBeneficiaryInputCodec,
  getFeeLockerDecoder,
  getFeeLockerEncoder,
  getFeeLockerCodec,
  getLaunchDecoder,
  getLaunchEncoder,
  getLaunchCodec,
  getInitializeConfigArgsEncoder,
  getInitializeConfigArgsDecoder,
  getInitializeConfigArgsCodec,
  getInitializeLaunchArgsEncoder,
  getInitializeLaunchArgsDecoder,
  getInitializeLaunchArgsCodec,
} from '../generated/initializer/index.js';

// PDA helpers
export {
  getConfigAddress,
  getProgramDataAddress,
  getLaunchAddress,
  getLaunchAuthorityAddress,
  getFeeLockerAddress,
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
  createClaimFeeLockerInstruction,
  type ClaimFeeLockerAccounts,
  createDistributeBaseAllocationInstruction,
  type DistributeBaseAllocationAccounts,
  createPreviewSwapExactInInstruction,
  decodePreviewSwapExactInResult,
  type PreviewSwapExactInAccounts,
  type PreviewSwapExactInResult,
  createPreviewMigrationInstruction,
  decodePreviewMigrationResult,
  type PreviewMigrationAccounts,
  type PreviewMigrationResult,
} from './instructions/index.js';

// Helpers
export { computeRemainingAccountsHash, phaseLabel } from './helpers.js';
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

// Client helpers
export {
  fetchLaunch,
  fetchAllLaunches,
  fetchLaunchesByAuthority,
  launchExists,
  type FetchLaunchesConfig,
  type LaunchWithAddress,
} from './client/index.js';
