/**
 * Constants for Multicurve market cap presets.
 */

import {
  DEFAULT_MULTICURVE_LOWER_TICKS,
  DEFAULT_MULTICURVE_MAX_SUPPLY_SHARES,
  DEFAULT_MULTICURVE_NUM_POSITIONS,
  DEFAULT_MULTICURVE_UPPER_TICKS,
} from '../internal/v4-shared';
import type { MulticurveMarketCapPreset } from './types';
import type { MarketCapPresetConfig } from './types';

/**
 * The order of market cap presets from lowest to highest.
 */
export const MARKET_CAP_PRESET_ORDER = [
  'low',
  'medium',
  'high',
] as const satisfies readonly MulticurveMarketCapPreset[];

/**
 * Default configurations for each market cap preset tier.
 * These provide sensible defaults for common launch scenarios.
 */
export const MARKET_CAP_PRESETS: Record<
  MulticurveMarketCapPreset,
  MarketCapPresetConfig
> = {
  low: {
    tickLower: DEFAULT_MULTICURVE_LOWER_TICKS[0],
    tickUpper: DEFAULT_MULTICURVE_UPPER_TICKS[0],
    numPositions: DEFAULT_MULTICURVE_NUM_POSITIONS[0],
    shares: DEFAULT_MULTICURVE_MAX_SUPPLY_SHARES[0],
  },
  medium: {
    tickLower: DEFAULT_MULTICURVE_LOWER_TICKS[1],
    tickUpper: DEFAULT_MULTICURVE_UPPER_TICKS[1],
    numPositions: DEFAULT_MULTICURVE_NUM_POSITIONS[1],
    shares: DEFAULT_MULTICURVE_MAX_SUPPLY_SHARES[1],
  },
  high: {
    tickLower: DEFAULT_MULTICURVE_LOWER_TICKS[2],
    tickUpper: DEFAULT_MULTICURVE_UPPER_TICKS[2],
    numPositions: DEFAULT_MULTICURVE_NUM_POSITIONS[2],
    shares: DEFAULT_MULTICURVE_MAX_SUPPLY_SHARES[2],
  },
};
