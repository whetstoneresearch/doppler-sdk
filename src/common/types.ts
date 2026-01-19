import type { Address } from 'viem';
import { CHAIN_IDS, type SupportedChainId } from './addresses';

// Re-export SupportedChainId so consumers can import from this module
export { type SupportedChainId } from './addresses';

// Core configuration types
// Token configuration (discriminated union)
export interface StandardTokenConfig {
  type?: 'standard'; // default behavior (backwards compatible)
  name: string;
  symbol: string;
  tokenURI: string;
  yearlyMintRate?: bigint; // Optional yearly mint rate (in WAD, default: 2% = 0.02e18)
}

export interface Doppler404TokenConfig {
  type: 'doppler404';
  name: string;
  symbol: string;
  baseURI: string;
  // Optional unit for DN404 factory (uint256). Defaults to 1000 when omitted.
  unit?: bigint;
}

export type TokenConfig = StandardTokenConfig | Doppler404TokenConfig;

export interface SaleConfig {
  initialSupply: bigint;
  numTokensToSell: bigint;
  numeraire: Address; // e.g., WETH address
}

// Vesting configuration
export interface VestingConfig {
  duration: number; // in seconds
  cliffDuration: number; // in seconds
  recipients?: Address[]; // Optional array of recipient addresses (defaults to [userAddress] if not specified)
  amounts?: bigint[]; // Optional array of vesting amounts per recipient (must match recipients length if provided)
}

// Chains where no-op governance is enabled
export const NO_OP_ENABLED_CHAIN_IDS = [
  CHAIN_IDS.BASE,
  CHAIN_IDS.BASE_SEPOLIA,
  CHAIN_IDS.UNICHAIN,
  CHAIN_IDS.UNICHAIN_SEPOLIA,
  CHAIN_IDS.MONAD_TESTNET,
  CHAIN_IDS.MONAD_MAINNET,
] as const;

export type NoOpEnabledChainId = (typeof NO_OP_ENABLED_CHAIN_IDS)[number];

/**
 * Check if a chain supports no-op governance
 */
export function isNoOpEnabledChain(
  chainId: number,
): chainId is NoOpEnabledChainId {
  return (NO_OP_ENABLED_CHAIN_IDS as readonly number[]).includes(chainId);
}

// Governance configuration (discriminated union)
export type GovernanceDefault = { type: 'default' };
export interface GovernanceCustom {
  type: 'custom';
  initialVotingDelay: number;
  initialVotingPeriod: number;
  initialProposalThreshold: bigint;
}
export type GovernanceNoOp = { type: 'noOp' };

export type GovernanceOption<C extends SupportedChainId> =
  | GovernanceDefault
  | GovernanceCustom
  | (C extends NoOpEnabledChainId ? GovernanceNoOp : never);

// Unified beneficiary data used for fee streaming, lockable initializers, and migration configs
// Uses shares in WAD format (1e18 = 100%) for consistency across all beneficiary configurations
export interface BeneficiaryData {
  beneficiary: Address;
  shares: bigint; // shares in WAD (1e18 = 100%)
}

// Migration configuration (discriminated union)
export type MigrationConfig =
  | { type: 'uniswapV2' } // Basic migration to a new Uniswap v2 pool
  | {
      type: 'uniswapV4';
      fee: number;
      tickSpacing: number;
      // Configuration for fee streaming via StreamableFeesLocker (optional)
      // When omitted, fees are not locked and beneficiaries are not configured
      // This is useful when using noOp governance where lock duration is not meaningful
      streamableFees?: {
        lockDuration: number; // in seconds
        beneficiaries: BeneficiaryData[]; // Uses shares in WAD (1e18 = 100%)
      };
    }
  | { type: 'noOp' }; // No migration - used with lockable beneficiaries

// Price range configuration for automatic tick calculation
export interface PriceRange {
  startPrice: number;
  endPrice: number;
}

// Tick range configuration
export interface TickRange {
  startTick: number;
  endTick: number;
}

// ============================================================================
// Market Cap Configuration Types
// ============================================================================

/**
 * Market cap range in USD for price configurations.
 * Used to define start and end market caps for bonding curves.
 */
export interface MarketCapRange {
  /** Starting market cap in USD (e.g., 100_000 for $100k) */
  start: number;
  /** Ending market cap in USD (e.g., 10_000_000 for $10M) */
  end: number;
}

/**
 * Base configuration for market cap-based tick calculations.
 * Used by builder methods to convert market caps to ticks.
 */
export interface MarketCapConfig {
  /** Target market cap range in USD */
  marketCap: MarketCapRange;
  /** Price of numeraire in USD (e.g., 3000 for ETH at $3000) */
  numerairePrice: number;
  /**
   * Token supply override. If not provided, inferred from saleConfig.initialSupply.
   * Must include decimals (e.g., parseEther('1000000000') for 1B tokens).
   */
  tokenSupply?: bigint;
  /** Token decimals (default: 18) */
  tokenDecimals?: number;
  /** Numeraire decimals (default: 18) */
  numeraireDecimals?: number;
}

/**
 * Result of market cap parameter validation.
 */
export interface MarketCapValidationResult {
  /** Whether all parameters are within normal bounds */
  valid: boolean;
  /** Warning messages for unusual but technically valid values */
  warnings: string[];
}

