export { StaticAuctionBuilder } from './StaticAuctionBuilder'
export { DynamicAuctionBuilder } from './DynamicAuctionBuilder'
export { MulticurveBuilder } from './MulticurveBuilder'

// Re-export shared utilities and interfaces for advanced usage
export {
  computeTicks,
  MARKET_CAP_PRESETS,
  MARKET_CAP_PRESET_ORDER,
  buildCurvesFromPresets,
  type BaseAuctionBuilder,
  type MarketCapPresetConfig,
  type MarketCapPresetOverrides,
} from './shared'
