export { StaticAuctionBuilder } from './StaticAuctionBuilder';
export { DynamicAuctionBuilder } from './DynamicAuctionBuilder';
export { MulticurveBuilder } from './MulticurveBuilder';
export { OpeningAuctionBuilder } from './OpeningAuctionBuilder';
export type {
  OpeningAuctionConfig,
  OpeningAuctionDopplerConfig,
  ResolvedOpeningAuctionDopplerConfig,
  CreateOpeningAuctionParams,
  OpeningAuctionModuleAddressOverrides,
} from './OpeningAuctionBuilder';

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
