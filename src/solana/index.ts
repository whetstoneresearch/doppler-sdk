/**
 * @soloppler/sdk - TypeScript SDK for the Soloppler CPMM AMM
 *
 * @packageDocumentation
 */

// ============================================================================
// Core Exports
// ============================================================================

// Constants
export {
  PROGRAM_ID,
  SENTINEL_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  TOKEN_METADATA_PROGRAM_ID,
  SYSTEM_PROGRAM_ID,
  BPS_DENOM,
  Q64_ONE,
  ACCOUNT_VERSION,
  MAX_SENTINEL_ALLOWLIST,
  MAX_ORACLE_OBSERVATIONS,
  SEED_CONFIG,
  SEED_POOL,
  SEED_AUTHORITY,
  SEED_POSITION,
  SEED_ORACLE,
  SEED_PROTOCOL_POSITION,
  SF_BEFORE_SWAP,
  SF_AFTER_SWAP,
  SF_BEFORE_ADD_LIQ,
  SF_AFTER_ADD_LIQ,
  SF_BEFORE_REMOVE_LIQ,
  SF_AFTER_REMOVE_LIQ,
  SENTINEL_NO_CHANGE,
  INSTRUCTION_DISCRIMINATORS,
  ACCOUNT_DISCRIMINATORS,
  ACCOUNT_ROLE_READONLY,
  ACCOUNT_ROLE_WRITABLE,
  ACCOUNT_ROLE_SIGNER,
  ACCOUNT_ROLE_WRITABLE_SIGNER,
} from './core/index.js';

// Types
export type {
  SwapDirection,
  AmmConfig,
  Pool,
  Position,
  Observation,
  OracleState,
  InitializeConfigArgs,
  InitializePoolArgs,
  InitializeOracleArgs,
  CreatePositionArgs,
  AddLiquidityArgs,
  RemoveLiquidityArgs,
  SwapExactInArgs,
  CollectFeesArgs,
  CollectProtocolFeesArgs,
  SetSentinelArgs,
  SetFeesArgs,
  SetRouteArgs,
  TransferAdminArgs,
  OracleConsultArgs,
  QuoteToNumeraireArgs,
  SwapQuote,
  AddLiquidityQuote,
  RemoveLiquidityQuote,
  TwapResult,
  SwapEvent,
  AddLiquidityEvent,
  RemoveLiquidityEvent,
  CollectFeesEvent,
  CollectProtocolFeesEvent,
  PoolInitializedEvent,
  PositionCreatedEvent,
  PositionClosedEvent,
  SentinelInvokedEvent,
  SentinelErrorEvent,
  SentinelUpdatedEvent,
  FeesUpdatedEvent,
  OracleInitializedEvent,
  OracleUpdatedEvent,
  RouteUpdatedEvent,
  AdminTransferredEvent,
  PausedEvent,
  UnpausedEvent,
  SkimmedEvent,
  MarketCapValidationResult,
  CurveParams,
  MarketCapToCurveParamsInput,
  CurveParamsToMarketCapInput,
} from './core/index.js';

// Codecs
export {
  decodeAmmConfig,
  decodePool,
  decodePosition,
  decodeOracleState,
} from './core/index.js';

// PDA derivation
export {
  sortMints,
  areMintsOrdered,
  getConfigAddress,
  getPoolAddress,
  getPoolAuthorityAddress,
  getPositionAddress,
  getOracleAddress,
  getProtocolPositionAddress,
  getPoolInitAddresses,
  getSwapAddresses,
  getLiquidityAddresses,
  getMetadataAddress,
} from './core/index.js';

// Market cap helpers
export {
  marketCapToTokenPrice,
  validateMarketCapParameters,
  marketCapToCurveParams,
  marketCapToSingleCurveParams,
  curveParamsToMarketCap,
} from './core/index.js';

