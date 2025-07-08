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
    decimals,
  }: {
    sqrtPriceX96: bigint;
    isToken0: boolean;
    decimals: number;
  }): bigint {
    const ratioX192 = sqrtPriceX96 * sqrtPriceX96;
    const baseTokenDecimalScale = 10 ** decimals;

    const price = isToken0
      ? (ratioX192 * BigInt(baseTokenDecimalScale)) / Q192
      : (Q192 * BigInt(baseTokenDecimalScale)) / ratioX192;

    return price;
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

  /**
   * Computes price change percentage
   * Common calculation for tracking price movements
   */
  static computePriceChange({
    currentPrice,
    previousPrice,
  }: {
    currentPrice: bigint;
    previousPrice: bigint;
  }): number {
    if (previousPrice === 0n) return 0;
    
    const change = Number(currentPrice - previousPrice);
    const base = Number(previousPrice);
    
    return (change / base) * 100;
  }
}