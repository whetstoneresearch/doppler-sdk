/**
 * Multicurve module - V4 multi-position static bonding curves.
 *
 * Usage:
 * ```typescript
 * import { MulticurveBuilder, MulticurvePool } from 'doppler-sdk/multicurve'
 * ```
 */

// Export types
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
} from './types';

// Re-export V4-shared utilities that are useful for multicurve
export {
  marketCapToTicksForMulticurve,
  marketCapToTickForMulticurve,
  tickToMarketCap,
  applyTickOffsets,
  getMaxTickRounded,
} from '../internal/v4-shared';

// Re-export V4-shared constants that are useful for multicurve
export {
  DEFAULT_MULTICURVE_LOWER_TICKS,
  DEFAULT_MULTICURVE_UPPER_TICKS,
  DEFAULT_MULTICURVE_NUM_POSITIONS,
  DEFAULT_MULTICURVE_MAX_SUPPLY_SHARES,
} from '../internal/v4-shared';

// Re-export V4PoolKey type
export type { V4PoolKey } from '../internal/v4-shared';

// Re-export computePoolId
export { computePoolId } from '../internal/v4-shared';

// Export MulticurveBuilder
export { MulticurveBuilder } from './builder';

// Re-export MulticurvePool entity
export { MulticurvePool } from './pool';

// Export market cap preset utilities
export {
  MARKET_CAP_PRESETS,
  MARKET_CAP_PRESET_ORDER,
} from './constants';
export { buildCurvesFromPresets } from './utils/presetHelpers';
export type { MarketCapPresetConfig, MarketCapPresetOverrides } from './types';

// Export MulticurveFactory
export { MulticurveFactory } from './factory';
export type { MigrationEncoder as MulticurveMigrationEncoder } from './factory';
