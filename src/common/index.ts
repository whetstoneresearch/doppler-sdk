/**
 * Common module - shared types, constants, ABIs, and utilities.
 * Used by all auction types (static, dynamic, multicurve).
 */

// Export types
export type {
  TokenConfig,
  StandardTokenConfig,
  Doppler404TokenConfig,
  SaleConfig,
  VestingConfig,
  GovernanceDefault,
  GovernanceCustom,
  GovernanceNoOp,
  GovernanceOption,
  BeneficiaryData,
  MigrationConfig,
  PriceRange,
  TickRange,
  MarketCapRange,
  MarketCapConfig,
  MarketCapValidationResult,
  DopplerSDKConfig,
  SupportedPublicClient,
  SupportedChain,
  PoolInfo,
  HookInfo,
  QuoteResult,
  ModuleAddressOverrides,
  CreateParams,
  NoOpEnabledChainId,
} from './types';

export { NO_OP_ENABLED_CHAIN_IDS, isNoOpEnabledChain } from './types';

// Export addresses and chain IDs
export {
  ADDRESSES,
  CHAIN_IDS,
  getAddresses,
  SUPPORTED_CHAIN_IDS,
  isSupportedChainId,
} from './addresses';
export type {
  SupportedChainId,
  ChainAddresses,
  SupportedChainKey,
} from './addresses';

// Export constants
export {
  WAD,
  DEAD_ADDRESS,
  ZERO_ADDRESS,
  FEE_TIERS,
  VALID_FEE_TIERS,
  TICK_SPACINGS,
  SECONDS_PER_DAY,
  SECONDS_PER_YEAR,
  DEFAULT_EPOCH_LENGTH,
  DEFAULT_AUCTION_DURATION,
  DEFAULT_LOCK_DURATION,
  DEFAULT_PD_SLUGS,
  DAY_SECONDS,
  DEFAULT_CREATE_GAS_LIMIT,
  MIN_SQRT_RATIO,
  MAX_SQRT_RATIO,
  BASIS_POINTS,
} from './constants';
export type { FeeTier } from './constants';

// Export utilities
export * from './utils';

// Export ABIs
export * from './abis';
