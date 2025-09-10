import { Q192, WAD } from "@app/utils/constants";

/**
 * Core price calculation service that provides protocol-agnostic price computations
 */
export class PriceService {
  /**
   * Computes price from sqrt price (used by V3 and V4 protocols)
   * This is the core calculation that was duplicated across V3 and V4
   */
  static computePriceFromSqrtPriceX96({
    sqrtPriceX96,
    isToken0,
    decimals = 18,
    quoteDecimals = 18,
  }: {
    sqrtPriceX96: bigint;
    isToken0: boolean;
    decimals?: number;
    quoteDecimals?: number;
  }): bigint {
    const ratioX192 = sqrtPriceX96 * sqrtPriceX96;

    const price = isToken0
      ? (ratioX192 * BigInt(10 ** decimals)) / Q192
      : (Q192 * BigInt(10 ** decimals)) / ratioX192;

    const scaledPrice = price * 10n ** (BigInt(decimals) - BigInt(quoteDecimals));

    return scaledPrice;
  }

  /**
   * Computes price from reserves (used by V2 protocol)
   * Uses the constant product formula: price = quoteReserve / assetReserve
   */
  static computePriceFromReserves({
    assetBalance,
    quoteBalance,
  }: {
    assetBalance: bigint;
    quoteBalance: bigint;
  }): bigint {
    if (assetBalance === 0n) {
      throw new Error("Asset balance cannot be zero");
    }
    
    const quote = (WAD * quoteBalance) / assetBalance;
    return quote;
  }

  /**
   * Converts a price to USD using ETH price
   * Common calculation used across all protocols
   */
  static computePriceUSD({
    price,
    ethPriceUSD,
    isQuoteETH = true,
  }: {
    price: bigint;
    ethPriceUSD: bigint;
    isQuoteETH?: boolean;
  }): bigint {
    if (isQuoteETH) {
      return (price * ethPriceUSD) / WAD;
    }
    return price;
  }
}
