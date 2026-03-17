/**
 * CPMM SDK Client Helpers
 *
 * This module provides utility functions for fetching and working with
 * CPMM pool, position, and oracle accounts.
 */

// Pool fetching and utilities
export {
  fetchPool,
  fetchAllPools,
  getPoolByMints,
  fetchPoolsBatch,
  poolExists,
  getPoolAddressFromMints,
  filterPoolsByMint,
  sortPoolsByReserves,
  type FetchPoolsConfig,
  type PoolWithAddress,
} from './pool.js';

// Config fetching
export { fetchConfig, fetchConfigWithAddress } from './config.js';

// Position fetching and utilities
export {
  fetchPosition,
  fetchUserPositions,
  fetchPoolPositions,
  getPositionValue,
  fetchPositionByParams,
  getPositionAddressFromParams,
  fetchPositionsBatch,
  filterActivePositions,
  sortPositionsByShares,
  type FetchPositionsConfig,
  type PositionWithAddress,
  type PositionValue,
} from './position.js';

// Oracle fetching and TWAP utilities
export {
  fetchOracle,
  getOracleForPool,
  getOracleAddressFromPool,
  consultTwap,
  getOracleSpotPrices,
  getOracleDeviation,
  getOracleAge,
  isOracleStale,
  getOracleBufferStats,
  fetchOraclesBatch,
  comparePoolAndOraclePrices,
  type FetchOracleConfig,
  type OracleWithAddress,
} from './oracle.js';
