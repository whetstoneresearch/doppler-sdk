import { ponder } from "ponder:registry";
import { getV4PoolData } from "@app/utils/v4-utils";
import { insertTokenIfNotExists } from "./shared/entities/token";
import { computeMarketCap, fetchEthPrice } from "./shared/oracle";
import { insertPoolIfNotExistsV4, updatePool } from "./shared/entities/pool";
import { insertAssetIfNotExists, updateAsset } from "./shared/entities/asset";
import { computeDollarLiquidity } from "@app/utils/computeDollarLiquidity";
import { insertV4ConfigIfNotExists } from "./shared/entities/v4-entities/v4Config";
import { getReservesV4 } from "@app/utils/v4-utils/getV4PoolData";
import {
  addCheckpoint,
  insertCheckpointBlobIfNotExist,
} from "./shared/entities/v4-entities/v4CheckpointBlob";
import {
  addAndUpdateV4PoolPriceHistory,
  insertV4PoolPriceHistoryIfNotExists,
} from "./shared/entities/v4-entities/v4PoolPriceHistory";
import { insertSwapIfNotExists } from "./shared/entities/swap";
import { CHAINLINK_ETH_DECIMALS } from "@app/utils/constants";
import { SwapService, SwapOrchestrator, PriceService } from "@app/core";
import { TickMath } from "@uniswap/v3-sdk";
import { computeGraduationPercentage } from "@app/utils/v4-utils";

ponder.on("UniswapV4Initializer:Create", async ({ event, context }) => {
  const { poolOrHook, asset: assetId, numeraire } = event.args;
  const { block } = event;
  const timestamp = block.timestamp;

  const poolAddress = poolOrHook.toLowerCase() as `0x${string}`;
  const assetAddress = assetId.toLowerCase() as `0x${string}`;
  const numeraireAddress = numeraire.toLowerCase() as `0x${string}`;

  const creatorAddress = event.transaction.from.toLowerCase() as `0x${string}`;

  const [baseToken, ethPrice, poolData] = await Promise.all([
    insertTokenIfNotExists({
      tokenAddress: assetAddress,
      creatorAddress,
      timestamp,
      context,
      isDerc20: true,
      poolAddress: poolAddress,
    }),
    fetchEthPrice(timestamp, context),
    getV4PoolData({
      hook: poolAddress,
      context,
    }),
    insertTokenIfNotExists({
      tokenAddress: numeraireAddress,
      creatorAddress,
      timestamp,
      context,
      isDerc20: false,
    }),
    insertCheckpointBlobIfNotExist({
      context,
    }),
    insertV4PoolPriceHistoryIfNotExists({
      pool: poolAddress,
      context,
    }),
  ]);

  const { totalSupply } = baseToken;

  const [poolEntity, v4Config] = await Promise.all([
    insertPoolIfNotExistsV4({
      poolAddress,
      timestamp,
      ethPrice,
      poolData,
      context,
    }),
    insertV4ConfigIfNotExists({
      hookAddress: poolAddress,
      context,
    }),
  ]);

  const price = poolEntity.price;
  const marketCapUsd = computeMarketCap({
    price,
    ethPrice,
    totalSupply,
  });

  await Promise.all([
    insertAssetIfNotExists({
      assetAddress: assetAddress,
      timestamp,
      context,
      marketCapUsd,
    }),
    insertOrUpdateBuckets({
      poolAddress: poolAddress,
      price: poolEntity.price,
      timestamp,
      ethPrice,
      context,
    }),
    addCheckpoint({
      poolAddress: poolAddress,
      asset: assetAddress,
      totalSupply,
      startingTime: v4Config.startingTime,
      endingTime: v4Config.endingTime,
      epochLength: v4Config.epochLength,
      isToken0: v4Config.isToken0,
      poolKey: poolData.poolKey,
      context,
    }),
  ]);
});

