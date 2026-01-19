/**
 * Dynamic Auction module - V4 Dutch auction style bonding curves.
 *
 * Usage:
 * ```typescript
 * import { DynamicAuctionBuilder, DynamicAuction } from 'doppler-sdk/dynamic'
 * ```
 */

// Export types
export type {
  DynamicAuctionConfig,
  CreateDynamicAuctionParams,
  DynamicMarketCapRange,
  DynamicAuctionMarketCapConfig,
  DynamicAuctionTickParams,
  DynamicAuctionBuildConfig,
} from './types';

// Export utilities
export { computeOptimalGamma } from './utils/gamma';

// Re-export V4-shared utilities that are useful for dynamic auctions
export {
  marketCapToTicksForDynamicAuction,
  isToken0Expected,
  tickToMarketCap,
} from '../internal/v4-shared';

// Re-export V4-shared constants that are useful for dynamic auctions
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
} from '../internal/v4-shared';

// Re-export V4PoolKey type
export type { V4PoolKey } from '../internal/v4-shared';

// Re-export computePoolId
export { computePoolId } from '../internal/v4-shared';

// Export DynamicAuctionBuilder
export { DynamicAuctionBuilder } from './DynamicAuctionBuilder';

// Re-export DynamicAuction entity
export { DynamicAuction } from '../entities/auction/DynamicAuction';

// Export DynamicAuctionFactory
export { DynamicAuctionFactory } from './DynamicAuctionFactory';
export type { MigrationEncoder as DynamicMigrationEncoder } from './DynamicAuctionFactory';
