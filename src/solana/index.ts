/**
 * @soloppler/sdk - TypeScript SDK for the Soloppler CPMM AMM
 *
 * @packageDocumentation
 */

export * as cpmm from './cpmm/index.js';
export * as cpmmHook from './cpmmHook/index.js';
export * as initializer from './initializer/index.js';
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
  DOPPLER_SOLANA_MAINNET_PROGRAM_ADDRESSES,
  deriveSolanaCpmmDeployment,
  type SolanaCpmmDeployment,
  type SolanaCpmmProgramAddresses,
} from './deployment.js';
