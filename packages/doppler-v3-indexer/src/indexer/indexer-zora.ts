import { ponder } from "ponder:registry";
import { appendTokenPool, insertTokenIfNotExists, updateToken } from "./shared/entities/token";
import {
  updatePool,
} from "./shared/entities/pool";
import { updateAsset } from "./shared/entities/asset";
import { computeDollarLiquidity } from "@app/utils/computeDollarLiquidity";
import { computeMarketCap, fetchEthPrice, fetchZoraPrice } from "./shared/oracle";
import {
  tryAddActivePool,
} from "./shared/scheduledJobs";
import { SwapOrchestrator } from "@app/core";
import { insertUserIfNotExists } from "./shared/entities/user";
import { insertUserAssetIfNotExists, updateUserAsset } from "./shared/entities/userAsset";
import { asset, pool, token } from "ponder:schema";
import { insertZoraAssetIfNotExists, updateZoraAsset } from "./shared/entities/zora/asset";
import { insertZoraPoolV4IfNotExists } from "./shared/entities/zora/pool";
import { zeroAddress } from "viem";
import { computeV3Price } from "@app/utils";
import { chainConfigs } from "@app/config";
import { PriceService, SwapService } from "@app/core";

ponder.on("ZoraFactory:CoinCreatedV4", async ({ event, context }) => {
  const { db, chain } = context;
  const { coin, currency, poolKey, poolKeyHash, caller } = event.args;
  const timestamp = event.block.timestamp;

  const poolAddress = poolKeyHash.toLowerCase() as `0x${string}`;
  const coinAddress = coin.toLowerCase() as `0x${string}`;
  const currencyAddress = currency.toLowerCase() as `0x${string}`;
  const callerId = caller.toLowerCase() as `0x${string}`;

  const zoraPrice = await fetchZoraPrice(timestamp, context);
  const ethPrice = await fetchEthPrice(timestamp, context);

  const isQuoteZora = currency != zeroAddress && currency.toLowerCase() === chainConfigs[context.chain.name].addresses.zora.zoraToken.toLowerCase();
  const isQuoteEth = currency === zeroAddress || currency.toLowerCase() === chainConfigs[context.chain.name].addresses.shared.weth.toLowerCase();

  let isQuoteCreatorCoin = false;
  let creatorCoinPid = null;
  if (!isQuoteZora && !isQuoteEth) {
    const creatorCoinEntity = await db.find(token, {
      address: currencyAddress,
    });

    isQuoteCreatorCoin = creatorCoinEntity?.isCreatorCoin ?? false;
    if (isQuoteCreatorCoin) {
      creatorCoinPid = creatorCoinEntity?.pool;
    }
  }

  if (!isQuoteZora && !isQuoteEth && !isQuoteCreatorCoin && !creatorCoinPid) {
    return;
  }

  let usdPrice;
  if (isQuoteZora) {
    usdPrice = zoraPrice;
  } else if (isQuoteEth) {
    usdPrice = ethPrice;
  } else if (isQuoteCreatorCoin && creatorCoinPid) {
    const creatorCoinPool = await db.find(pool, {
      address: creatorCoinPid as `0x${string}`,
      chainId: BigInt(chain.id),
    });

    if (!creatorCoinPool) {
      return;
    }

    const { sqrtPrice, isToken0: creatorCoinIsToken0 } = creatorCoinPool;

    const creatorCoinPrice = computeV3Price({
      sqrtPriceX96: sqrtPrice,
      isToken0: creatorCoinIsToken0,
      decimals: 18,
    });

    const contentCoinUsdPrice = creatorCoinPrice * zoraPrice / 10n ** 18n;

    usdPrice = contentCoinUsdPrice;
  }

  if (!usdPrice) {
    return;
  }


  const [poolEntity, assetTokenEntity] = await Promise.all([
    insertZoraPoolV4IfNotExists({
      poolAddress,
      context,
      timestamp,
      ethPrice: usdPrice,
      poolKey,
      baseToken: coinAddress,
      quoteToken: currencyAddress,
      isQuoteZora,
      isCreatorCoin: false,
      isContentCoin: true,
    }),
    appendTokenPool({
      tokenAddress: coinAddress,
      isDerc20: false,
      isCreatorCoin: false,
      isContentCoin: true,
      poolAddress,
      context,
      creatorCoinPid: creatorCoinPid ?? null,
    }),
    insertTokenIfNotExists({
      tokenAddress: currencyAddress,
      creatorAddress: callerId,
      timestamp,
      context,
      isDerc20: false,
    }),
  ]);


  const { totalSupply } = assetTokenEntity;
  const marketCapUsd = computeMarketCap({
    price: poolEntity.price,
    ethPrice: usdPrice,
    totalSupply,
    decimals: isQuoteEth ? 8 : 18,
  });

  const isToken0 = poolEntity.isToken0;

  const dollarLiquidity = computeDollarLiquidity({
    assetBalance: isToken0 ? poolEntity.reserves0 : poolEntity.reserves1,
    quoteBalance: isToken0 ? poolEntity.reserves1 : poolEntity.reserves0,
    price: poolEntity.price,
    ethPrice: usdPrice,
    decimals: isQuoteEth ? 8 : 18,
  });


  await Promise.all([
    insertZoraAssetIfNotExists({
      assetAddress: coinAddress,
      poolAddress,
      numeraireAddress: currencyAddress,
      timestamp,
      context,
    }),
    updatePool({
      poolAddress,
      context,
      update: {
        marketCapUsd,
        dollarLiquidity,
        poolKey: poolKey,
      }
    })
  ]);
});