// SDK initialization configuration
export interface DopplerSDKConfig {
  publicClient: SupportedPublicClient;
  walletClient?: import('viem').WalletClient;
  chainId: number;
}

// Use a wide type to avoid cross-package viem type identity issues when linking packages locally.
export type SupportedPublicClient = unknown;

// Chain type helpers
import { base, baseSepolia, ink, unichain } from 'viem/chains';

export type SupportedChain =
  | typeof base
  | typeof baseSepolia
  | typeof ink
  | typeof unichain
  | typeof baseSepolia;

// Pool information types
export interface PoolInfo {
  address: Address;
  tokenAddress: Address;
  numeraireAddress: Address;
  fee: number;
  liquidity: bigint;
  sqrtPriceX96: bigint;
}

export interface HookInfo {
  hookAddress: Address;
  tokenAddress: Address;
  numeraireAddress: Address;
  poolId: string;
  currentEpoch: number;
  totalProceeds: bigint;
  totalTokensSold: bigint;
  earlyExit: boolean;
  insufficientProceeds: boolean;
  startingTime: bigint;
  endingTime: bigint;
  epochLength: bigint;
  minimumProceeds: bigint;
  maximumProceeds: bigint;
}

// Quote result type
export interface QuoteResult {
  amountOut: bigint;
  priceImpact: number;
  fee: bigint;
  route: string[];
}

// Optional per-call module address overrides. When provided, these take precedence
// over chain defaults resolved via getAddresses(chainId).
export interface ModuleAddressOverrides {
  // Core deployment & routing
  airlock?: Address;
  tokenFactory?: Address;

  // Initializers
  v3Initializer?: Address;
  lockableV3Initializer?: Address;
  v4Initializer?: Address;
  v4MulticurveInitializer?: Address;
  v4ScheduledMulticurveInitializer?: Address;
  dopplerHookInitializer?: Address;

  // DopplerHooks
  rehypeDopplerHook?: Address;

  // Governance
  governanceFactory?: Address;

  // Dynamic auction infra
  poolManager?: Address;
  dopplerDeployer?: Address;

  // Migrators
  v2Migrator?: Address;
  v4Migrator?: Address;
  noOpMigrator?: Address;
}

// Final Params object that gets passed as arg to create
export interface CreateParams {
  initialSupply: bigint;
  numTokensToSell: bigint;
  numeraire: Address;
  tokenFactory: Address;
  tokenFactoryData: `0x${string}`;
  governanceFactory: Address;
  governanceFactoryData: `0x${string}`;
  poolInitializer: Address;
  poolInitializerData: `0x${string}`;
  liquidityMigrator: Address;
  liquidityMigratorData: `0x${string}`;
  integrator: Address;
  salt: `0x${string}`;
}

// ============================================================================
// Common Builder Interface
// ============================================================================

/**
 * Common interface shared by all auction builders.
 *
 * Defines the methods that all builders (Static, Dynamic, Multicurve) implement.
 * Useful for documentation and ensuring API consistency across builders.
 *
 * @template C - The chain ID type
 */
export interface BaseAuctionBuilder<C extends SupportedChainId> {
  /** The chain ID this builder is configured for */
  readonly chainId: C;

  /**
   * Configure the token to be created.
   * Supports standard ERC20 or Doppler404 token types.
   */
  tokenConfig(
    params:
      | {
          type?: 'standard';
          name: string;
          symbol: string;
          tokenURI: string;
          yearlyMintRate?: bigint;
        }
      | {
          type: 'doppler404';
          name: string;
          symbol: string;
          baseURI: string;
          unit?: bigint;
        },
  ): this;

  /**
   * Configure the token sale parameters.
   * @param params.initialSupply - Total token supply to mint
   * @param params.numTokensToSell - Number of tokens allocated for the bonding curve
   * @param params.numeraire - The quote token address (e.g., WETH)
   */
  saleConfig(params: {
    initialSupply: bigint;
    numTokensToSell: bigint;
    numeraire: Address;
  }): this;

  /**
   * Configure token vesting for team/investor allocations.
   * Pass undefined or omit to disable vesting.
   */
  withVesting(params?: {
    duration?: bigint;
    cliffDuration?: number;
    recipients?: Address[];
    amounts?: bigint[];
  }): this;

  /**
   * Configure governance for the token.
   * @param params - Use { type: 'default' }, { type: 'noOp' }, or { type: 'custom', ... }
   */
  withGovernance(params: GovernanceOption<C>): this;

  /**
   * Configure post-auction liquidity migration.
   * @param migration - Migration target (uniswapV2, uniswapV4, or noOp)
   */
  withMigration(migration: MigrationConfig): this;

  /**
   * Set the user address (token creator/owner).
   * Required for build().
   */
  withUserAddress(address: Address): this;

  /**
   * Set the integrator address for fee attribution.
   * Defaults to zero address if not provided.
   */
  withIntegrator(address?: Address): this;

  /**
   * Override the default gas limit for the create transaction.
   */
  withGasLimit(gas?: bigint): this;

  // Module address overrides
  withTokenFactory(address: Address): this;
  withAirlock(address: Address): this;
  withGovernanceFactory(address: Address): this;
  withV2Migrator(address: Address): this;
  withV4Migrator(address: Address): this;
  withNoOpMigrator(address: Address): this;
}
