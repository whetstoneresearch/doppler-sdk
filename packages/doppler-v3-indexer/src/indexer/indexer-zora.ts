import { ponder } from "ponder:registry";
import {
  insertPositionIfNotExists,
  updatePosition,
} from "./shared/entities/position";
import { insertTokenIfNotExists, updateToken } from "./shared/entities/token";
import {
  insertOrUpdateDailyVolume,
  compute24HourPriceChange,
  insertOrUpdateDailyVolumeZora,
} from "./shared/timeseries";
import {
  insertLockableV3PoolIfNotExists,
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
import { computeGraduationThresholdDelta } from "@app/utils/v3-utils/computeGraduationThreshold";
import { insertUserIfNotExists, updateUser } from "./shared/entities/user";
import { insertUserAssetIfNotExists, updateUserAsset } from "./shared/entities/userAsset";
import { asset, pool } from "ponder:schema";
import { insertZoraAssetIfNotExists, updateZoraAsset } from "./shared/entities/zora/asset";
import { insertZoraPoolIfNotExists, insertZoraPoolV4IfNotExists } from "./shared/entities/zora/pool";
import { Address, zeroAddress } from "viem";
import { computeV3Price } from "@app/utils";

ponder.on("ZoraFactory:CoinCreated", async ({ event, context }) => {
  const { pool, coin, currency, caller } = event.args;
  const timestamp = event.block.timestamp;

  const numeraireId = currency.toLowerCase() as `0x${string}`;

  const isToken0 = coin.toLowerCase() < currency.toLowerCase();

  const ethPrice = await fetchEthPrice(timestamp, context);

  const [poolEntity, assetTokenEntity] = await Promise.all([
    insertZoraPoolIfNotExists({
      poolAddress: pool,
      context,
      timestamp,
    }),
    insertTokenIfNotExists({
      tokenAddress: coin,
      creatorAddress: caller,
      timestamp,
      context,
    }),
    insertTokenIfNotExists({
      tokenAddress: numeraireId,
      creatorAddress: caller,
      timestamp,
      context,
      isDerc20: false,
    }),
  ]);

  const price = computeV3Price({
    sqrtPriceX96: poolEntity.sqrtPrice,
    isToken0,
    decimals: 18,
  });

  const { totalSupply } = assetTokenEntity;
  const marketCapUsd = computeMarketCap({
    price,
    ethPrice,
    totalSupply,
  });

  const liquidityUsd = computeDollarLiquidity({
    assetBalance: isToken0 ? poolEntity.reserves0 : poolEntity.reserves1,
    quoteBalance: isToken0 ? poolEntity.reserves1 : poolEntity.reserves0,
    price,
    ethPrice,
  });

  await Promise.all([
    insertActivePoolsBlobIfNotExists({
      context,
    }),
    insertZoraAssetIfNotExists({
      assetAddress: coin,
      poolAddress: pool,
      numeraireAddress: currency,
      timestamp,
      context,
    }),
    insertOrUpdateBuckets({
      poolAddress: pool,
      price,
      timestamp,
      ethPrice,
      context,
    }),
    insertOrUpdateDailyVolumeZora({
      poolAddress: pool,
      numeraireAddress: currency,
      amountIn: 0n,
      amountOut: 0n,
      timestamp,
      context,
      tokenIn: coin,
      tokenOut: numeraireId,
      ethPrice,
      marketCapUsd,
    }),
    updatePool({
      poolAddress: pool,
      context,
      update: {
        price,
        isToken0,
        asset: coin,
        baseToken: coin,
        quoteToken: currency,
        marketCapUsd,
        dollarLiquidity: liquidityUsd,
      }
    })
  ]);
});

ponder.on("ZoraUniswapV3Pool:Initialize", async ({ event, context }) => {
  const poolAddress = event.log.address;
  const { sqrtPriceX96, tick } = event.args;
  const timestamp = event.block.timestamp;

  await insertZoraPoolIfNotExists({
    poolAddress,
    timestamp,
    context,
    tick,
    sqrtPrice: sqrtPriceX96,
  });
});

ponder.on("ZoraUniswapV3Pool:Mint", async ({ event, context }) => {
  const address = event.log.address.toLowerCase() as `0x${string}`;
  const { tickLower, tickUpper, amount, owner, amount0, amount1 } = event.args;
  const timestamp = event.block.timestamp;
  const ethPrice = await fetchEthPrice(timestamp, context);

  const {
    baseToken,
    quoteToken,
    isToken0,
    price,
    liquidity,
    reserves0,
    reserves1,
  } = await insertZoraPoolIfNotExists({
    poolAddress: address,
    timestamp,
    context,
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

  if (baseToken !== zeroAddress) {
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

    await insertZoraAssetIfNotExists({
        assetAddress: baseToken,
        poolAddress: address,
        numeraireAddress: quoteToken,
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
          liquidity: liquidity + amount,
          dollarLiquidity: liquidityUsd,
          reserves0: reserves0 + amount0,
          reserves1: reserves1 + amount1,
        },
      }),
    ]);
  } else {
    await updatePool({
      poolAddress: address,
      context,
      update: {
        liquidity: liquidity + amount,
        reserves0: reserves0 + amount0,
        reserves1: reserves1 + amount1,
      },
    })
  }

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

ponder.on("ZoraUniswapV3Pool:Burn", async ({ event, context }) => {
  const address = event.log.address.toLowerCase() as `0x${string}`;
  const timestamp = event.block.timestamp;
  const { tickLower, tickUpper, owner, amount, amount0, amount1 } = event.args;

  if (amount === 0n) {
    return;
  }

  const ethPrice = await fetchEthPrice(timestamp, context);

  const {
    baseToken,
    isToken0,
    price,
    liquidity,
    reserves0,
    reserves1,
  } = await insertZoraPoolIfNotExists({
    poolAddress: address,
    timestamp,
    context,
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


ponder.on("ZoraCoin:CoinTransfer", async ({ event, context }) => {
  const { address } = event.log;
  const { timestamp } = event.block;
  const { sender, recipient, senderBalance, recipientBalance } = event.args;

  const { db, chain } = context;

  const creatorAddress = event.transaction.from;

  const [tokenData, fromUser, toUserAsset, fromUserAsset, assetData] =
    await Promise.all([
      insertTokenIfNotExists({
        tokenAddress: address,
        creatorAddress,
        timestamp,
        context,
        isDerc20: true,
      }),
      insertUserIfNotExists({
        userId: recipient,
        timestamp,
        context,
      }),
      insertUserAssetIfNotExists({
        userId: recipient,
        assetId: address,
        timestamp,
        context,
      }),
      insertUserAssetIfNotExists({
        userId: sender,
        assetId: address,
        timestamp,
        context,
      }),
      db.find(asset, {
        address: address,
      }),
      insertUserIfNotExists({
        userId: sender,
        timestamp,
        context,
      }),
  ]);

  let holderCountDelta = 0;
  if (toUserAsset.balance == 0n && recipientBalance > 0n) {
    holderCountDelta += 1;
  }
  if (fromUserAsset.balance > 0n && senderBalance == 0n) {
    holderCountDelta -= 1;
  }

  const [poolEntity] = await Promise.all([
    db.find(pool, {
      address: address,
      chainId: BigInt(chain.id),
    }),
    updateToken({
      tokenAddress: address,
      context,
      update: {
        holderCount: tokenData.holderCount + holderCountDelta,
      },
    }),
    updateUserAsset({
      userId: recipient,
      assetId: address,
      context,
      update: {
        balance: recipientBalance,
        lastInteraction: timestamp,
      },
    }),
    updateUserAsset({
      userId: sender,
      assetId: address,
      context,
      update: {
        lastInteraction: timestamp,
        balance: senderBalance,
      },
    }),
  ]);

  if (poolEntity && assetData) {
    await Promise.all([
      updatePool({
        poolAddress: address,
        context,
        update: {
          holderCount: tokenData.holderCount + holderCountDelta,
        },
      }),
      updateZoraAsset({
        assetAddress: address,
        context,
        update: {
          holderCount: assetData.holderCount + holderCountDelta,
        },
      }),
    ]);
  }
});

ponder.on("ZoraFactory:CoinCreatedV4", async ({ event, context }) => {
  const { coin, currency, poolKey, caller } = event.args;
  const timestamp = event.block.timestamp;

  const poolAddress = poolKey.hooks as Address;
  const numeraireId = currency.toLowerCase() as `0x${string}`;
  const ethPrice = await fetchEthPrice(timestamp, context);

  const [poolEntity, assetTokenEntity] = await Promise.all([
    insertZoraPoolV4IfNotExists({
      poolAddress,
      context,
      timestamp,
      ethPrice,
      poolKey,
      baseToken: coin,
      quoteToken: currency,
    }),
    insertTokenIfNotExists({
      tokenAddress: coin,
      creatorAddress: caller,
      timestamp,
      context,
    }),
    insertTokenIfNotExists({
      tokenAddress: numeraireId,
      creatorAddress: caller,
      timestamp,
      context,
      isDerc20: false,
    }),
  ]);

  const { totalSupply } = assetTokenEntity;
  const marketCapUsd = computeMarketCap({
    price: poolEntity.price,
    ethPrice,
    totalSupply,
  });

  await Promise.all([
    insertActivePoolsBlobIfNotExists({
      context,
    }),
    insertZoraAssetIfNotExists({
      assetAddress: coin,
      poolAddress,
      numeraireAddress: currency,
      timestamp,
      context,
    }),
    insertOrUpdateBuckets({
      poolAddress,
      price: poolEntity.price,
      timestamp,
      ethPrice,
      context,
    }),
    insertOrUpdateDailyVolume({
      poolAddress,
      amountIn: 0n,
      amountOut: 0n,
      timestamp,
      context,
      tokenIn: coin,
      tokenOut: numeraireId,
      ethPrice,
      marketCapUsd,
    }),
    updatePool({
      poolAddress,
      context,
      update: {
        marketCapUsd,
      }
    })
  ]);
});
