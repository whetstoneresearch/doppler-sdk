import { ponder } from "ponder:registry";
import { computeGraduationThresholdDelta } from "@app/utils/v3-utils/computeGraduationThreshold";
import {
  insertPositionIfNotExists,
  updatePosition,
} from "./shared/entities/position";
import { insertTokenIfNotExists } from "./shared/entities/token";
import {
  insertOrUpdateDailyVolume,
  compute24HourPriceChange,
} from "./shared/timeseries";
import {
  insertPoolIfNotExists,
  updatePool,
} from "./shared/entities/pool";
import { insertAssetIfNotExists, updateAsset } from "./shared/entities/asset";
import { computeDollarLiquidity } from "@app/utils/computeDollarLiquidity";
import { insertOrUpdateBuckets } from "./shared/timeseries";
import { computeMarketCap, fetchEthPrice } from "./shared/oracle";
import {
  insertActivePoolsBlobIfNotExists,
  tryAddActivePool,
} from "./shared/scheduledJobs";
import { insertSwapIfNotExists } from "./shared/entities/swap";
import { CHAINLINK_ETH_DECIMALS } from "@app/utils/constants";
import { SwapOrchestrator, SwapService, PriceService } from "@app/core";

ponder.on("UniswapV3Initializer:Create", async ({ event, context }) => {
  const { poolOrHook, asset, numeraire } = event.args;
  const timestamp = event.block.timestamp;

  const creatorId = event.transaction.from.toLowerCase() as `0x${string}`;
  const numeraireId = numeraire.toLowerCase() as `0x${string}`;
  const assetId = asset.toLowerCase() as `0x${string}`;
  const poolOrHookId = poolOrHook.toLowerCase() as `0x${string}`;

  const ethPrice = await fetchEthPrice(timestamp, context);

  const [poolEntity, assetTokenEntity] = await Promise.all([
    insertPoolIfNotExists({
      poolAddress: poolOrHookId,
      context,
      timestamp,
      ethPrice,
    }),
    insertTokenIfNotExists({
      tokenAddress: assetId,
      creatorAddress: creatorId,
      timestamp,
      context,
    }),
    insertTokenIfNotExists({
      tokenAddress: numeraireId,
      creatorAddress: creatorId,
      timestamp,
      context,
      isDerc20: false,
    }),
  ])

  const { price } = poolEntity;
  const { totalSupply } = assetTokenEntity;
  const marketCapUsd = computeMarketCap({
    price,
    ethPrice,
    totalSupply,
  });

  // benchmark time 
  await Promise.all([
    insertActivePoolsBlobIfNotExists({
      context,
    }),
    insertAssetIfNotExists({
      assetAddress: assetId,
      timestamp,
      context,
    }),
    insertOrUpdateBuckets({
      poolAddress: poolOrHookId,
      price,
      timestamp,
      ethPrice,
      context,
    }),
    insertOrUpdateDailyVolume({
      poolAddress: poolOrHookId,
      amountIn: 0n,
      amountOut: 0n,
      timestamp,
      context,
      tokenIn: assetId,
      tokenOut: numeraireId,
      ethPrice,
      marketCapUsd,
    }),
  ]);
});

