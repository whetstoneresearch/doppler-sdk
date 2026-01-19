/**
 * Internal V4-shared constants used by both dynamic and multicurve modules.
 * NOT exported directly - users should import from dynamic/ or multicurve/.
 */

import { parseEther } from 'viem';

/**
 * Maximum LP fee for V4 pools (from DopplerHookInitializer.sol).
 * V4 pools can use any fee from 0 to this value.
 * @see DopplerHookInitializer.sol line 171: `uint24 constant MAX_LP_FEE = 100_000`
 */
export const V4_MAX_FEE = 100_000; // 10%

/**
 * Maximum tick spacing allowed by Doppler.sol for dynamic (Dutch) auctions.
 * @see Doppler.sol line 159: `int24 constant MAX_TICK_SPACING = 30`
 */
export const DOPPLER_MAX_TICK_SPACING = 30;

// V4 Default parameters
export const DEFAULT_V4_INITIAL_VOTING_DELAY = 7200; // 2 hours
export const DEFAULT_V4_INITIAL_VOTING_PERIOD = 50400; // 14 hours
export const DEFAULT_V4_INITIAL_PROPOSAL_THRESHOLD = 0n;
export const DEFAULT_V4_YEARLY_MINT_RATE = parseEther('0.02'); // 2% yearly mint rate

// V4 Hook Flags for Doppler
export const FLAG_MASK = BigInt(0x3fff);
export const DOPPLER_FLAGS = BigInt(
  (1 << 13) | // BEFORE_INITIALIZE_FLAG
    (1 << 12) | // AFTER_INITIALIZE_FLAG
    (1 << 11) | // BEFORE_ADD_LIQUIDITY_FLAG
    (1 << 7) | // BEFORE_SWAP_FLAG
    (1 << 6) | // AFTER_SWAP_FLAG
    (1 << 5), // BEFORE_DONATE_FLAG
);

// V4 Dynamic Fee Flag
export const DYNAMIC_FEE_FLAG = 0x800000; // 8388608 in decimal
export const FEE_AMOUNT_MASK = 0xffffff; // Mask to extract actual fee from dynamic fee

// V4 Multicurve Default Tick Ranges
// Based on market cap tiers: LOW ($7.5k -> $30k), MEDIUM ($50k -> $150k), HIGH ($250k -> $750k)
// Calculated for 1B token supply, $4500 numeraire (e.g., WETH on Base)
export const DEFAULT_MULTICURVE_LOWER_TICKS = [
  -202_100, -183_100, -167_000,
] as const;
export const DEFAULT_MULTICURVE_UPPER_TICKS = [
  -188_200, -172_100, -156_000,
] as const;
export const DEFAULT_MULTICURVE_NUM_POSITIONS = [11, 11, 11] as const;
export const DEFAULT_MULTICURVE_MAX_SUPPLY_SHARES = [
  parseEther('0.05'), // 5% for LOW tier
  parseEther('0.125'), // 12.5% for MEDIUM tier
  parseEther('0.2'), // 20% for HIGH tier
] as const;