ponder.on("ZoraFactory:CreatorCoinCreated", async ({ event, context }) => {
  const { coin, currency, poolKey, poolKeyHash, caller } = event.args;
  const timestamp = event.block.timestamp;

  const poolAddress = poolKeyHash.toLowerCase() as `0x${string}`;
  const coinAddress = coin.toLowerCase() as `0x${string}`;
  const currencyAddress = currency.toLowerCase() as `0x${string}`;
  const callerId = caller.toLowerCase() as `0x${string}`;

  const zoraPrice = await fetchZoraPrice(timestamp, context);
  const ethPrice = await fetchEthPrice(timestamp, context);

  const isQuoteZora = currency != zeroAddress && currency.toLowerCase() === chainConfigs[context.chain.name].addresses.zora.zoraToken.toLowerCase();
  const isQuoteEth = currency === zeroAddress || currency.toLowerCase() === chainConfigs[context.chain.name].addresses.shared.weth.toLowerCase();

  if (!isQuoteEth && !isQuoteZora) {
    return;
  }

  let usdPrice;
  if (isQuoteZora) {
    usdPrice = zoraPrice;
  } else if (isQuoteEth) {
    usdPrice = ethPrice;
  }

  if (!usdPrice) {
    return;
  }

  const [poolEntity, assetTokenEntity] = await Promise.all([
    insertZoraPoolV4IfNotExists({
      poolAddress,
      context,
      timestamp,
      ethPrice: usdPrice,
      poolKey,
      baseToken: coinAddress,
      quoteToken: currencyAddress,
      isQuoteZora,
      isCreatorCoin: true,
      isContentCoin: false,
      poolKeyHash,
    }),
    appendTokenPool({
      tokenAddress: coinAddress,
      isDerc20: true,
      isCreatorCoin: true,
      isContentCoin: false,
      poolAddress,
      context,
      creatorAddress: callerId,
    }),
    insertTokenIfNotExists({
      tokenAddress: currencyAddress,
      creatorAddress: callerId,
      timestamp,
      context,
    }),
  ]);

  const { totalSupply } = assetTokenEntity;
  const marketCapUsd = computeMarketCap({
    price: poolEntity.price,
    ethPrice: usdPrice,
    totalSupply,
    decimals: isQuoteEth ? 8 : 18,
  });

  const isToken0 = poolEntity.isToken0;

  const dollarLiquidity = computeDollarLiquidity({
    assetBalance: isToken0 ? poolEntity.reserves0 : poolEntity.reserves1,
    quoteBalance: isToken0 ? poolEntity.reserves1 : poolEntity.reserves0,
    price: poolEntity.price,
    ethPrice: usdPrice,
    decimals: isQuoteEth ? 8 : 18,
  });

  await Promise.all([
    insertZoraAssetIfNotExists({
      assetAddress: coinAddress,
      poolAddress,
      numeraireAddress: currencyAddress,
      timestamp,
      context,
    }),
    updatePool({
      poolAddress,
      context,
      update: {
        marketCapUsd,
        dollarLiquidity,
        poolKey: poolKey,
      }
    })
  ]);
});

