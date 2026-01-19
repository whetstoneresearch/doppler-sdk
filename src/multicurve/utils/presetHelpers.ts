/**
 * Helper utilities for building curves from market cap presets.
 */

import { FEE_TIERS, TICK_SPACINGS, WAD } from '../../common/constants';
import { MAX_TICK, MIN_TICK } from '../../common/utils/tickMath';
import { MARKET_CAP_PRESETS, MARKET_CAP_PRESET_ORDER } from '../constants';
import type {
  MulticurveMarketCapPreset,
  MarketCapPresetConfig,
  MarketCapPresetOverrides,
} from '../types';

/**
 * Helper to build curves from market cap presets with optional filler curve.
 *
 * If the provided preset shares don't sum to 100% (WAD), a filler curve
 * is automatically added to use the remaining allocation.
 *
 * @param params - Configuration options
 * @returns Pool configuration with fee, tickSpacing, and computed curves
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
