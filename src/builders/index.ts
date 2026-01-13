export { StaticAuctionBuilder } from './StaticAuctionBuilder';
export { DynamicAuctionBuilder } from './DynamicAuctionBuilder';
export { MulticurveBuilder } from './MulticurveBuilder';

// Re-export shared utilities and interfaces for advanced usage
export {
  computeTicks,
  MARKET_CAP_PRESETS,
  MARKET_CAP_PRESET_ORDER,
  buildCurvesFromPresets,
} from './shared';

export type {
  BaseAuctionBuilder,
  MarketCapPresetConfig,
  MarketCapPresetOverrides,
} from './shared';