ponder.on("UniswapV4Pool:Swap", async ({ event, context }) => {
  const address = event.log.address.toLowerCase() as `0x${string}`;
  const { chain } = context;
  const { currentTick, totalProceeds, totalTokensSold } = event.args;
  const timestamp = event.block.timestamp;


  const [ethPrice, v4PoolData] = await Promise.all([
    fetchEthPrice(event.block.timestamp, context),
    getV4PoolData({
      hook: address,
      context,
    }),
  ]);

  const [reserves, poolEntity] = await Promise.all([
    getReservesV4({
      hook: address,
      context,
    }),
    insertPoolIfNotExistsV4({
      poolAddress: address,
      timestamp,
      ethPrice,
      poolData: v4PoolData,
      context,
    }),
  ]);

  const {
    isToken0,
    baseToken,
    quoteToken,
    totalProceeds: totalProceedsPrev,
    totalTokensSold: totalTokensSoldPrev,
    marketCapUsd: marketCapUsdPrev,
  } = poolEntity;

  const quoteIn = totalProceeds > totalProceedsPrev;
  const amountIn = quoteIn ? totalProceeds - totalProceedsPrev : totalTokensSoldPrev - totalTokensSold;
  const amountOut = quoteIn ? totalTokensSoldPrev - totalTokensSold : totalProceedsPrev - totalProceeds;

  const type = SwapService.determineSwapTypeV4({
    currentProceeds: totalProceeds,
    previousProceeds: totalProceedsPrev,
  });

  const { totalSupply } = await insertTokenIfNotExists({
    tokenAddress: baseToken,
    creatorAddress: event.transaction.from,
    timestamp,
    context,
  });

  const sqrtPriceX96 = BigInt(TickMath.getSqrtRatioAtTick(currentTick).toString());
  const price = PriceService.computePriceFromSqrtPriceX96({
    sqrtPriceX96,
    isToken0,
    decimals: 18,
  });


  const { token0Reserve, token1Reserve } = reserves;

  const dollarLiquidity = computeDollarLiquidity({
    assetBalance: isToken0 ? token0Reserve : token1Reserve,
    quoteBalance: isToken0 ? token1Reserve : token0Reserve,
    price,
    ethPrice,
  });

  let marketCapUsd;
  if (price == 340256786698763678858396856460488307819979090561464864775n) {
    marketCapUsd = marketCapUsdPrev;
  } else {
    marketCapUsd = computeMarketCap({
      price,
      ethPrice,
      totalSupply,
    });
  }

  const swapValueUsd = amountIn * ethPrice / CHAINLINK_ETH_DECIMALS;

  // Create swap data
  const swapData = SwapOrchestrator.createSwapData({
    poolAddress: address,
    sender: event.transaction.from,
    transactionHash: event.transaction.hash,
    transactionFrom: event.transaction.from,
    blockNumber: event.block.number,
    timestamp,
    assetAddress: baseToken,
    quoteAddress: quoteToken,
    isToken0,
    amountIn,
    amountOut,
    price,
    ethPriceUSD: ethPrice,
  });

  const percentDayChange = await compute24HourPriceChange({
    poolAddress: address,
    marketCapUsd,
    context,
  });

  // Create market metrics
  const marketMetrics = {
    liquidityUsd: dollarLiquidity,
    marketCapUsd,
    swapValueUsd,
    percentDayChange,
  };

  // Define entity updaters
  const entityUpdaters = {
    updatePool,
    updateAsset,
  };

  // Perform common updates via orchestrator
  await SwapOrchestrator.performSwapUpdates(
    {
      swapData,
      swapType: type,
      metrics: marketMetrics,
      poolData: {
        parentPoolAddress: address,
        price,
      },
      chainId: BigInt(chain.id),
      context,
    },
    entityUpdaters
  );

  // Calculate graduation percentage
  const graduationPercentage = computeGraduationPercentage({
    maxThreshold: poolEntity.maxThreshold,
    graduationBalance: totalProceeds,
  });

  // V4-specific updates
  await Promise.all([
    updatePool({
      poolAddress: address,
      context,
      update: {
        liquidity: v4PoolData.liquidity,
        graduationBalance: totalProceeds,
        graduationPercentage,
        totalProceeds,
        totalTokensSold,
      },
    }),
    addAndUpdateV4PoolPriceHistory({
      pool: address,
      timestamp: Number(event.block.timestamp),
      marketCapUsd,
      context,
    }),
  ]);
});

