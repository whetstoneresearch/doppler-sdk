import type { Address } from 'viem';
import {
  DEFAULT_MULTICURVE_LOWER_TICKS,
  DEFAULT_MULTICURVE_MAX_SUPPLY_SHARES,
  DEFAULT_MULTICURVE_NUM_POSITIONS,
  DEFAULT_MULTICURVE_UPPER_TICKS,
  FEE_TIERS,
  TICK_SPACINGS,
  WAD,
} from '../constants';
import { MAX_TICK, MIN_TICK } from '../utils';
import type {
  PriceRange,
  TickRange,
  MulticurveMarketCapPreset,
  GovernanceOption,
  MigrationConfig,
} from '../types';
import type { SupportedChainId } from '../addresses';

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
   * @param params - Use { type: 'default' }, { type: 'noOp' }, { type: 'launchpad', multisig: '0x...' }, or { type: 'custom', ... }
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

export function computeTicks(
  priceRange: PriceRange,
  tickSpacing: number,
): TickRange {
  const startTick =
    Math.floor(
      Math.log(priceRange.startPrice) / Math.log(1.0001) / tickSpacing,
    ) * tickSpacing;
  const endTick =
    Math.ceil(Math.log(priceRange.endPrice) / Math.log(1.0001) / tickSpacing) *
    tickSpacing;
  return { startTick, endTick };
}

export const MARKET_CAP_PRESET_ORDER = [
  'low',
  'medium',
  'high',
] as const satisfies readonly MulticurveMarketCapPreset[];

export type MarketCapPresetConfig = {
  tickLower: number;
  tickUpper: number;
  numPositions: number;
  shares: bigint;
};

export const MARKET_CAP_PRESETS: Record<
  MulticurveMarketCapPreset,
  MarketCapPresetConfig
> = {
  low: {
    tickLower: DEFAULT_MULTICURVE_LOWER_TICKS[0],
    tickUpper: DEFAULT_MULTICURVE_UPPER_TICKS[0],
    numPositions: DEFAULT_MULTICURVE_NUM_POSITIONS[0],
    shares: DEFAULT_MULTICURVE_MAX_SUPPLY_SHARES[0],
  },
  medium: {
    tickLower: DEFAULT_MULTICURVE_LOWER_TICKS[1],
    tickUpper: DEFAULT_MULTICURVE_UPPER_TICKS[1],
    numPositions: DEFAULT_MULTICURVE_NUM_POSITIONS[1],
    shares: DEFAULT_MULTICURVE_MAX_SUPPLY_SHARES[1],
  },
  high: {
    tickLower: DEFAULT_MULTICURVE_LOWER_TICKS[2],
    tickUpper: DEFAULT_MULTICURVE_UPPER_TICKS[2],
    numPositions: DEFAULT_MULTICURVE_NUM_POSITIONS[2],
    shares: DEFAULT_MULTICURVE_MAX_SUPPLY_SHARES[2],
  },
};

export type MarketCapPresetOverrides = Partial<
  Record<
    MulticurveMarketCapPreset,
    {
      tickLower?: number;
      tickUpper?: number;
      numPositions?: number;
      shares?: bigint;
    }
  >
>;

/**
 * Helper to build curves from market cap presets with optional filler curve
 */
export function buildCurvesFromPresets(params: {
  fee?: number;
  tickSpacing?: number;
  presets?: MulticurveMarketCapPreset[];
  overrides?: MarketCapPresetOverrides;
}): { fee: number; tickSpacing: number; curves: MarketCapPresetConfig[] } {
  const fee = params?.fee ?? FEE_TIERS.LOW;
  const tickSpacing =
    params?.tickSpacing ?? (TICK_SPACINGS as Record<number, number>)[fee];

  if (tickSpacing === undefined) {
    throw new Error(
      'tickSpacing must be provided when using a custom fee tier',
    );
  }

  const requestedPresets = params?.presets ?? [...MARKET_CAP_PRESET_ORDER];
  const uniquePresets: MulticurveMarketCapPreset[] = [];
  for (const preset of requestedPresets) {
    if (!(preset in MARKET_CAP_PRESETS)) {
      throw new Error(`Unsupported market cap preset: ${preset}`);
    }
    if (!uniquePresets.includes(preset)) {
      uniquePresets.push(preset);
    }
  }

  if (uniquePresets.length === 0) {
    throw new Error('At least one market cap preset must be provided');
  }

  const presetCurves = uniquePresets.map((preset) => {
    const base = MARKET_CAP_PRESETS[preset];
    const override = params?.overrides?.[preset];
    return {
      tickLower: override?.tickLower ?? base.tickLower,
      tickUpper: override?.tickUpper ?? base.tickUpper,
      numPositions: override?.numPositions ?? base.numPositions,
      shares: override?.shares ?? base.shares,
    };
  });

  let totalShares = presetCurves.reduce((acc, curve) => {
    if (curve.shares <= 0n) {
      throw new Error('Preset shares must be greater than zero');
    }
    return acc + curve.shares;
  }, 0n);

  if (totalShares > WAD) {
    throw new Error('Total preset shares cannot exceed 100% (1e18)');
  }

  const curves = [...presetCurves];

  // Add filler curve if shares don't sum to 100%
  if (totalShares < WAD) {
    const remainder = WAD - totalShares;
    const lastCurve = curves[curves.length - 1];
    let fillerTickLower = lastCurve?.tickUpper ?? 0;
    let fillerNumPositions = lastCurve?.numPositions ?? 1;

    if (fillerNumPositions <= 0) {
      fillerNumPositions = 1;
    }

    const minTickAllowed = Math.ceil(MIN_TICK / tickSpacing) * tickSpacing;
    const rawMaxTick = Math.floor(MAX_TICK / tickSpacing) * tickSpacing;
    const maxTickAllowed = rawMaxTick - tickSpacing;

    fillerTickLower = Math.max(fillerTickLower, minTickAllowed);
    let fillerTickUpper = fillerTickLower + fillerNumPositions * tickSpacing;

    if (fillerTickUpper > maxTickAllowed) {
      fillerTickUpper = maxTickAllowed;
      fillerTickLower = Math.min(fillerTickLower, maxTickAllowed - tickSpacing);
    }

    if (fillerTickUpper <= fillerTickLower) {
      fillerTickLower = Math.max(minTickAllowed, maxTickAllowed - tickSpacing);
      fillerTickUpper = fillerTickLower + tickSpacing;
    }

    curves.push({
      tickLower: fillerTickLower,
      tickUpper: fillerTickUpper,
      numPositions: fillerNumPositions,
      shares: remainder,
    });

    totalShares = WAD;
  }

  if (totalShares !== WAD) {
    throw new Error('Failed to normalize preset shares to 100%');
  }

  return { fee, tickSpacing, curves };
}
