import type { Address } from '@solana/kit';

// ============================================================================
// Swap Direction
// ============================================================================

/**
 * Direction of a swap operation
 * - 0: token0 -> token1 (sell token0 for token1)
 * - 1: token1 -> token0 (sell token1 for token0)
 */
export type SwapDirection = 0 | 1;

// ============================================================================
// Account Types
// ============================================================================

/**
 * Global AMM configuration account
 * PDA: ['config']
 */
export interface AmmConfig {
  /** Admin pubkey with authority over pools */
  admin: Address;
  /** Whether all pool operations are paused */
  paused: boolean;
  /** Default numeraire mint for pricing */
  numeraireMint: Address;
  /** Number of programs in sentinel allowlist */
  sentinelAllowlistLen: number;
  /** Allowlist of sentinel programs (fixed size: 32) */
  sentinelAllowlist: Address[];
  /** Maximum allowed swap fee in basis points */
  maxSwapFeeBps: number;
  /** Maximum allowed fee split in basis points */
  maxFeeSplitBps: number;
  /** Maximum number of hops for routing */
  maxRouteHops: number;
  /** Whether protocol fees are enabled */
  protocolFeeEnabled: boolean;
  /** Protocol fee in basis points (share of LP fees) */
  protocolFeeBps: number;
  /** Account version for migrations */
  version: number;
  /** Reserved bytes for future use */
  reserved: Uint8Array;
}

/**
 * Pool account for a trading pair
 * PDA: ['pool', token0_mint, token1_mint]
 */
export interface Pool {
  /** Reference to the AmmConfig account */
  config: Address;
  /** Mint of token0 (lexicographically smaller) */
  token0Mint: Address;
  /** Mint of token1 (lexicographically larger) */
  token1Mint: Address;
  /** Token account holding token0 reserves */
  vault0: Address;
  /** Token account holding token1 reserves */
  vault1: Address;
  /** PDA authority for vault transfers */
  authority: Address;
  /** Bump seed for authority PDA */
  bump: number;
  /** Current reserve of token0 (excluding distributable fees) */
  reserve0: bigint;
  /** Current reserve of token1 (excluding distributable fees) */
  reserve1: bigint;
  /** Total LP shares outstanding (u128) */
  totalShares: bigint;
  /** Swap fee in basis points (0-10000) */
  swapFeeBps: number;
  /** Fee split: % of swap fee that goes to distributable (vs compounding) */
  feeSplitBps: number;
  /** Global fee growth per share for token0 (Q64.64) */
  feeGrowthGlobal0Q64: bigint;
  /** Global fee growth per share for token1 (Q64.64) */
  feeGrowthGlobal1Q64: bigint;
  /** Unclaimed distributable fees in token0 */
  feesUnclaimed0: bigint;
  /** Unclaimed distributable fees in token1 */
  feesUnclaimed1: bigint;
  /** Sentinel program for hooks (default = disabled) */
  sentinelProgram: Address;
  /** Bitflags for enabled sentinel hooks */
  sentinelFlags: number;
  /** Override numeraire mint for this pool */
  numeraireMint: Address;
  /** Which token to use for liquidity measure (0 or 1) */
  liquidityMeasureSide: number;
  /** Next pool in routing chain (default = none) */
  routeNextPool: Address;
  /** Bridge mint for routing (must be token0 or token1) */
  routeBridgeMint: Address;
  /** Last k value for protocol fee calculation (u128) */
  kLast: bigint;
  /** Protocol position for protocol fee shares */
  protocolPosition: Address;
  /** Reentrancy lock (0 = unlocked, 1 = locked) */
  locked: number;
  /** Account version for migrations */
  version: number;
  /** Reserved bytes for future use */
  reserved: Uint8Array;
}

/**
 * Position account representing LP ownership
 * PDA: ['position', pool, owner, position_id]
 */
export interface Position {
  /** The pool this position is for */
  pool: Address;
  /** Owner of the position */
  owner: Address;
  /** Unique position ID for this owner (allows multiple positions) */
  positionId: bigint;
  /** Number of LP shares owned (u128) */
  shares: bigint;
  /** Checkpoint of fee growth for token0 (Q64.64) */
  feeGrowthLast0Q64: bigint;
  /** Checkpoint of fee growth for token1 (Q64.64) */
  feeGrowthLast1Q64: bigint;
  /** Accrued uncollected fees in token0 */
  feeOwed0: bigint;
  /** Accrued uncollected fees in token1 */
  feeOwed1: bigint;
  /** Account version for migrations */
  version: number;
  /** Reserved bytes for future use */
  reserved: Uint8Array;
}

/**
 * Single TWAP observation
 */
export interface Observation {
  /** Timestamp of this observation */
  timestamp: number;
  /** Cumulative price0 at this timestamp (Q64.64 accumulated, U256) */
  price0Cumulative: bigint;
  /** Cumulative price1 at this timestamp (Q64.64 accumulated, U256) */
  price1Cumulative: bigint;
}

/**
 * Oracle state for TWAP price tracking
 * PDA: ['oracle', pool]
 */