ponder.on("UniswapV4Initializer2:Create", async ({ event, context }) => {
  const { poolOrHook, asset: assetId, numeraire } = event.args;
  const { block } = event;
  const timestamp = block.timestamp;

  const poolAddress = poolOrHook.toLowerCase() as `0x${string}`;
  const assetAddress = assetId.toLowerCase() as `0x${string}`;
  const numeraireAddress = numeraire.toLowerCase() as `0x${string}`;

  const creatorAddress = event.transaction.from.toLowerCase() as `0x${string}`;

  const [baseToken, ethPrice, poolData] = await Promise.all([
    insertTokenIfNotExists({
      tokenAddress: assetAddress,
      creatorAddress,
      timestamp,
      context,
      isDerc20: true,
      poolAddress: poolAddress,
    }),
    fetchEthPrice(timestamp, context),
    getV4PoolData({
      hook: poolAddress,
      context,
    }),
    insertTokenIfNotExists({
      tokenAddress: numeraireAddress,
      creatorAddress,
      timestamp,
      context,
      isDerc20: false,
    }),
    insertCheckpointBlobIfNotExist({
      context,
    }),
    insertV4PoolPriceHistoryIfNotExists({
      pool: poolAddress,
      context,
    }),
  ]);

  const { totalSupply } = baseToken;

  const [poolEntity, v4Config] = await Promise.all([
    insertPoolIfNotExistsV4({
      poolAddress,
      timestamp,
      ethPrice,
      context,
      poolData,
    }),
    insertV4ConfigIfNotExists({
      hookAddress: poolAddress,
      context,
    }),
  ]);

  const price = poolEntity.price;
  const marketCapUsd = computeMarketCap({
    price,
    ethPrice,
    totalSupply,
  });

  if (!v4Config) {
    return;
  }

  await Promise.all([
    insertAssetIfNotExists({
      assetAddress: assetAddress,
      timestamp,
      context,
      marketCapUsd,
    }),
    insertOrUpdateBuckets({
      poolAddress: poolAddress,
      price: poolEntity.price,
      timestamp,
      ethPrice,
      context,
    }),
    addCheckpoint({
      poolAddress: poolAddress,
      asset: assetAddress,
      totalSupply,
      startingTime: v4Config.startingTime,
      endingTime: v4Config.endingTime,
      epochLength: v4Config.epochLength,
      isToken0: v4Config.isToken0,
      poolKey: poolData.poolKey,
      context,
    }),
  ]);
});



ponder.on("UniswapV4InitializerSelfCorrecting:Create", async ({ event, context }) => {
  const { poolOrHook, asset: assetId, numeraire } = event.args;
  const { block } = event;
  const timestamp = block.timestamp;

  const poolAddress = poolOrHook.toLowerCase() as `0x${string}`;
  const assetAddress = assetId.toLowerCase() as `0x${string}`;
  const numeraireAddress = numeraire.toLowerCase() as `0x${string}`;

  const creatorAddress = event.transaction.from.toLowerCase() as `0x${string}`;

  const [baseToken, ethPrice, poolData] = await Promise.all([
    insertTokenIfNotExists({
      tokenAddress: assetAddress,
      creatorAddress,
      timestamp,
      context,
      isDerc20: true,
      poolAddress: poolAddress,
    }),
    fetchEthPrice(timestamp, context),
    getV4PoolData({
      hook: poolAddress,
      context,
    }),
    insertTokenIfNotExists({
      tokenAddress: numeraireAddress,
      creatorAddress,
      timestamp,
      context,
      isDerc20: false,
    }),
    insertCheckpointBlobIfNotExist({
      context,
    }),
    insertV4PoolPriceHistoryIfNotExists({
      pool: poolAddress,
      context,
    }),
  ]);

  const { totalSupply } = baseToken;

  const [poolEntity, v4Config] = await Promise.all([
    insertPoolIfNotExistsV4({
      poolAddress,
      timestamp,
      ethPrice,
      context,
      poolData,
    }),
    insertV4ConfigIfNotExists({
      hookAddress: poolAddress,
      context,
    }),
  ]);

  const price = poolEntity.price;
  const marketCapUsd = computeMarketCap({
    price,
    ethPrice,
    totalSupply,
  });

  if (!v4Config) {
    return;
  }

  await Promise.all([
    insertAssetIfNotExists({
      assetAddress: assetAddress,
      timestamp,
      context,
      marketCapUsd,
    }),
    insertOrUpdateBuckets({
      poolAddress: poolAddress,
      price: poolEntity.price,
      timestamp,
      ethPrice,
      context,
    }),
    addCheckpoint({
      poolAddress: poolAddress,
      asset: assetAddress,
      totalSupply,
      startingTime: v4Config.startingTime,
      endingTime: v4Config.endingTime,
      epochLength: v4Config.epochLength,
      isToken0: v4Config.isToken0,
      poolKey: poolData.poolKey,
      context,
    }),
  ]);
});

