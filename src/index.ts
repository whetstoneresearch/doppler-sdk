export const VERSION = '0.0.1';

// Export the main SDK class
export { DopplerSDK } from './DopplerSDK';

// Export auction classes from their modules
export { StaticAuction } from './static/auction';
export { DynamicAuction } from './dynamic/auction';
export { MulticurvePool } from './multicurve/pool';

// Export module-specific factories (for tree-shaking)
export { StaticAuctionFactory } from './static/factory';
export { DynamicAuctionFactory } from './dynamic/factory';
export { MulticurveFactory } from './multicurve/factory';

// Export utility classes
export { Quoter, Derc20, Eth } from './common/utils';

// Export builders from their module locations
export { StaticAuctionBuilder } from './static/builder';
export { DynamicAuctionBuilder } from './dynamic/builder';
export { MulticurveBuilder } from './multicurve/builder';
export type { BaseAuctionBuilder } from './common/types';

// ============================================================================
// Common module exports
// ============================================================================

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
} from './common/types';

export { NO_OP_ENABLED_CHAIN_IDS, isNoOpEnabledChain } from './common/types';

export {
  ADDRESSES,
  CHAIN_IDS,
  getAddresses,
  SUPPORTED_CHAIN_IDS,
  isSupportedChainId,
} from './common/addresses';
export type {
  SupportedChainId,
  ChainAddresses,
  SupportedChainKey,
} from './common/addresses';

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
  BASIS_POINTS,
} from './common/constants';
export type { FeeTier } from './common/constants';

// ============================================================================
// Static module exports
// ============================================================================

export type {
  StaticPoolConfig,
  CreateStaticAuctionParams,
  StaticAuctionMarketCapConfig,
  StaticAuctionTickParams,
  LockableV3InitializerParams,
  LockablePoolState,
  StaticAuctionBuildConfig,
} from './static/types';

export { LockablePoolStatus } from './static/types';

export {
  V3_FEE_TIERS,
  DEFAULT_V3_START_TICK,
  DEFAULT_V3_END_TICK,
  DEFAULT_V3_NUM_POSITIONS,
  DEFAULT_V3_FEE,
  DEFAULT_V3_INITIAL_VOTING_DELAY,
  DEFAULT_V3_INITIAL_VOTING_PERIOD,
  DEFAULT_V3_INITIAL_PROPOSAL_THRESHOLD,
  DEFAULT_V3_VESTING_DURATION,
  DEFAULT_V3_INITIAL_SUPPLY,
  DEFAULT_V3_NUM_TOKENS_TO_SELL,
  DEFAULT_V3_YEARLY_MINT_RATE,
  DEFAULT_V3_PRE_MINT,
  DEFAULT_V3_MAX_SHARE_TO_BE_SOLD,
} from './static/constants';

// ============================================================================
// Dynamic module exports
// ============================================================================

export type {
  DynamicAuctionConfig,
  CreateDynamicAuctionParams,
  DynamicMarketCapRange,
  DynamicAuctionMarketCapConfig,
  DynamicAuctionTickParams,
  DynamicAuctionBuildConfig,
} from './dynamic/types';

export {
  V4_MAX_FEE,
  DOPPLER_MAX_TICK_SPACING,
  DEFAULT_V4_INITIAL_VOTING_DELAY,
  DEFAULT_V4_INITIAL_VOTING_PERIOD,
  DEFAULT_V4_INITIAL_PROPOSAL_THRESHOLD,
  DEFAULT_V4_YEARLY_MINT_RATE,
  FLAG_MASK,
  DOPPLER_FLAGS,
  DYNAMIC_FEE_FLAG,
  FEE_AMOUNT_MASK,
  DEFAULT_MULTICURVE_LOWER_TICKS,
  DEFAULT_MULTICURVE_UPPER_TICKS,
  DEFAULT_MULTICURVE_NUM_POSITIONS,
  DEFAULT_MULTICURVE_MAX_SUPPLY_SHARES,
} from './internal/v4-shared';

// ============================================================================
// Multicurve module exports
// ============================================================================

export type {
  MulticurveCurve,
  MulticurveMarketCapPreset,
  RehypeDopplerHookConfig,
  CreateMulticurveParams,
  MulticurvePoolState,
  MulticurveBundleExactOutResult,
  MulticurveBundleExactInResult,
  MulticurveMarketCapRangeCurve,
  MulticurveMarketCapCurvesConfig,
  MulticurveTickRangeParams,
  MulticurveTickParams,
  TickToMarketCapParams,
} from './multicurve/types';

export type { V4PoolKey } from './internal/v4-shared/types';

// ============================================================================
// Utility exports
// ============================================================================

// Tick math utilities
export {
  MIN_TICK,
  MAX_TICK,
  MIN_SQRT_RATIO,
  MAX_SQRT_RATIO,
  Q96,
  getSqrtRatioAtTick,
  getTickAtSqrtRatio,
  sqrtPriceX96ToPrice,
  priceToSqrtPriceX96,
  tickToPrice,
  priceToTick,
  getNearestUsableTick,
} from './common/utils/tickMath';

// Token address mining
export { mineTokenAddress } from './common/utils/tokenAddressMiner';
export type {
  TokenAddressHookConfig,
  TokenAddressMiningParams,
  TokenAddressMiningResult,
  TokenVariant,
} from './common/utils/tokenAddressMiner';

// Airlock utilities
export {
  getAirlockOwner,
  getAirlockBeneficiary,
  createAirlockBeneficiary,
  DEFAULT_AIRLOCK_BENEFICIARY_SHARES,
} from './common/utils/airlock';

// Pool key utilities
export { computePoolId } from './internal/v4-shared/poolKey';

// Gamma computation
export { computeOptimalGamma } from './dynamic/utils/gamma';

// Token ordering
export { isToken0Expected } from './internal/v4-shared/marketCapHelpers';

// Price helpers
export {
  calculateTickRange,
  calculateTokensToSell,
  calculateGamma,
  estimatePriceAtEpoch,
  formatTickAsPrice,
  calculateMarketCap,
  calculateFDV,
  estimateSlippage,
} from './common/utils/priceHelpers';

// Balance delta
export { decodeBalanceDelta } from './common/utils/balanceDelta';

// Market cap helpers - static auction
export {
  marketCapToTokenPrice,
  tokenPriceToRatio,
  ratioToTick,
  marketCapToTicksForStaticAuction,
  validateMarketCapParameters,
} from './static/utils/marketCapHelpers';

// Market cap helpers - V4 (dynamic and multicurve)
export {
  isToken1,
  marketCapToTicksForDynamicAuction,
  marketCapToTicksForMulticurve,
  marketCapToTickForMulticurve,
  applyTickOffsets,
  tickToMarketCap,
  getMaxTickRounded,
} from './internal/v4-shared/marketCapHelpers';

// Tick helpers
export { computeTicks } from './common/utils/tickHelpers';

// Market cap preset utilities
export {
  MARKET_CAP_PRESETS,
  MARKET_CAP_PRESET_ORDER,
} from './multicurve/constants';
export { buildCurvesFromPresets } from './multicurve/utils/presetHelpers';
export type { MarketCapPresetConfig, MarketCapPresetOverrides } from './multicurve/types';

// Export ABIs
export * from './common/abis';
