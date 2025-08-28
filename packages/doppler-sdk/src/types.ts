import type { Address, PublicClient, WalletClient, Transport } from 'viem'
import { base, ink, unichain } from 'viem/chains';

export type SupportedChain = typeof base | typeof ink | typeof unichain;

// Supported public clients for the Doppler SDK
export type SupportedPublicClient = PublicClient<Transport, SupportedChain>

// Core configuration types
// Token configuration (discriminated union)
export interface StandardTokenConfig {
  type?: 'standard' // default behavior (backwards compatible)
  name: string
  symbol: string
  tokenURI: string
  yearlyMintRate?: bigint // Optional yearly mint rate (in WAD, default: 2% = 0.02e18)
}

export interface Doppler404TokenConfig {
  type: 'doppler404'
  name: string
  symbol: string
  baseURI: string
}

export type TokenConfig = StandardTokenConfig | Doppler404TokenConfig

export interface SaleConfig {
  initialSupply: bigint
  numTokensToSell: bigint
  numeraire: Address // e.g., WETH address
}

// Static Auction Pool configuration
export interface StaticPoolConfig {
  startTick: number
  endTick: number
  fee: number // e.g., 3000 for 0.3%
  // Optional parameters for lockable initializer
  numPositions?: number // Number of liquidity positions (default: based on tick range)
  maxShareToBeSold?: bigint // Maximum share of tokens to sell (in WAD, default: 1e18 = 100%)
  lockableBeneficiaries?: LockableBeneficiaryData[] // Optional beneficiaries for fee streaming
}

// Dynamic Auction configuration
export interface DynamicAuctionConfig {
  duration: number // in days
  epochLength: number // in seconds
  startTick: number
  endTick: number
  gamma?: number // Optional, can be auto-calculated
  minProceeds: bigint
  maxProceeds: bigint
  numPdSlugs?: number // Price discovery slugs (optional)
}

// Vesting configuration
export interface VestingConfig {
  duration: number // in seconds
  cliffDuration: number // in seconds
}

// Governance configuration
export interface GovernanceConfig {
  initialVotingDelay?: number // in seconds (default: depends on version)
  initialVotingPeriod?: number // in seconds (default: depends on version)
  initialProposalThreshold?: bigint // in tokens (default: 0)
}

// Beneficiary data for streamable fees
export interface BeneficiaryData {
  address: Address
  percentage: number // basis points (e.g., 5000 = 50%)
}

// Lockable initializer beneficiary data (uses shares instead of percentage)
export interface LockableBeneficiaryData {
  beneficiary: Address
  shares: bigint // shares in WAD (1e18 = 100%)
}

// Pool status for lockable initializer
export enum LockablePoolStatus {
  Uninitialized = 0,
  Initialized = 1,
  Locked = 2,
  Exited = 3
}

// Lockable pool state
export interface LockablePoolState {
  asset: Address
  numeraire: Address
  tickLower: number
  tickUpper: number
  maxShareToBeSold: bigint
  totalTokensOnBondingCurve: bigint
  status: LockablePoolStatus
}

// Migration configuration (discriminated union)
export type MigrationConfig =
  | { type: 'uniswapV2' } // Basic migration to a new Uniswap v2 pool
  | {
      type: 'uniswapV3'
      fee: number
      tickSpacing: number
    }
  | {
      type: 'uniswapV4'
      fee: number
      tickSpacing: number
      // Configuration for fee streaming via StreamableFeesLocker
      streamableFees: {
        lockDuration: number // in seconds
        beneficiaries: BeneficiaryData[]
      }
      // For no-op governance where 100% of liquidity is permanently locked
      noOpGovernance?: boolean
    }

// Create Static Auction parameters
export interface CreateStaticAuctionParams {
  // Token configuration
  token: TokenConfig

  // Sale configuration
  sale: SaleConfig

  // Static Auction (Uniswap v3) Pool configuration
  pool: StaticPoolConfig

  // Vesting configuration (optional)
  vesting?: VestingConfig

  // Governance configuration (optional)
  governance?: GovernanceConfig

  // Explicit Migration Configuration
  migration: MigrationConfig

  // Integrator details
  integrator?: Address
  userAddress: Address
}

// Create Dynamic Auction parameters
export interface CreateDynamicAuctionParams {
  // Token configuration
  token: TokenConfig

  // Sale configuration
  sale: SaleConfig

