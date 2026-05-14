/**
 * @soloppler/sdk - TypeScript SDK for the Soloppler CPMM AMM
 *
 * @packageDocumentation
 */

export * as cpmm from './cpmm/index.js';
export * as cosignerHook from './cosignerHook/index.js';
export * as initializer from './initializer/index.js';
export * as cpmmMigrator from './migrators/cpmmMigrator/index.js';
export * as predictionMigrator from './migrators/predictionMigrator/index.js';
export * as trustedOracle from './trustedOracle/index.js';

export {
  DOPPLER_SOLANA_DEVNET_PROGRAM_ADDRESSES,
  deriveSolanaCpmmDeployment,
  type SolanaCpmmDeployment,
  type SolanaCpmmProgramAddresses,
} from './deployment.js';