ponder.on("UniswapV3Pool:Mint", async ({ event, context }) => {
  const address = event.log.address.toLowerCase() as `0x${string}`;
  const { tickLower, tickUpper, amount, owner, amount0, amount1 } = event.args;
  const timestamp = event.block.timestamp;

  const ethPrice = await fetchEthPrice(timestamp, context);

  const {
    baseToken,
    isToken0,
    price,
    liquidity,
    reserves0,
    reserves1,
    graduationThreshold,
  } = await insertPoolIfNotExists({
    poolAddress: address,
    timestamp,
    context,
    ethPrice,
  });



  const reserveAssetBefore = isToken0 ? reserves0 : reserves1;
  const reserveQuoteBefore = isToken0 ? reserves1 : reserves0;

  const reserveAssetDelta = isToken0 ? amount0 : amount1;
  const reserveQuoteDelta = isToken0 ? amount1 : amount0;

  const nextReservesAsset = reserveAssetBefore + reserveAssetDelta;
  const nextReservesQuote = reserveQuoteBefore + reserveQuoteDelta;

  const liquidityUsd = computeDollarLiquidity({
    assetBalance: nextReservesAsset,
    quoteBalance: nextReservesQuote,
    price,
    ethPrice,
  });

  const graduationThresholdDelta = computeGraduationThresholdDelta({
    tickLower,
    tickUpper,
    liquidity: amount,
    isToken0,
  });

  const [positionEntity] = await Promise.all([
    insertPositionIfNotExists({
      poolAddress: address,
      tickLower,
      tickUpper,
      liquidity: amount,
      owner,
      timestamp,
      context,
    }),
    insertAssetIfNotExists({
      assetAddress: baseToken,
      timestamp,
      context,
    }),
    updateAsset({
      assetAddress: baseToken,
      context,
      update: {
        liquidityUsd,
      },
    }),
    updatePool({
      poolAddress: address,
      context,
      update: {
        graduationThreshold: graduationThreshold + graduationThresholdDelta,
        liquidity: liquidity + amount,
        dollarLiquidity: liquidityUsd,
        reserves0: reserves0 + amount0,
        reserves1: reserves1 + amount1,
      },
    }),
  ])


  if (positionEntity.createdAt != timestamp) {
    await updatePosition({
      poolAddress: address,
      tickLower,
      tickUpper,
      context,
      update: {
        liquidity: positionEntity.liquidity + amount,
      },
    });
  }
});

ponder.on("UniswapV3Pool:Burn", async ({ event, context }) => {
  const address = event.log.address.toLowerCase() as `0x${string}`;
  const timestamp = event.block.timestamp;
  const { tickLower, tickUpper, owner, amount, amount0, amount1 } = event.args;

  const ethPrice = await fetchEthPrice(timestamp, context);

  const {
    baseToken,
    isToken0,
    price,
    liquidity,
    reserves0,
    reserves1,
    graduationThreshold,
  } = await insertPoolIfNotExists({
    poolAddress: address,
    timestamp,
    context,
    ethPrice,
  });

  const reserveAssetBefore = isToken0 ? reserves0 : reserves1;
  const reserveQuoteBefore = isToken0 ? reserves1 : reserves0;

  const reserveAssetDelta = isToken0 ? amount0 : amount1;
  const reserveQuoteDelta = isToken0 ? amount1 : amount0;

  const nextReservesAsset = reserveAssetBefore - reserveAssetDelta;
  const nextReservesQuote = reserveQuoteBefore - reserveQuoteDelta;

  const liquidityUsd = computeDollarLiquidity({
    assetBalance: nextReservesAsset,
    quoteBalance: nextReservesQuote,
    price,
    ethPrice,
  });

  const graduationThresholdDelta = computeGraduationThresholdDelta({
    tickLower,
    tickUpper,
    liquidity,
    isToken0,
  });

  const positionEntity = await insertPositionIfNotExists({
    poolAddress: address,
    tickLower,
    tickUpper,
    liquidity: amount,
    owner,
    timestamp,
    context,
  });

  await Promise.all([
    updateAsset({
      assetAddress: baseToken,
      context,
      update: {
        liquidityUsd,
      },
    }),
    updatePool({
      poolAddress: address,
      context,
      update: {
        liquidity: liquidity - amount,
        dollarLiquidity: liquidityUsd,
        graduationThreshold: graduationThreshold - graduationThresholdDelta,
        reserves0: reserves0 - amount0,
        reserves1: reserves1 - amount1,
      },
    }),
    updatePosition({
      poolAddress: address,
      tickLower,
      tickUpper,
      context,
      update: {
        liquidity: positionEntity.liquidity - amount,
      },
    }),
  ]);
});