ponder.on("ZoraV4Hook:Swapped", async ({ event, context }) => {
  const { chain, db } = context;
  const { sender, poolKeyHash, swapSender, key, params, amount0, amount1, sqrtPriceX96, isCoinBuy } = event.args;
  const timestamp = event.block.timestamp;

  const poolAddress = poolKeyHash.toLowerCase() as `0x${string}`;

  const poolEntity = await db.find(pool, {
    address: poolAddress,
    chainId: BigInt(chain.id),
  });

  if (!poolEntity) {
    return;
  }

  const zoraPrice = await fetchZoraPrice(timestamp, context);
  const ethPrice = await fetchEthPrice(timestamp, context);

  const isQuoteZora = poolEntity.quoteToken.toLowerCase() === chainConfigs[context.chain.name].addresses.zora.zoraToken.toLowerCase();
  const isQuoteEth = poolEntity.quoteToken.toLowerCase() === chainConfigs[context.chain.name].addresses.shared.weth.toLowerCase();

  let isQuoteCreatorCoin = false;
  let creatorCoinPid = null;
  if (!isQuoteZora && !isQuoteEth) {
    const creatorCoinEntity = await db.find(token, {
      address: poolEntity.quoteToken,
    });
    isQuoteCreatorCoin = creatorCoinEntity?.isCreatorCoin ?? false;
    if (isQuoteCreatorCoin) {
      creatorCoinPid = creatorCoinEntity?.pool;
    }
  }

  if (!isQuoteZora && !isQuoteEth && !isQuoteCreatorCoin && !creatorCoinPid) {
    return;
  }


  let usdPrice;
  if (isQuoteZora) {
    usdPrice = zoraPrice;
  } else if (isQuoteEth) {
    usdPrice = ethPrice;
  } else if (isQuoteCreatorCoin && creatorCoinPid) {
    const creatorCoinPool = await db.find(pool, {
      address: creatorCoinPid as `0x${string}`,
      chainId: BigInt(chain.id),
    });

    if (!creatorCoinPool) {
      return;
    }

    const { sqrtPrice, isToken0: creatorCoinIsToken0 } = creatorCoinPool;

    const creatorCoinPrice = computeV3Price({
      sqrtPriceX96: sqrtPrice,
      isToken0: creatorCoinIsToken0,
      decimals: 18,
    });

    const contentCoinUsdPrice = creatorCoinPrice * zoraPrice / 10n ** 18n;

    usdPrice = contentCoinUsdPrice;
  }

  if (!usdPrice) {
    return;
  }

  const {
    isToken0,
    baseToken,
    quoteToken,
    reserves0,
    reserves1,
    fee,
    totalFee0,
    totalFee1,
  } = poolEntity;

  const price = PriceService.computePriceFromSqrtPriceX96({
    sqrtPriceX96,
    isToken0,
    decimals: 18,
  });

  const reserveAssetBefore = isToken0 ? reserves0 : reserves1;
  const reserveQuoteBefore = isToken0 ? reserves1 : reserves0;

  const reserveAssetDelta = isToken0 ? amount0 : amount1;
  const reserveQuoteDelta = isToken0 ? amount1 : amount0;

  const realQuoteDelta = isCoinBuy ? reserveQuoteDelta : -reserveQuoteDelta;
  const realAssetDelta = isCoinBuy ? -reserveAssetDelta : reserveAssetDelta;

  const nextReservesAsset = reserveAssetBefore + realAssetDelta;
  const nextReservesQuote = reserveQuoteBefore + realQuoteDelta;

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

  const dollarLiquidity = computeDollarLiquidity({
    assetBalance: nextReservesAsset,
    quoteBalance: nextReservesQuote,
    price,
    ethPrice: usdPrice,
    decimals: isQuoteEth ? 8 : 18,
  });

  const { totalSupply } = await insertTokenIfNotExists({
    tokenAddress: baseToken,
    creatorAddress: swapSender,
    timestamp,
    context,
    isDerc20: true,
    poolAddress,
  });


  const marketCapUsd = computeMarketCap({
    price,
    ethPrice: usdPrice,
    totalSupply,
    decimals: isQuoteEth ? 8 : 18,
  });

  const swapValueUsd =
    ((reserveQuoteDelta < 0n ? -reserveQuoteDelta : reserveQuoteDelta) *
      usdPrice) /
    BigInt(10 ** 18);


  // Create swap data
  const swapData = SwapOrchestrator.createSwapData({
    poolAddress,
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
    ethPriceUSD: usdPrice,
  });


  // Create market metrics
  const metrics = {
    liquidityUsd: dollarLiquidity,
    marketCapUsd,
    swapValueUsd,
    percentDayChange: 0,
  };

  // Define entity updaters
  const entityUpdaters = {
    updatePool,
    updateAsset,
    tryAddActivePool,
  };


  await Promise.all([
    SwapOrchestrator.performSwapUpdates(
      {
        swapData,
        swapType: type,
        metrics,
        poolData: {
          parentPoolAddress: poolAddress,
          price,
        },
        chainId: BigInt(context.chain.id),
        context,
      },
      entityUpdaters
    ),
    updatePool({
      poolAddress,
      context,
      update: {
        sqrtPrice: sqrtPriceX96,
        totalFee0: totalFee0 + fee0,
        totalFee1: totalFee1 + fee1,
        lastRefreshed: timestamp,
        reserves0: reserves0 - amount0,
        reserves1: reserves1 - amount1,
        lastSwapTimestamp: timestamp,
      },
    }),
  ]);
});