ponder.on("UniswapV4PoolSelfCorrecting:Swap", async ({ event, context }) => {
  const address = event.log.address.toLowerCase() as `0x${string}`;
  const { chain } = context;
  const { currentTick, totalProceeds, totalTokensSold } = event.args;
  const timestamp = event.block.timestamp;


  const [ethPrice, v4PoolData] = await Promise.all([
    fetchEthPrice(event.block.timestamp, context),
    getV4PoolData({
      hook: address,
      context,
    }),
  ]);

  const [reserves, poolEntity] = await Promise.all([
    getReservesV4({
      hook: address,
      context,
    }),
    insertPoolIfNotExistsV4({
      poolAddress: address,
      timestamp,
      ethPrice,
      poolData: v4PoolData,
      context,
    }),
  ]);

  const {
    isToken0,
    baseToken,
    quoteToken,
    totalProceeds: totalProceedsPrev,
    totalTokensSold: totalTokensSoldPrev,
    marketCapUsd: marketCapUsdPrev,
  } = poolEntity;

  const quoteIn = totalProceeds > totalProceedsPrev;
  const amountIn = quoteIn ? totalProceeds - totalProceedsPrev : totalTokensSoldPrev - totalTokensSold;
  const amountOut = quoteIn ? totalTokensSoldPrev - totalTokensSold : totalProceedsPrev - totalProceeds;

  const type = SwapService.determineSwapTypeV4({
    currentProceeds: totalProceeds,
    previousProceeds: totalProceedsPrev,
  });

  const { totalSupply } = await insertTokenIfNotExists({
    tokenAddress: baseToken,
    creatorAddress: event.transaction.from,
    timestamp,
    context,
  });

  const sqrtPriceX96 = BigInt(TickMath.getSqrtRatioAtTick(currentTick).toString());
  const price = PriceService.computePriceFromSqrtPriceX96({
    sqrtPriceX96,
    isToken0,
    decimals: 18,
  });


  const { token0Reserve, token1Reserve } = reserves;

  const dollarLiquidity = computeDollarLiquidity({
    assetBalance: isToken0 ? token0Reserve : token1Reserve,
    quoteBalance: isToken0 ? token1Reserve : token0Reserve,
    price,
    ethPrice,
  });

  let marketCapUsd;
  if (price == 340256786698763678858396856460488307819979090561464864775n) {
    marketCapUsd = marketCapUsdPrev;
  } else {
    marketCapUsd = computeMarketCap({
      price,
      ethPrice,
      totalSupply,
    });
  }

  const swapValueUsd = amountIn * ethPrice / CHAINLINK_ETH_DECIMALS;

  // Create swap data
  const swapData = SwapOrchestrator.createSwapData({
    poolAddress: address,
    sender: event.transaction.from,
    transactionHash: event.transaction.hash,
    transactionFrom: event.transaction.from,
    blockNumber: event.block.number,
    timestamp,
    assetAddress: baseToken,
    quoteAddress: quoteToken,
    isToken0,
    amountIn,
    amountOut,
    price,
    ethPriceUSD: ethPrice,
  });

  // Create market metrics
  const marketMetrics = {
    liquidityUsd: dollarLiquidity,
    marketCapUsd,
    swapValueUsd,
    percentDayChange: 0,
  };

  // Define entity updaters
  const entityUpdaters = {
    updatePool,
    updateAsset,
  };

  // Perform common updates via orchestrator
  await SwapOrchestrator.performSwapUpdates(
    {
      swapData,
      swapType: type,
      metrics: marketMetrics,
      poolData: {
        parentPoolAddress: address,
        price,
      },
      chainId: BigInt(chain.id),
      context,
    },
    entityUpdaters
  );

  // Calculate graduation percentage
  const graduationPercentage = computeGraduationPercentage({
    maxThreshold: poolEntity.maxThreshold,
    graduationBalance: totalProceeds,
  });

  // V4-specific updates
  await Promise.all([
    updatePool({
      poolAddress: address,
      context,
      update: {
        liquidity: v4PoolData.liquidity,
        graduationBalance: totalProceeds,
        graduationPercentage,
        totalProceeds,
        totalTokensSold,
      },
    }),
    addAndUpdateV4PoolPriceHistory({
      pool: address,
      timestamp: Number(event.block.timestamp),
      marketCapUsd,
      context,
    }),
  ]);
});