// Math utilities
export {
  q64ToNumber,
  numberToQ64,
  q64Mul,
  q64Div,
  computePrice0Q64,
  computePrice1Q64,
  isqrt,
  ceilDiv,
  minBigInt,
  maxBigInt,
  ratioToNumber,
  getSwapQuote,
  getSwapQuoteExactOut,
  getAddLiquidityQuote,
  getRemoveLiquidityQuote,
  calculateAccruedFees,
  getPendingFees,
  getSpotPrice0,
  getSpotPrice1,
  getK,
  getTvl,
  calculateTwap,
  calculateTwapNumber,
} from './core/index.js';

// Errors
export {
  CpmmErrorCode,
  CPMM_ERROR_MESSAGES,
  CpmmError,
  parseErrorFromLogs,
  isCpmmError,
  getErrorMessage,
} from './core/index.js';

// ============================================================================
// Instruction Builders
// ============================================================================

export {
  // Config/Pool initialization
  createInitializeConfigInstruction,
  createInitializePoolInstruction,
  createInitializeOracleInstruction,
  // Admin controls
  createSetFeesInstruction,
  createSetSentinelInstruction,
  createSetRouteInstruction,
  createPauseInstruction,
  createUnpauseInstruction,
  createTransferAdminInstruction,
  createSkimInstruction,
  // Trading
  createSwapExactInInstruction,
  createSwapInstruction,
  // Position lifecycle
  createCreatePositionInstruction,
  createClosePositionInstruction,
  // Liquidity management
  createAddLiquidityInstruction,
  createRemoveLiquidityInstruction,
  // Fee collection
  createCollectFeesInstruction,
  MAX_FEE_AMOUNT,
  createCollectProtocolFeesInstruction,
  // Oracle operations
  createOracleUpdateInstruction,
  createOracleConsultInstruction,
  decodeOracleConsultResult,
  createQuoteToNumeraireInstruction,
  decodeQuoteToNumeraireResult,
} from './instructions/index.js';

// Instruction account types
export type {
  InitializeConfigAccounts,
  InitializePoolAccounts,
  InitializeOracleAccounts,
  SetFeesAccounts,
  SetSentinelAccounts,
  SetRouteAccounts,
  PauseAccounts,
  UnpauseAccounts,
  TransferAdminAccounts,
  SkimAccounts,
  SwapExactInAccounts,
  CreatePositionAccounts,
  ClosePositionAccounts,
  AddLiquidityAccounts,
  AddLiquidityArgsWithOracle,
  RemoveLiquidityAccounts,
  CollectFeesAccounts,
  CollectProtocolFeesAccounts,
  OracleUpdateAccounts,
  OracleConsultAccounts,
  OracleConsultResult,
  QuoteToNumeraireAccounts,
  QuoteToNumeraireResult,
} from './instructions/index.js';

// ============================================================================
// Client Helpers
// ============================================================================

export {
  // Pool operations
  fetchPool,
  fetchAllPools,
  getPoolByMints,
  fetchPoolsBatch,
  poolExists,
  getPoolAddressFromMints,
  filterPoolsByMint,
  sortPoolsByReserves,
  // Config operations
  fetchConfig,
  fetchConfigWithAddress,
  // Position operations
  fetchPosition,
  fetchUserPositions,
  getPositionValue,
  fetchPoolPositions,
  fetchPositionByParams,
  fetchPositionsBatch,
  // Oracle operations
  fetchOracle,
  getOracleForPool,
  consultTwap,
  getOracleSpotPrices,
  getOracleDeviation,
  isOracleStale,
  getOracleBufferStats,
} from './client/index.js';

// Client result types
export type {
  PositionValue,
  FetchPoolsConfig,
  PoolWithAddress,
  FetchPositionsConfig,
  PositionWithAddress,
  FetchOracleConfig,
  OracleWithAddress,
} from './client/index.js';

// Additional client exports
export {
  getPositionAddressFromParams,
  filterActivePositions,
  sortPositionsByShares,
  getOracleAddressFromPool,
  getOracleAge,
  fetchOraclesBatch,
  comparePoolAndOraclePrices,
} from './client/index.js';

// ============================================================================
// Initializer Support
// ============================================================================

export * as initializer from './initializer/index.js';

// ============================================================================
// Migrators (modules invoked by initializer)
// ============================================================================

export * as cpmmMigrator from './migrators/cpmmMigrator/index.js';