export interface OracleState {
  /** The pool this oracle tracks */
  pool: Address;
  /** Whether oracle has been initialized with first observation */
  initialized: boolean;
  /** Maximum price change ratio per slot (Q64.64, e.g., 1.1 = 10% max move) */
  maxPriceChangeRatioQ64: bigint;
  /** Last slot when oracle was updated */
  lastSlot: bigint;
  /** Truncated (clamped) price of token0 in token1 (Q64.64) */
  truncPrice0Q64: bigint;
  /** Truncated (clamped) price of token1 in token0 (Q64.64) */
  truncPrice1Q64: bigint;
  /** Deviation between spot and truncated price0 (Q64.64) */
  deviation0Q64: bigint;
  /** Deviation between spot and truncated price1 (Q64.64) */
  deviation1Q64: bigint;
  /** Cumulative truncated price0 (wrapping U256) */
  price0Cumulative: bigint;
  /** Cumulative truncated price1 (wrapping U256) */
  price1Cumulative: bigint;
  /** Last timestamp when oracle was updated */
  lastTimestamp: number;
  /** Last timestamp when an observation was recorded */
  lastObservationTimestamp: number;
  /** Minimum seconds between observations */
  observationIntervalSec: number;
  /** Current index in circular observation buffer */
  observationIndex: number;
  /** Circular buffer of TWAP observations (fixed size: 64) */
  observations: Observation[];
  /** Account version for migrations */
  version: number;
  /** Reserved bytes for future use */
  reserved: Uint8Array;
}

// ============================================================================
// Instruction Argument Types
// ============================================================================

export interface InitializeConfigArgs {
  admin: Address;
  numeraireMint: Address;
  maxSwapFeeBps: number;
  maxFeeSplitBps: number;
  maxRouteHops: number;
  protocolFeeEnabled: boolean;
  protocolFeeBps: number;
  sentinelAllowlist: Address[];
}

export interface InitializePoolArgs {
  mintA: Address;
  mintB: Address;
  initialSwapFeeBps: number;
  initialFeeSplitBps: number;
  liquidityMeasureSide: number;
  numeraireMintOverride: Address | null;
}

export interface InitializeOracleArgs {
  maxPriceChangeRatioQ64: bigint;
  observationIntervalSec: number;
  numObservations: number;
}

export interface CreatePositionArgs {
  positionId: bigint;
}

export interface AddLiquidityArgs {
  amount0Max: bigint;
  amount1Max: bigint;
  minSharesOut: bigint;
  updateOracle: boolean;
}

export interface RemoveLiquidityArgs {
  sharesIn: bigint;
  minAmount0Out: bigint;
  minAmount1Out: bigint;
  updateOracle: boolean;
}

export interface SwapExactInArgs {
  amountIn: bigint;
  minAmountOut: bigint;
  direction: SwapDirection;
  updateOracle: boolean;
}

export interface CollectFeesArgs {
  max0: bigint;
  max1: bigint;
}

export interface CollectProtocolFeesArgs {
  max0: bigint;
  max1: bigint;
}

export interface SetSentinelArgs {
  sentinelProgram: Address;
  sentinelFlags: number;
}

export interface SetFeesArgs {
  swapFeeBps: number;
  feeSplitBps: number;
}

export interface SetRouteArgs {
  routeNextPool: Address;
  routeBridgeMint: Address;
}

export interface TransferAdminArgs {
  newAdmin: Address;
}

export interface OracleConsultArgs {
  windowSeconds: number;
}

export interface QuoteToNumeraireArgs {
  amount: bigint;
  side: number;
  maxHops: number;
  /** Must be false in v0.1 (spot-only) */
  useTwap: boolean;
  /** Must be 0 in v0.1 (spot-only) */
  windowSeconds: number;
}

// ============================================================================
// Quote/Result Types
// ============================================================================

export interface SwapQuote {
  /** Expected output amount */
  amountOut: bigint;
  /** Total fee charged (in input token) */
  feeTotal: bigint;
  /** Distributable portion of fee */
  feeDist: bigint;
  /** Compounding portion of fee */
  feeComp: bigint;
  /** Price impact as a decimal (0.01 = 1%) */
  priceImpact: number;
  /** Execution price (output/input) */
  executionPrice: number;
}

export interface AddLiquidityQuote {
  /** Shares the user will receive */
  sharesOut: bigint;
  /** Actual amount of token0 to deposit */
  amount0: bigint;
  /** Actual amount of token1 to deposit */
  amount1: bigint;
  /** Share of pool after deposit */
  poolShare: number;
}

export interface RemoveLiquidityQuote {
  /** Amount of token0 to receive */
  amount0: bigint;
  /** Amount of token1 to receive */
  amount1: bigint;
}

export interface TwapResult {
  /** TWAP price of token0 in token1 (Q64.64) */
  price0Q64: bigint;
  /** TWAP price of token1 in token0 (Q64.64) */
  price1Q64: bigint;
  /** TWAP price of token0 in token1 (decimal) */
  price0: number;
  /** TWAP price of token1 in token0 (decimal) */
  price1: number;
}

