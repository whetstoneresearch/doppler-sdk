import { WAD, CHAINLINK_ETH_DECIMALS } from "@app/utils/constants";
import { PriceService } from "@app/core/pricing";

/**
 * Market metrics interface
 */
export interface MarketMetrics {
  marketCapUsd: bigint;
  liquidityUsd: bigint;
  volumeUsd?: bigint;
  priceUsd?: bigint;
  percentDayChange?: number;
}

/**
 * Liquidity calculation parameters
 */
export interface LiquidityParams {
  assetBalance: bigint;
  quoteBalance: bigint;
  price: bigint;
  ethPriceUSD: bigint;
  isQuoteETH?: boolean;
}

/**
 * Market cap calculation parameters
 */
export interface MarketCapParams {
  price: bigint;
  totalSupply: bigint;
  ethPriceUSD: bigint;
  assetDecimals?: number;
  isQuoteETH?: boolean;
}

/**
 * Volume calculation parameters
 */
export interface VolumeParams {
  amountIn: bigint;
  amountOut: bigint;
  ethPriceUSD: bigint;
  isQuoteETH?: boolean;
  quoteDecimals?: number;
}

/**
 * Service for centralized market data calculations
 * Consolidates market cap, liquidity, volume, and other market metrics
 */
export class MarketDataService {
  /**
   * Calculate market capitalization in USD
   * Formula: (price * totalSupply) / 10^decimals * ethPrice (if quote is ETH)
   */
  static calculateMarketCap(params: MarketCapParams): bigint {
    const {
      price,
      totalSupply,
      ethPriceUSD,
      assetDecimals = 18,
      isQuoteETH = true,
    } = params;

    // Calculate market cap in quote currency
    const marketCap = (price * totalSupply) / BigInt(10 ** assetDecimals);

    // Convert to USD if quote is ETH
    if (isQuoteETH) {
      return (marketCap * ethPriceUSD) / CHAINLINK_ETH_DECIMALS;
    }

    return marketCap;
  }

  /**
   * Calculate total liquidity in USD
   * Formula: assetValue + quoteValue (both in USD)
   */
  static calculateLiquidity(params: LiquidityParams): bigint {
    const {
      assetBalance,
      quoteBalance,
      price,
      ethPriceUSD,
      isQuoteETH = true,
    } = params;

    // Calculate asset value in quote currency
    const assetValueInQuote = (assetBalance * price) / WAD;

    if (isQuoteETH) {
      // Convert both to USD
      const assetValueUsd = (assetValueInQuote * ethPriceUSD) / CHAINLINK_ETH_DECIMALS;
      const quoteValueUsd = (quoteBalance * ethPriceUSD) / CHAINLINK_ETH_DECIMALS;
      return assetValueUsd + quoteValueUsd;
    }

    // If quote is already USD, just add them
    return assetValueInQuote + quoteBalance;
  }

  /**
   * Calculate swap volume in USD
   */
  static calculateVolume(params: VolumeParams): bigint {
    const {
      amountIn,
      amountOut,
      ethPriceUSD,
      isQuoteETH = true,
      quoteDecimals = 18,
    } = params;

    // Use the larger amount as volume indicator
    const swapAmount = amountIn > 0n ? amountIn : amountOut;

    if (isQuoteETH) {
      return (swapAmount * ethPriceUSD) / BigInt(10 ** quoteDecimals);
    }

    return swapAmount;
  }

  /**
   * Calculate comprehensive market metrics
   * Combines market cap, liquidity, and volume calculations
   */
  static calculateMarketMetrics(params: {
    price: bigint;
    totalSupply: bigint;
    assetBalance: bigint;
    quoteBalance: bigint;
    ethPriceUSD: bigint;
    swapAmountIn?: bigint;
    swapAmountOut?: bigint;
    assetDecimals?: number;
    isQuoteETH?: boolean;
  }): MarketMetrics {
    const {
      price,
      totalSupply,
      assetBalance,
      quoteBalance,
      ethPriceUSD,
      swapAmountIn = 0n,
      swapAmountOut = 0n,
      assetDecimals = 18,
      isQuoteETH = true,
    } = params;

    // Calculate market cap
    const marketCapUsd = MarketDataService.calculateMarketCap({
      price,
      totalSupply,
      ethPriceUSD,
      assetDecimals,
      isQuoteETH,
    });

    // Calculate liquidity
    const liquidityUsd = MarketDataService.calculateLiquidity({
      assetBalance,
      quoteBalance,
      price,
      ethPriceUSD,
      isQuoteETH,
    });

    // Calculate volume if swap amounts provided
    let volumeUsd: bigint | undefined;
    if (swapAmountIn > 0n || swapAmountOut > 0n) {
      volumeUsd = MarketDataService.calculateVolume({
        amountIn: swapAmountIn,
        amountOut: swapAmountOut,
        ethPriceUSD,
        isQuoteETH,
      });
    }

    // Calculate price in USD
    const priceUsd = PriceService.computePriceUSD({
      price,
      ethPriceUSD,
      isQuoteETH,
    });

    return {
      marketCapUsd,
      liquidityUsd,
      volumeUsd,
      priceUsd,
    };
  }

  /**
   * Calculate price change percentage
   * @param currentPrice Current price
   * @param previousPrice Previous price (24h ago)
   * @returns Percentage change
   */
  static calculatePriceChange(
    currentPrice: bigint,
    previousPrice: bigint
  ): number {
    if (previousPrice === 0n) return 0;

    const change = Number(currentPrice - previousPrice);
    const base = Number(previousPrice);

    return (change / base) * 100;
  }

  /**
   * Format large USD values for display
   * @param value Value in USD (with appropriate decimals)
   * @param decimals Number of decimal places to show
   */
  static formatUsdValue(value: bigint, decimals: number = 2): string {
    const divisor = BigInt(10 ** 18);
    const whole = value / divisor;
    const fraction = value % divisor;
    
    const fractionStr = fraction.toString().padStart(18, '0').slice(0, decimals);
    
    return `${whole}.${fractionStr}`;
  }

  /**
   * Aggregate daily volume from multiple swaps
   * @param swapVolumes Array of individual swap volumes in USD
   */
  static aggregateDailyVolume(swapVolumes: bigint[]): bigint {
    return swapVolumes.reduce((total, volume) => total + volume, 0n);
  }
}