ponder.on("ZoraV4CreatorCoinHook:Swapped", async ({ event, context }) => {
  const { chain, db } = context;
  const { sender, poolKeyHash, swapSender, key, params, amount0, amount1, sqrtPriceX96, isCoinBuy } = event.args;
  const timestamp = event.block.timestamp;

  const poolAddress = poolKeyHash.toLowerCase() as `0x${string}`;

  const poolEntity = await db.find(pool, {
    address: poolAddress,
    chainId: BigInt(chain.id),
  });

  if (!poolEntity) {
    return;
  }

  const zoraPrice = await fetchZoraPrice(timestamp, context);
  const ethPrice = await fetchEthPrice(timestamp, context);

  const isQuoteZora = poolEntity.quoteToken.toLowerCase() === chainConfigs[context.chain.name].addresses.zora.zoraToken.toLowerCase();
  const isQuoteEth = poolEntity.quoteToken.toLowerCase() === chainConfigs[context.chain.name].addresses.shared.weth.toLowerCase();

  let isQuoteCreatorCoin = false;
  let creatorCoinPid = null;
  if (!isQuoteZora && !isQuoteEth) {
    const creatorCoinEntity = await db.find(token, {
      address: poolEntity.quoteToken,
    });
    isQuoteCreatorCoin = creatorCoinEntity?.isCreatorCoin ?? false;
    if (isQuoteCreatorCoin) {
      creatorCoinPid = creatorCoinEntity?.pool;
    }
  }
  if (!isQuoteZora && !isQuoteEth && !isQuoteCreatorCoin && !creatorCoinPid) {
    return;
  }

  let usdPrice;
  if (isQuoteZora) {
    usdPrice = zoraPrice;
  } else if (isQuoteEth) {
    usdPrice = ethPrice;
  } else if (isQuoteCreatorCoin && creatorCoinPid) {
    const creatorCoinPool = await db.find(pool, {
      address: creatorCoinPid as `0x${string}`,
      chainId: BigInt(chain.id),
    });

    if (!creatorCoinPool) {
      return;
    }

    const { sqrtPrice, isToken0: creatorCoinIsToken0 } = creatorCoinPool;

    const creatorCoinPrice = computeV3Price({
      sqrtPriceX96: sqrtPrice,
      isToken0: creatorCoinIsToken0,
      decimals: 18,
    });

    const contentCoinUsdPrice = creatorCoinPrice * zoraPrice / 10n ** 18n;

    usdPrice = contentCoinUsdPrice;
  }

  if (!usdPrice) {
    return;
  }

  const {
    isToken0,
    baseToken,
    quoteToken,
    reserves0,
    reserves1,
    fee,
    totalFee0,
    totalFee1,
  } = poolEntity;

  const price = PriceService.computePriceFromSqrtPriceX96({
    sqrtPriceX96,
    isToken0,
    decimals: 18,
  });

  const reserveAssetBefore = isToken0 ? reserves0 : reserves1;
  const reserveQuoteBefore = isToken0 ? reserves1 : reserves0;

  const reserveAssetDelta = isToken0 ? amount0 : amount1;
  const reserveQuoteDelta = isToken0 ? amount1 : amount0;

  const realQuoteDelta = isCoinBuy ? reserveQuoteDelta : -reserveQuoteDelta;
  const realAssetDelta = isCoinBuy ? -reserveAssetDelta : reserveAssetDelta;

  const nextReservesAsset = reserveAssetBefore + realAssetDelta;
  const nextReservesQuote = reserveQuoteBefore + realQuoteDelta;

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

  const dollarLiquidity = computeDollarLiquidity({
    assetBalance: nextReservesAsset,
    quoteBalance: nextReservesQuote,
    price,
    ethPrice: usdPrice,
    decimals: isQuoteEth ? 8 : 18,
  });

  const { totalSupply } = await insertTokenIfNotExists({
    tokenAddress: baseToken,
    creatorAddress: swapSender,
    timestamp,
    context,
    isDerc20: true,
    poolAddress,
  });


  const marketCapUsd = computeMarketCap({
    price,
    ethPrice: usdPrice,
    totalSupply,
    decimals: isQuoteEth ? 8 : 18,
  });

  const swapValueUsd =
    ((reserveQuoteDelta < 0n ? -reserveQuoteDelta : reserveQuoteDelta) *
      usdPrice) /
    BigInt(10 ** 18);


  // Create swap data
  const swapData = SwapOrchestrator.createSwapData({
    poolAddress,
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
    ethPriceUSD: usdPrice,
  });


  // Create market metrics
  const metrics = {
    liquidityUsd: dollarLiquidity,
    marketCapUsd,
    swapValueUsd,
    percentDayChange: 0,
  };

  // Define entity updaters
  const entityUpdaters = {
    updatePool,
    updateAsset,
    tryAddActivePool,
  };


  await Promise.all([
    SwapOrchestrator.performSwapUpdates(
      {
        swapData,
        swapType: type,
        metrics,
        poolData: {
          parentPoolAddress: poolAddress,
          price,
        },
        chainId: BigInt(context.chain.id),
        context,
      },
      entityUpdaters
    ),
    updatePool({
      poolAddress,
      context,
      update: {
        sqrtPrice: sqrtPriceX96,
        totalFee0: totalFee0 + fee0,
        totalFee1: totalFee1 + fee1,
        lastRefreshed: timestamp,
        reserves0: reserves0 - amount0,
        reserves1: reserves1 - amount1,
        lastSwapTimestamp: timestamp,
      },
    }),
  ]);
});

