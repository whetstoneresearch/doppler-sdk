/**
 * Internal V4-shared types used by both dynamic and multicurve modules.
 * NOT exported directly - users should import from dynamic/ or multicurve/.
 */

import type { Address } from 'viem';

export interface V4PoolKey {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
}

// Re-export ModuleAddressOverrides with V4-specific properties for internal use
export interface V4ModuleAddressOverrides {
  airlock?: Address;
  tokenFactory?: Address;
  v4Initializer?: Address;
  v4MulticurveInitializer?: Address;
  v4ScheduledMulticurveInitializer?: Address;
  dopplerHookInitializer?: Address;
  rehypeDopplerHook?: Address;
  governanceFactory?: Address;
  poolManager?: Address;
  dopplerDeployer?: Address;
  v2Migrator?: Address;
  v4Migrator?: Address;
  noOpMigrator?: Address;
}