  // Dynamic Auction (Uniswap v4 Hook) configuration
  auction: DynamicAuctionConfig
  
  // Pool configuration
  pool: {
    fee: number // e.g., 3000 for 0.3%
    tickSpacing: number
  }

  // Vesting configuration (optional)
  vesting?: VestingConfig

  // Governance configuration (optional)
  governance?: GovernanceConfig

  // Explicit Migration Configuration
  migration: MigrationConfig

  // Integrator details
  integrator?: Address
  userAddress: Address
  
  // Time configuration (internal use)
  startTimeOffset?: number
  blockTimestamp?: number // Optional: use this block timestamp instead of fetching latest
}

// Price range configuration for automatic tick calculation
export interface PriceRange {
  startPrice: number
  endPrice: number
}

// Tick range configuration
export interface TickRange {
  startTick: number
  endTick: number
}

// Build configuration for static auctions (V3-style)
export interface StaticAuctionBuildConfig {
  // Token details
  name: string
  symbol: string
  totalSupply?: bigint // default: 1 billion
  numTokensToSell?: bigint // default: 900 million
  tokenURI: string

  // Time parameters
  startTimeOffset?: number // Optional - seconds to add to current block timestamp (default: 30)

  // Price parameters - must provide either priceRange or tickRange
  numeraire: Address // Required for V3
  tickRange?: TickRange
  priceRange?: PriceRange
  fee?: number // default: 10000 (1%)
  
  // Pool parameters (V3 specific)
  numPositions?: number // default: 15
  maxShareToBeSold?: bigint // default: 35% in WAD

  // Vesting parameters
  yearlyMintRate?: bigint // default: 2%
  vestingDuration?: bigint // default: 1 year
  recipients?: Address[] // defaults to [userAddress]
  amounts?: bigint[] // defaults based on pre-mint calculation

  // Migration configuration
  migration: MigrationConfig

  // Other parameters
  integrator?: Address
  useGovernance?: boolean // default: true
}

// Build configuration for dynamic auctions (V4-style)
export interface DynamicAuctionBuildConfig {
  // Token details
  name: string
  symbol: string
  totalSupply: bigint
  numTokensToSell: bigint
  tokenURI: string

  // Time parameters
  startTimeOffset?: number // Optional - seconds to add to block timestamp (default: 30)
  blockTimestamp?: number // Optional - specific block timestamp to use (default: fetch latest)
  duration?: number // in days (default: 7)
  epochLength?: number // in seconds (default: 3600)

  // Price parameters - must provide either priceRange or tickRange
  numeraire?: Address // defaults to zero address
  tickRange?: TickRange
  priceRange?: PriceRange
  tickSpacing: number
  gamma?: number // auto-calculated if not provided
  fee: number // In basis points

  // Sale parameters
  minProceeds: bigint
  maxProceeds: bigint
  numPdSlugs?: number // default: 5

  // Vesting parameters
  yearlyMintRate?: bigint // default: 2%
  vestingDuration: bigint
  recipients: Address[]
  amounts: bigint[]

  // Migration configuration
  migration: MigrationConfig

  // Other parameters
  integrator?: Address
  useGovernance?: boolean // default: true
}

// SDK initialization configuration
export interface DopplerSDKConfig {
  publicClient: SupportedPublicClient
  walletClient?: WalletClient
  chainId: number
}

// Pool information types
export interface PoolInfo {
  address: Address
  tokenAddress: Address
  numeraireAddress: Address
  fee: number
  liquidity: bigint
  sqrtPriceX96: bigint
}

export interface HookInfo {
  hookAddress: Address
  tokenAddress: Address
  numeraireAddress: Address
  poolId: string
  currentEpoch: number
  totalProceeds: bigint
  totalTokensSold: bigint
  earlyExit: boolean
  insufficientProceeds: boolean
  startingTime: bigint
  endingTime: bigint
  epochLength: bigint
  minimumProceeds: bigint
  maximumProceeds: bigint
}


// Quote result type
export interface QuoteResult {
  amountOut: bigint
  priceImpact: number
  fee: bigint
  route: string[]
}

// Lockable Uniswap V3 Initializer encode params
export interface LockableV3InitializerParams {
  fee: number
  tickLower: number
  tickUpper: number
  numPositions: number
  maxShareToBeSold: bigint
  beneficiaries: LockableBeneficiaryData[]
}
