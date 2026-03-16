/**
 * Shared market cap helpers used by both EVM and Solana SDKs.
 *
 * These are the primitive building blocks — each chain's SDK builds
 * chain-specific conversions on top of these.
 */

export type MarketCapValidationResult = {
  valid: boolean;
  warnings: string[];
};

/**
 * Convert a market cap (USD) and total supply to a per-token price (USD).
 *
 * @param marketCapUSD   - Market capitalisation in USD
 * @param tokenSupply    - Total token supply (raw, including decimals)
 * @param tokenDecimals  - Decimal places of the token (default: 18)
 * @returns Price of one token in USD
 *
 * @example
 * // $1M market cap, 1B tokens (18 decimals)
 * marketCapToTokenPrice(1_000_000, parseEther('1000000000'))
 * // => 0.001
 */
export function marketCapToTokenPrice(
  marketCapUSD: number,
  tokenSupply: bigint,
  tokenDecimals: number = 18,
): number {
  if (marketCapUSD <= 0) {
    throw new Error('Market cap must be positive');
  }
  if (tokenSupply <= 0n) {
    throw new Error('Token supply must be positive');
  }

  const supplyNum = Number(tokenSupply) / 10 ** tokenDecimals;
  return marketCapUSD / supplyNum;
}

/**
 * Validate market cap parameters and return warnings for unusual values.
 * Does not throw — callers can decide whether to surface warnings to users.
 *
 * @param marketCapUSD   - Market cap to validate
 * @param tokenSupply    - Total token supply (raw, including decimals)
 * @param tokenDecimals  - Decimal places of the token (default: 18)
 * @returns Validation result with `valid` flag and `warnings` array
 *
 * @example
 * const { valid, warnings } = validateMarketCapParameters(500, supply);
 * if (!valid) console.warn(warnings);
 */
export function validateMarketCapParameters(
  marketCapUSD: number,
  tokenSupply: bigint,
  tokenDecimals: number = 18,
): MarketCapValidationResult {
  const warnings: string[] = [];

  if (marketCapUSD < 1_000) {
    warnings.push(
      `Market cap $${marketCapUSD.toLocaleString()} is very small. Consider if this is intentional.`,
    );
  }

  if (marketCapUSD > 1_000_000_000_000) {
    warnings.push(
      `Market cap $${marketCapUSD.toLocaleString()} is very large (> $1T). Verify this is correct.`,
    );
  }

  const tokenPriceUSD = marketCapToTokenPrice(marketCapUSD, tokenSupply, tokenDecimals);

  if (tokenPriceUSD < 0.000_001) {
    warnings.push(
      `Implied token price $${tokenPriceUSD.toExponential(2)} is very small. This may cause precision issues.`,
    );
  }

  if (tokenPriceUSD > 1_000_000) {
    warnings.push(
      `Implied token price $${tokenPriceUSD.toLocaleString()} is very large. Verify your token supply and market cap values.`,
    );
  }

  return { valid: warnings.length === 0, warnings };
}
