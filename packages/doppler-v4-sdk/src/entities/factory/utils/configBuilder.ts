import { DopplerPreDeploymentConfig, PriceRange } from '@/types';
import {
  DAY_SECONDS,
  DEFAULT_PD_SLUGS,
  MAX_TICK_SPACING,
  WAD_STRING,
} from '@/constants';
import { DopplerV4Addresses } from '@/types';
import { encodeSqrtRatioX96, TickMath } from '@uniswap/v3-sdk';
import {
  encodeAbiParameters,
  parseEther,
  toHex,
  Address,
  zeroAddress,
} from 'viem';
import { ETH_ADDRESS } from '@/constants';
import { MineV4Params, mine } from '@/entities/factory';
import {
  DEFAULT_INITIAL_VOTING_DELAY,
  DEFAULT_INITIAL_VOTING_PERIOD,
  DEFAULT_INITIAL_PROPOSAL_THRESHOLD,
} from '@/constants';
import { CreateParams, TokenFactoryData, DopplerData } from '../types';

/**
 * Validates and builds pool configuration from user-friendly parameters
 */
export function buildConfig(
  params: DopplerPreDeploymentConfig,
  addresses: DopplerV4Addresses
): {
  createParams: CreateParams;
  hook: Address;
  token: Address;
} {
  validateBasicParams(params);

  if (!params.priceRange) {
    throw new Error('Price range  must be provided');
  }

  const { startTick, endTick } = computeTicks(
    params.priceRange,
    params.tickSpacing
  );

  const gamma = computeOptimalGamma(
    startTick,
    endTick,
    params.duration,
    params.epochLength,
    params.tickSpacing
  );

  const startTime = params.blockTimestamp + 30;
  const endTime = params.blockTimestamp + params.duration * DAY_SECONDS + 30;

  const totalDuration = endTime - startTime;
  if (totalDuration % params.epochLength !== 0) {
    throw new Error('Epoch length must divide total duration evenly');
  }

  if (gamma % params.tickSpacing !== 0) {
    throw new Error('Computed gamma must be divisible by tick spacing');
  }

  const {
    tokenFactory,
    dopplerDeployer,
    v4Initializer,
    poolManager,
    airlock,
    migrator,
  } = addresses;

  const tokenParams: TokenFactoryData = {
    name: params.name,
    symbol: params.symbol,
    initialSupply: params.totalSupply,
    airlock,
    yearlyMintRate: params.yearlyMintRate,
    vestingDuration: params.vestingDuration,
    recipients: params.recipients,
    amounts: params.amounts,
    tokenURI: params.tokenURI,
  };

  const dopplerParams: DopplerData = {
    minimumProceeds: params.minProceeds,
    maximumProceeds: params.maxProceeds,
    startingTime: BigInt(startTime),
    endingTime: BigInt(endTime),
    startingTick: startTick,
    endingTick: endTick,
    epochLength: BigInt(params.epochLength),
    gamma,
    isToken0: false,
    numPDSlugs: BigInt(params.numPdSlugs ?? DEFAULT_PD_SLUGS),
    fee: params.fee,
    tickSpacing: params.tickSpacing,
  };

  const mineParams: MineV4Params = {
    airlock,
    poolManager,
    deployer: dopplerDeployer,
    initialSupply: params.totalSupply,
    numTokensToSell: params.numTokensToSell,
    numeraire: ETH_ADDRESS,
    tokenFactory,
    tokenFactoryData: tokenParams,
    poolInitializer: v4Initializer,
    poolInitializerData: dopplerParams,
  };

  const [salt, hook, token, poolInitializerData, tokenFactoryData] =
    mine(mineParams);

  const governanceFactoryData = encodeAbiParameters(
    [
      { type: 'string' },
      { type: 'uint48' },
      { type: 'uint32' },
      { type: 'uint256' },
    ],
    [
      params.name,
      DEFAULT_INITIAL_VOTING_DELAY,
      DEFAULT_INITIAL_VOTING_PERIOD,
      DEFAULT_INITIAL_PROPOSAL_THRESHOLD,
    ]
  );

  const createArgs = {
    createParams: {
      initialSupply: params.totalSupply,
      numTokensToSell: params.numTokensToSell,
      numeraire: zeroAddress,
      tokenFactory,
      tokenFactoryData,
      governanceFactory: addresses.governanceFactory,
      governanceFactoryData,
      poolInitializer: v4Initializer,
      poolInitializerData,
      liquidityMigrator: migrator,
      liquidityMigratorData: toHex(''),
      integrator: '0xcD3365F82eDD9750C2Fb287309eD7539cBFB51a9' as Address,
      salt,
    },
    hook,
    token,
  };

  return createArgs;
}

// Converts price range to tick range, ensuring alignment with tick spacing

function computeTicks(priceRange: PriceRange, tickSpacing: number) {
  const startPriceString = parseEther(
    priceRange.startPrice.toString()
  ).toString();
  const endPriceString = parseEther(priceRange.endPrice.toString()).toString();

  const minSqrtRatio = encodeSqrtRatioX96(WAD_STRING, startPriceString);
  const maxSqrtRatio = encodeSqrtRatioX96(WAD_STRING, endPriceString);

  const startTick = TickMath.getTickAtSqrtRatio(minSqrtRatio);
  const endTick = TickMath.getTickAtSqrtRatio(maxSqrtRatio);

  return {
    startTick: Math.floor(startTick / tickSpacing) * tickSpacing,
    endTick: Math.ceil(endTick / tickSpacing) * tickSpacing,
  };
}

// Computes optimal gamma parameter based on price range and time parameters
function computeOptimalGamma(
  startTick: number,
  endTick: number,
  durationDays: number,
  epochLength: number,
  tickSpacing: number
): number {
  // Calculate total number of epochs
  const totalEpochs = (durationDays * DAY_SECONDS) / epochLength;

  // Calculate required tick movement per epoch to cover the range
  const tickDelta = Math.abs(endTick - startTick);
  // Round up to nearest multiple of tick spacing
  let gamma = Math.ceil(tickDelta / totalEpochs) * tickSpacing;
  // Ensure gamma is at least 1 tick spacing
  gamma = Math.max(tickSpacing, gamma);

  if (gamma % tickSpacing !== 0) {
    throw new Error('Computed gamma must be divisible by tick spacing');
  }

  return gamma;
}

// Validates basic parameters
function validateBasicParams(params: DopplerPreDeploymentConfig) {
  // Validate tick spacing
  if (params.tickSpacing > MAX_TICK_SPACING) {
    throw new Error(`Tick spacing cannot exceed ${MAX_TICK_SPACING}`);
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
  if (params.priceRange) {
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
}
