/**
 * Static Auction module - V3-style bonding curve auctions.
 *
 * Usage:
 * ```typescript
 * import { StaticAuctionBuilder, StaticAuction } from 'doppler-sdk/static'
 * ```
 */

// Export types
export type {
  StaticPoolConfig,
  CreateStaticAuctionParams,
  StaticAuctionMarketCapConfig,
  StaticAuctionTickParams,
  LockableV3InitializerParams,
  LockablePoolState,
  StaticAuctionBuildConfig,
} from './types';

export { LockablePoolStatus } from './types';

// Export constants
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
} from './constants';

// Export market cap helpers
export {
  marketCapToTicksForStaticAuction,
  marketCapToTokenPrice,
  tokenPriceToRatio,
  ratioToTick,
  validateMarketCapParameters,
} from './utils/marketCapHelpers';

// Export StaticAuctionBuilder
export { StaticAuctionBuilder } from './StaticAuctionBuilder';

// Re-export StaticAuction entity
export { StaticAuction } from '../entities/auction/StaticAuction';

// Export StaticAuctionFactory
export { StaticAuctionFactory } from './StaticAuctionFactory';
export type { MigrationEncoder as StaticMigrationEncoder } from './StaticAuctionFactory';