ponder.on("UniswapV4Pool2:Swap", async ({ event, context }) => {
  const address = event.log.address.toLowerCase() as `0x${string}`;
  const { chain } = context;
  const { currentTick, totalProceeds, totalTokensSold } = event.args;
  const timestamp = event.block.timestamp;


  const [ethPrice, v4PoolData] = await Promise.all([
    fetchEthPrice(event.block.timestamp, context),
    getV4PoolData({
      hook: address,
      context,
    }),
  ]);

  const [reserves, poolEntity] = await Promise.all([
    getReservesV4({
      hook: address,
      context,
    }),
    insertPoolIfNotExistsV4({
      poolAddress: address,
      timestamp,
      ethPrice,
      poolData: v4PoolData,
      context,
    }),
  ]);

  const {
    isToken0,
    baseToken,
    quoteToken,
    totalProceeds: totalProceedsPrev,
    totalTokensSold: totalTokensSoldPrev,
    marketCapUsd: marketCapUsdPrev,
  } = poolEntity;

  const quoteIn = totalProceeds > totalProceedsPrev;
  const amountIn = quoteIn ? totalProceeds - totalProceedsPrev : totalTokensSoldPrev - totalTokensSold;
  const amountOut = quoteIn ? totalTokensSoldPrev - totalTokensSold : totalProceedsPrev - totalProceeds;

  const type = SwapService.determineSwapTypeV4({
    currentProceeds: totalProceeds,
    previousProceeds: totalProceedsPrev,
  });

  const { totalSupply } = await insertTokenIfNotExists({
    tokenAddress: baseToken,
    creatorAddress: event.transaction.from,
    timestamp,
    context,
  });

  const sqrtPriceX96 = BigInt(TickMath.getSqrtRatioAtTick(currentTick).toString());
  const price = PriceService.computePriceFromSqrtPriceX96({
    sqrtPriceX96,
    isToken0,
    decimals: 18,
  });


  const { token0Reserve, token1Reserve } = reserves;

  const dollarLiquidity = computeDollarLiquidity({
    assetBalance: isToken0 ? token0Reserve : token1Reserve,
    quoteBalance: isToken0 ? token1Reserve : token0Reserve,
    price,
    ethPrice,
  });

  let marketCapUsd;
  if (price == 340256786698763678858396856460488307819979090561464864775n) {
    marketCapUsd = marketCapUsdPrev;
  } else {
    marketCapUsd = computeMarketCap({
      price,
      ethPrice,
      totalSupply,
    });
  }

  const swapValueUsd = amountIn * ethPrice / CHAINLINK_ETH_DECIMALS;

  // Create swap data
  const swapData = SwapOrchestrator.createSwapData({
    poolAddress: address,
    sender: event.transaction.from,
    transactionHash: event.transaction.hash,
    transactionFrom: event.transaction.from,
    blockNumber: event.block.number,
    timestamp,
    assetAddress: baseToken,
    quoteAddress: quoteToken,
    isToken0,
    amountIn,
    amountOut,
    price,
    ethPriceUSD: ethPrice,
  });

  // Create market metrics
  const marketMetrics = {
    liquidityUsd: dollarLiquidity,
    marketCapUsd,
    swapValueUsd,
    percentDayChange: 0, // TODO: implement price change calculation
  };

  // Define entity updaters
  const entityUpdaters = {
    updatePool,
    updateAsset,
  };

  // Perform common updates via orchestrator
  await SwapOrchestrator.performSwapUpdates(
    {
      swapData,
      swapType: type,
      metrics: marketMetrics,
      poolData: {
        parentPoolAddress: address,
        price,
      },
      chainId: BigInt(chain.id),
      context,
    },
    entityUpdaters
  );

  // Calculate graduation percentage
  const graduationPercentage = computeGraduationPercentage({
    maxThreshold: poolEntity.maxThreshold,
    graduationBalance: totalProceeds,
  });

  // V4-specific updates
  await Promise.all([
    updatePool({
      poolAddress: address,
      context,
      update: {
        liquidity: v4PoolData.liquidity,
        graduationBalance: totalProceeds,
        graduationPercentage,
        totalProceeds,
        totalTokensSold,
      },
    }),
    addAndUpdateV4PoolPriceHistory({
      pool: address,
      timestamp: Number(event.block.timestamp),
      marketCapUsd,
      context,
    }),
  ]);
});