// ============================================================================
// Event Types (for transaction log parsing)
// ============================================================================

export interface SwapEvent {
  pool: Address;
  user: Address;
  direction: SwapDirection;
  amountIn: bigint;
  amountOut: bigint;
  feeTotal: bigint;
  feeDist: bigint;
}

export interface AddLiquidityEvent {
  pool: Address;
  owner: Address;
  amount0: bigint;
  amount1: bigint;
  sharesOut: bigint;
}

export interface RemoveLiquidityEvent {
  pool: Address;
  owner: Address;
  amount0: bigint;
  amount1: bigint;
  sharesIn: bigint;
}

export interface CollectFeesEvent {
  pool: Address;
  owner: Address;
  amount0: bigint;
  amount1: bigint;
}

export interface CollectProtocolFeesEvent {
  pool: Address;
  amount0: bigint;
  amount1: bigint;
  recipient0: Address;
  recipient1: Address;
}

export interface PoolInitializedEvent {
  pool: Address;
  token0Mint: Address;
  token1Mint: Address;
  vault0: Address;
  vault1: Address;
}

export interface PositionCreatedEvent {
  pool: Address;
  owner: Address;
  position: Address;
  positionId: bigint;
}

export interface PositionClosedEvent {
  pool: Address;
  owner: Address;
  position: Address;
}

export interface SentinelInvokedEvent {
  pool: Address;
  action: number;
  allow: number;
  newFeeBps: number;
  newSplitBps: number;
}

export interface SentinelErrorEvent {
  pool: Address;
  action: number;
  errorCode: bigint;
}

export interface SentinelUpdatedEvent {
  pool: Address;
  sentinelProgram: Address;
  sentinelFlags: number;
  admin: Address;
}

export interface FeesUpdatedEvent {
  pool: Address;
  prevSwapFeeBps: number;
  prevFeeSplitBps: number;
  swapFeeBps: number;
  feeSplitBps: number;
  source: number;
}

export interface OracleInitializedEvent {
  pool: Address;
  maxPriceChangeRatioQ64: bigint;
  observationIntervalSec: number;
  admin: Address;
}

export interface OracleUpdatedEvent {
  pool: Address;
  slot: bigint;
  truncPrice0Q64: bigint;
  truncPrice1Q64: bigint;
  deviation0Q64: bigint;
  deviation1Q64: bigint;
}

export interface RouteUpdatedEvent {
  pool: Address;
  routeNextPool: Address;
  routeBridgeMint: Address;
  admin: Address;
}

export interface AdminTransferredEvent {
  oldAdmin: Address;
  newAdmin: Address;
}

export interface PausedEvent {}

export interface UnpausedEvent {}

export interface SkimmedEvent {
  pool: Address;
  amount0: bigint;
  amount1: bigint;
}

// ============================================================================
// Market Cap Helpers
// ============================================================================

export interface MarketCapValidationResult {
  valid: boolean;
  warnings: string[];
}

export interface CurveParams {
  /** Virtual base token reserves for the XYK curve */
  curveVirtualBase: bigint;
  /** Virtual quote token reserves for the XYK curve */
  curveVirtualQuote: bigint;
}

export interface MarketCapToCurveParamsInput {
  /** Starting market cap in USD (price at launch open) */
  startMarketCapUSD: number;
  /** Ending market cap in USD (graduation / migration threshold) */
  endMarketCapUSD: number;
  /** Total base token supply including all decimals (raw u64) */
  baseTotalSupply: bigint;
  /**
   * Base tokens allocated to the curve vault
   * (baseTotalSupply - baseForDistribution - baseForLiquidity).
   * Determines the initial spot price: virtual_quote / (baseForCurve + virtualBase).
   */
  baseForCurve: bigint;
  /** Decimals of the base (launched) token */
  baseDecimals: number;
  /** Decimals of the quote (numeraire) token, e.g. 9 for SOL, 6 for USDC */
  quoteDecimals: number;
  /** USD price of one unit of the numeraire token (e.g. SOL price in USD) */
  numerairePriceUSD: number;
  /**
   * Virtual base reserve to use as the canonical anchor. Defaults to `baseForCurve`.
   * Changing this scales `curveVirtualQuote` proportionally — the resulting spot
   * price is unchanged, but a larger value gives finer integer granularity at the
   * cost of a proportionally larger `curveVirtualQuote`. Only override if you have
   * a specific reason; the default is appropriate for most launches.
   */
  virtualBase?: bigint;
}

export interface CurveParamsToMarketCapInput {
  curveVirtualBase: bigint;
  curveVirtualQuote: bigint;
  /**
   * Base tokens available to the curve (vault balance minus reserved allocations).
   * Computed as: baseVaultBalance - baseForDistribution - baseForLiquidity.
   * At launch open this equals baseForCurve.
   */
  baseReserve: bigint;
  /** Current quote token vault balance (raw u64) */
  quoteReserve: bigint;
  baseTotalSupply: bigint;
  baseDecimals: number;
  quoteDecimals: number;
  numerairePriceUSD: number;
}
