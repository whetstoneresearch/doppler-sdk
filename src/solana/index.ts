/**
 * @soloppler/sdk - TypeScript SDK for the Soloppler CPMM AMM
 *
 * @packageDocumentation
 */

export * as cpmm from './cpmm/index.js';
export * as dopplerLaunchHookV1 from './dopplerLaunchHookV1/index.js';
export * as dopplerLaunchHookV2 from './dopplerLaunchHookV2/index.js';
export * as dopplerRehypeRouterV1 from './dopplerRehypeRouterV1/index.js';
export * as feeRehypothecation from './feeRehypothecation/index.js';
export * as initializer from './initializer/index.js';
export * as vesting from './vesting/index.js';
export * as cpmmMigrator from './migrators/cpmmMigrator/index.js';
export * as predictionMigrator from './migrators/predictionMigrator/index.js';
export * as trustedOracle from './trustedOracle/index.js';

export { createLaunch } from './initializer/createLaunch.js';
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
} from './initializer/createLaunch.js';
export {
  curveSwapExactIn,
  swapExactIn,
  type CurveSwapExactInInput,
  type CurveSwapExactInResult,
  type CurveSwapHook,
  type SolanaRemainingAccount,
  type SwapExactInInput,
  type SwapExactInResult,
} from './swaps.js';
export {
  assertMigrationQuoteThreshold,
  getMigrationQuoteProgress,
  migrateLaunch,
  type MigrateLaunchInput,
  type MigrateLaunchResult,
  type MigrationQuoteProgress,
} from './migrateLaunch.js';

export {
  DOPPLER_SOLANA_DEVNET_PROGRAM_ADDRESSES,
  DOPPLER_SOLANA_DEVNET_FEE_REHYPOTHECATION_PROGRAM_ADDRESSES,
  DOPPLER_SOLANA_MAINNET_PROGRAM_ADDRESSES,
  deriveSolanaCpmmDeployment,
  deriveSolanaFeeRehypothecationDeployment,
  type SolanaCpmmDeployment,
  type SolanaCpmmProgramAddresses,
  type SolanaFeeRehypothecationDeployment,
  type SolanaFeeRehypothecationProgramAddresses,
} from './deployment.js';
