import { Price, Token } from '@uniswap/sdk-core';
import { priceToClosestTick, Pool, PoolKey } from '@uniswap/v4-sdk';
import { DeploymentConfig } from '../../types';
import { MineParams, mine } from './airlockMiner';
import { DopplerAddressProvider } from '../../AddressProvider';
import { parseEther } from 'viem';
import { DopplerConfigParams } from './deployDoppler';

/**
 * Represents a price range with start and end prices.
 */
export interface PriceRange {
  startPrice: number;
  endPrice: number;
}

/**
 * A builder class for creating Doppler configuration.
 */
export class DopplerConfigBuilder {
  private static readonly MAX_TICK_SPACING = 30;
  private static readonly DEFAULT_PD_SLUGS = 5;

  /**
   * Validates and builds pool configuration from user-friendly parameters.
   * @param params The Doppler configuration parameters.
   * @param chainId The chain ID.
   * @param addressProvider The address provider for Doppler addresses.
   * @returns The deployment configuration.
   */
  public static buildConfig(
    params: DopplerConfigParams,
    chainId: number,
    addressProvider: DopplerAddressProvider
  ): DeploymentConfig {
    this.validateBasicParams(params);

    const { startTick, endTick } = this.computeTicks(
      params.priceRange,
      params.tickSpacing
    );

    const gamma = this.computeOptimalGamma(
      startTick,
      endTick,
      params.duration,
      params.epochLength,
      params.tickSpacing
    );

    const startTime =
      params.blockTimestamp + params.startTimeOffset * 24 * 60 * 60;
    const endTime = params.blockTimestamp + params.duration * 24 * 60 * 60;

    const totalDuration = endTime - startTime;
    if (totalDuration % params.epochLength !== 0) {
      throw new Error('Epoch length must divide total duration evenly');
    }

    if (gamma % params.tickSpacing !== 0) {
      throw new Error('Computed gamma must be divisible by tick spacing');
    }

    const {
      tokenFactory,
      dopplerFactory,
      poolManager,
      airlock,
    } = addressProvider.addresses;

    const mineParams: MineParams = {
      poolManager,
      numTokensToSell: params.numTokensToSell,
      minTick: startTick,
      maxTick: endTick,
      airlock,
      name: params.name,
      symbol: params.symbol,
      initialSupply: params.totalSupply,
      numeraire: '0x0000000000000000000000000000000000000000',
      startingTime: BigInt(startTime),
      endingTime: BigInt(endTime),
      minimumProceeds: params.minProceeds,
      maximumProceeds: params.maxProceeds,
      epochLength: BigInt(params.epochLength),
      gamma,
      numPDSlugs: BigInt(params.numPdSlugs ?? this.DEFAULT_PD_SLUGS),
    };

    const [salt, dopplerAddress, tokenAddress] = mine(
      tokenFactory,
      dopplerFactory,
      mineParams
    );

    const token = new Token(
      chainId,
      tokenAddress,
      18,
      params.name,
      params.symbol
    );

    const eth = new Token(
      chainId,
      '0x0000000000000000000000000000000000000000',
      18,
      'ETH',
      'Ether'
    );

    const poolKey: PoolKey = Pool.getPoolKey(
      token,
      eth,
      params.fee,
      params.tickSpacing,
      dopplerAddress
    );

    return {
      salt,
      poolKey,
      dopplerAddress,
      token: {
        name: params.name,
        symbol: params.symbol,
        totalSupply: params.totalSupply,
      },
      hook: {
        assetToken: token,
        quoteToken: eth,
        startTime: startTime,
        endTime: endTime,
        epochLength: params.epochLength,
        startTick,
        endTick,
        gamma,
        maxProceeds: params.maxProceeds,
        minProceeds: params.minProceeds,
        numTokensToSell: params.numTokensToSell,
        numPdSlugs: params.numPdSlugs ?? DopplerConfigBuilder.DEFAULT_PD_SLUGS,
      },
      pool: {
        tickSpacing: params.tickSpacing,
        fee: params.fee,
      },
    };
  }