ponder.on("ZoraCreatorCoinV4:LiquidityMigrated", async ({ event, context }) => {
  const { chain, db } = context;
  const { fromPoolKey, fromPoolKeyHash, toPoolKey, toPoolKeyHash } = event.args;
  const timestamp = event.block.timestamp;

  const fromPoolAddress = fromPoolKeyHash;
  const toPoolAddress = toPoolKeyHash;

  const fromPoolEntity = await db.find(pool, {
    address: fromPoolAddress,
    chainId: BigInt(chain.id),
  });

  if (!fromPoolEntity) {
    return;
  }

  const zoraPrice = await fetchZoraPrice(timestamp, context);
  const ethPrice = await fetchEthPrice(timestamp, context);

  const isQuoteZora = fromPoolEntity.quoteToken.toLowerCase() === chainConfigs[context.chain.name].addresses.zora.zoraToken.toLowerCase();
  const isQuoteEth = fromPoolEntity.quoteToken.toLowerCase() === chainConfigs[context.chain.name].addresses.shared.weth.toLowerCase();

  await Promise.all([
    insertZoraPoolV4IfNotExists({
      poolAddress: toPoolAddress,
      context,
      timestamp,
      ethPrice: isQuoteEth ? ethPrice : zoraPrice,
      poolKey: toPoolKey,
      baseToken: fromPoolEntity.baseToken,
      quoteToken: fromPoolEntity.quoteToken,
      isQuoteZora,
      isCreatorCoin: true,
      isContentCoin: false,
    }),
    updateToken({
      tokenAddress: fromPoolEntity.baseToken,
      context,
      update: {
        pool: toPoolAddress,
      },
    }),
    updateAsset({
      assetAddress: fromPoolEntity.baseToken,
      context,
      update: {
        poolAddress: toPoolAddress,
      },
    })
  ]);

  const updateData = {
    ...fromPoolEntity,
    address: toPoolAddress,
    poolKey: toPoolKey,
  }

  await updatePool({
    poolAddress: toPoolAddress,
    context,
    update: updateData,
  });

  await db.delete(pool, {
    address: fromPoolAddress,
    chainId: BigInt(chain.id),
  }).catch(() => {
    console.log(`Failed to delete pool ${fromPoolAddress} from ZoraCreatorCoinV4:LiquidityMigrated`);
  });
});