ponder.on("UniswapV3Pool:Swap", async ({ event, context }) => {
  const { chain } = context;
  const address = event.log.address.toLowerCase() as `0x${string}`;
  const timestamp = event.block.timestamp;
  const { amount0, amount1, sqrtPriceX96 } = event.args;
  const chainId = chain.id;

  const ethPrice = await fetchEthPrice(event.block.timestamp, context);

  const {
    isToken0,
    baseToken,
    quoteToken,
    reserves0,
    reserves1,
    fee,
    totalFee0,
    totalFee1,
    graduationBalance,
    migrated
  } = await insertPoolIfNotExists({
    poolAddress: address,
    timestamp,
    context,
    ethPrice,
  });

  if (migrated) {
    return;
  }

  const price = PriceService.computePriceFromSqrtPriceX96({
    sqrtPriceX96,
    isToken0,
    decimals: 18,
  });

  const reserveAssetBefore = isToken0 ? reserves0 : reserves1;
  const reserveQuoteBefore = isToken0 ? reserves1 : reserves0;

  const reserveAssetDelta = isToken0 ? amount0 : amount1;
  const reserveQuoteDelta = isToken0 ? amount1 : amount0;

  const nextReservesAsset = reserveAssetBefore + reserveAssetDelta;
  const nextReservesQuote = reserveQuoteBefore + reserveQuoteDelta;

  let amountIn;
  let amountOut;
  let fee0;
  let fee1;
  if (amount0 > 0n) {
    amountIn = amount0;
    amountOut = amount1;
    fee0 = (amountIn * BigInt(fee)) / BigInt(1_000_000);
    fee1 = 0n;
  } else {
    amountIn = amount1;
    amountOut = amount0;
    fee1 = (amountIn * BigInt(fee)) / BigInt(1_000_000);
    fee0 = 0n;
  }

  // buy or sell
  const type = SwapService.determineSwapType({
    isToken0,
    amount0,
    amount1,
  });

  const quoteDelta = isToken0 ? amount1 - fee1 : amount0 - fee0;

  const dollarLiquidity = computeDollarLiquidity({
    assetBalance: nextReservesAsset,
    quoteBalance: nextReservesQuote,
    price,
    ethPrice,
  });

  const { totalSupply } = await insertTokenIfNotExists({
    tokenAddress: baseToken,
    creatorAddress: address,
    timestamp,
    context,
    isDerc20: true,
    poolAddress: address,
  });

  const marketCapUsd = computeMarketCap({
    price,
    ethPrice,
    totalSupply,
  });

  const swapValueUsd = (reserveQuoteDelta < 0n ? -reserveQuoteDelta : reserveQuoteDelta) * ethPrice / CHAINLINK_ETH_DECIMALS;

  const priceChangeInfo = await compute24HourPriceChange({
    poolAddress: address,
    marketCapUsd,
    context,
  });

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
  const metrics = {
    liquidityUsd: dollarLiquidity,
    marketCapUsd,
    swapValueUsd,
    percentDayChange: priceChangeInfo,
  };

  // Define entity updaters
  const entityUpdaters = {
    updatePool,
    updateAsset,
    insertSwap: insertSwapIfNotExists,
    insertOrUpdateBuckets,
    insertOrUpdateDailyVolume,
    tryAddActivePool,
  };

  // Perform common updates via orchestrator
  await Promise.all([
    SwapOrchestrator.performSwapUpdates(
      {
        swapData,
        swapType: type,
        metrics,
        poolData: {
          parentPoolAddress: address,
          price,
        },
        chainId: BigInt(chainId),
        context,
      },
      entityUpdaters
    ),
    // V3-specific pool updates that aren't handled by the orchestrator
    updatePool({
      poolAddress: address,
      context,
      update: {
        sqrtPrice: sqrtPriceX96,
        totalFee0: totalFee0 + fee0,
        totalFee1: totalFee1 + fee1,
        graduationBalance: graduationBalance + quoteDelta,
        lastRefreshed: timestamp,
        percentDayChange: priceChangeInfo,
        reserves0: reserves0 + amount0,
        reserves1: reserves1 + amount1,
      },
    }),
  ]);
});
