/**
 * Constants specific to Static Auctions (V3-style).
 */

import { parseEther } from 'viem';
import { VALID_FEE_TIERS, SECONDS_PER_YEAR } from '../common/constants';

/**
 * V3 fee tiers - These are the ONLY valid fees for Uniswap V3 pools.
 * Static Auctions use V3 and must use one of these tiers.
 */
export const V3_FEE_TIERS = VALID_FEE_TIERS;

// V3 Default parameters
export const DEFAULT_V3_START_TICK = 175000;
export const DEFAULT_V3_END_TICK = 225000;
export const DEFAULT_V3_NUM_POSITIONS = 15;
export const DEFAULT_V3_FEE = 10000; // 1% fee tier
export const DEFAULT_V3_INITIAL_VOTING_DELAY = 172800; // 2 days
export const DEFAULT_V3_INITIAL_VOTING_PERIOD = 1209600; // 14 days
export const DEFAULT_V3_INITIAL_PROPOSAL_THRESHOLD = 0n;
export const DEFAULT_V3_VESTING_DURATION = BigInt(SECONDS_PER_YEAR);
export const DEFAULT_V3_INITIAL_SUPPLY = parseEther('1000000000'); // 1 billion tokens
export const DEFAULT_V3_NUM_TOKENS_TO_SELL = parseEther('900000000'); // 900 million tokens
export const DEFAULT_V3_YEARLY_MINT_RATE = parseEther('0.02'); // 2% yearly mint rate
export const DEFAULT_V3_PRE_MINT = parseEther('9000000'); // 9 million tokens (0.9%)
export const DEFAULT_V3_MAX_SHARE_TO_BE_SOLD = parseEther('0.35'); // 35%