ponder.on("ZoraCreatorCoinV4:CoinTransfer", async ({ event, context }) => {
  const { address } = event.log;
  const { timestamp } = event.block;
  const { sender, recipient, senderBalance, recipientBalance } = event.args;

  const { db, chain } = context;

  const creatorAddress = event.transaction.from.toLowerCase() as `0x${string}`;
  const recipientAddress = recipient.toLowerCase() as `0x${string}`;
  const senderAddress = sender.toLowerCase() as `0x${string}`;
  const tokenAddress = address.toLowerCase() as `0x${string}`;

  const [tokenData, fromUser, toUserAsset, fromUserAsset, assetData] =
    await Promise.all([
      insertTokenIfNotExists({
        tokenAddress,
        creatorAddress,
        timestamp,
        context,
      }),
      insertUserIfNotExists({
        userId: recipientAddress,
        timestamp,
        context,
      }),
      insertUserAssetIfNotExists({
        userId: recipientAddress,
        assetId: tokenAddress,
        timestamp,
        context,
      }),
      insertUserAssetIfNotExists({
        userId: senderAddress,
        assetId: tokenAddress,
        timestamp,
        context,
      }),
      db.find(asset, {
        address: tokenAddress,
      }),
      insertUserIfNotExists({
        userId: senderAddress,
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

  await Promise.all([
    updateToken({
      tokenAddress,
      context,
      update: {
        holderCount: tokenData.holderCount + holderCountDelta,
      },
    }),
    updateUserAsset({
      userId: recipientAddress,
      assetId: tokenAddress,
      context,
      update: {
        balance: recipientBalance,
        lastInteraction: timestamp,
      },
    }),
    updateUserAsset({
      userId: senderAddress,
      assetId: tokenAddress,
      context,
      update: {
        lastInteraction: timestamp,
        balance: senderBalance,
      },
    }),
  ]);

  const poolAddress = tokenData.pool;

  if (poolAddress && assetData) {
    await Promise.all([
      updatePool({
        poolAddress,
        context,
        update: {
          holderCount: tokenData.holderCount + holderCountDelta,
        },
      }),
      updateZoraAsset({
        assetAddress: tokenAddress,
        context,
        update: {
          holderCount: assetData.holderCount + holderCountDelta,
        },
      }),
    ]);
  }
});

ponder.on("ZoraCoinV4:CoinTransfer", async ({ event, context }) => {
  const { address } = event.log;
  const { timestamp } = event.block;
  const { sender, recipient, senderBalance, recipientBalance } = event.args;

  const { db, chain } = context;

  const creatorAddress = event.transaction.from.toLowerCase() as `0x${string}`;
  const recipientAddress = recipient.toLowerCase() as `0x${string}`;
  const senderAddress = sender.toLowerCase() as `0x${string}`;
  const tokenAddress = address.toLowerCase() as `0x${string}`;

  const [tokenData, fromUser, toUserAsset, fromUserAsset, assetData] =
    await Promise.all([
      insertTokenIfNotExists({
        tokenAddress,
        creatorAddress,
        timestamp,
        context,
      }),
      insertUserIfNotExists({
        userId: recipientAddress,
        timestamp,
        context,
      }),
      insertUserAssetIfNotExists({
        userId: recipientAddress,
        assetId: tokenAddress,
        timestamp,
        context,
      }),
      insertUserAssetIfNotExists({
        userId: senderAddress,
        assetId: tokenAddress,
        timestamp,
        context,
      }),
      db.find(asset, {
        address: tokenAddress,
      }),
      insertUserIfNotExists({
        userId: senderAddress,
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

  await Promise.all([
    updateToken({
      tokenAddress,
      context,
      update: {
        holderCount: tokenData.holderCount + holderCountDelta,
      },
    }),
    updateUserAsset({
      userId: recipientAddress,
      assetId: tokenAddress,
      context,
      update: {
        balance: recipientBalance,
        lastInteraction: timestamp,
      },
    }),
    updateUserAsset({
      userId: senderAddress,
      assetId: tokenAddress,
      context,
      update: {
        lastInteraction: timestamp,
        balance: senderBalance,
      },
    }),
  ]);

  const poolAddress = tokenData.pool;

  if (poolAddress && assetData) {
    await Promise.all([
      updatePool({
        poolAddress,
        context,
        update: {
          holderCount: tokenData.holderCount + holderCountDelta,
        },
      }),
      updateZoraAsset({
        assetAddress: tokenAddress,
        context,
        update: {
          holderCount: assetData.holderCount + holderCountDelta,
        },
      }),
    ]);
  }
});