/**
 * Internal V4-shared module - NOT exported directly to users.
 * Used by dynamic/ and multicurve/ modules.
 */

// Export types
export type { V4PoolKey, V4ModuleAddressOverrides } from './types';

// Export constants
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
} from './constants';

// Export utilities
export { computePoolId } from './poolKey';

// Export market cap helpers
export {
  marketCapToTokenPrice,
  tokenPriceToRatio,
  ratioToTick,
  isToken1,
  isToken0Expected,
  getMaxTickRounded,
  computeRawTick,
  marketCapToTicksForDynamicAuction,
  marketCapToTicksForMulticurve,
  marketCapToTickForMulticurve,
  tickToMarketCap,
  applyTickOffsets,
} from './marketCapHelpers';