  /**
   * Converts price range to tick range, ensuring alignment with tick spacing.
   * @param priceRange The price range.
   * @param tickSpacing The tick spacing.
   * @returns The start and end ticks.
   */
  private static computeTicks(
    priceRange: PriceRange,
    tickSpacing: number
  ): { startTick: number; endTick: number } {
    const quoteToken = new Token(
      1,
      '0x0000000000000000000000000000000000000000',
      18
    );
    const assetToken = new Token(
      1,
      '0x0000000000000000000000000000000000000001',
      18
    );
    // Convert prices to sqrt price X96
    let startTick = priceToClosestTick(
      new Price(
        assetToken,
        quoteToken,
        parseEther('1').toString(),
        parseEther(priceRange.startPrice.toString()).toString()
      )
    );
    let endTick = priceToClosestTick(
      new Price(
        assetToken,
        quoteToken,
        parseEther('1').toString(),
        parseEther(priceRange.endPrice.toString()).toString()
      )
    );

    // Align to tick spacing
    startTick = Math.floor(startTick / tickSpacing) * tickSpacing;
    endTick = Math.floor(endTick / tickSpacing) * tickSpacing;

    // Validate tick range
    if (startTick === endTick) {
      throw new Error('Start and end prices must result in different ticks');
    }

    return { startTick, endTick };
  }

  // Computes optimal gamma parameter based on price range and time parameters
  private static computeOptimalGamma(
    startTick: number,
    endTick: number,
    durationDays: number,
    epochLength: number,
    tickSpacing: number
  ): number {
    // Calculate total number of epochs
    const totalEpochs = (durationDays * 24 * 60 * 60) / epochLength;

    // Calculate required tick movement per epoch to cover the range
    const tickDelta = Math.abs(endTick - startTick);
    const gammaRaw = Math.ceil(tickDelta / totalEpochs);

    // Round up to nearest multiple of tick spacing
    let gamma = Math.ceil(gammaRaw / tickSpacing) * tickSpacing;

    // Ensure gamma is at least 1 tick spacing
    gamma = Math.max(tickSpacing, gamma);

    if (gamma % tickSpacing !== 0) {
      throw new Error('Computed gamma must be divisible by tick spacing');
    }

    return gamma;
  }

  // Converts decimal price to sqrt price X96 format
  private static priceToSqrtPriceX96(price: Price<Token, Token>): bigint {
    return BigInt(price.quotient.toString());
  }

  // Validates basic parameters
  private static validateBasicParams(params: DopplerConfigParams) {
    // Validate tick spacing
    if (params.tickSpacing > this.MAX_TICK_SPACING) {
      throw new Error(`Tick spacing cannot exceed ${this.MAX_TICK_SPACING}`);
    }

    // Validate time parameters
    if (params.startTimeOffset < 0) {
      throw new Error('Start time offset must be positive');
    }
    if (params.duration <= 0) {
      throw new Error('Duration must be positive');
    }
    if (params.epochLength <= 0) {
      throw new Error('Epoch length must be positive');
    }

    // Validate proceeds
    if (params.maxProceeds < params.minProceeds) {
      throw new Error('Maximum proceeds must be greater than minimum proceeds');
    }

    // Validate price range
    if (
      params.priceRange.startPrice === 0 ||
      params.priceRange.endPrice === 0
    ) {
      throw new Error('Prices must be positive');
    }
    if (params.priceRange.startPrice === params.priceRange.endPrice) {
      throw new Error('Start and end prices must be different');
    }
  }

  // Helper to suggest optimal epoch length based on duration
  public static suggestEpochLength(durationDays: number): number {
    if (durationDays > 30) return 2 * 60 * 60; // 2 hours
    if (durationDays > 7) return 1 * 60 * 60; // 1 hour
    if (durationDays > 1) return 1 * 60 * 30; // 30 minutes
    return 1 * 60 * 20; // 20 minutes
  }
}
