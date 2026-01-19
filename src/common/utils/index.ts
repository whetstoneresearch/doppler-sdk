/**
 * Common utility functions for the Doppler SDK
 */

// Re-export tick math utilities
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
} from './tickMath';

// Re-export token address mining utilities
export { mineTokenAddress } from './tokenAddressMiner';
export type {
  TokenAddressHookConfig,
  TokenAddressMiningParams,
  TokenAddressMiningResult,
  TokenVariant,
} from './tokenAddressMiner';

export {
  getAirlockOwner,
  getAirlockBeneficiary,
  createAirlockBeneficiary,
  DEFAULT_AIRLOCK_BENEFICIARY_SHARES,
} from './airlock';

// Re-export price helper utilities
export {
  calculateTickRange,
  calculateTokensToSell,
  calculateGamma,
  estimatePriceAtEpoch,
  formatTickAsPrice,
  calculateMarketCap,
  calculateFDV,
  estimateSlippage,
} from './priceHelpers';

// Re-export balance delta utilities
export { decodeBalanceDelta } from './balanceDelta';

// Re-export tick helpers
export { computeTicks } from './tickHelpers';
