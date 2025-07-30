import { ponder } from "ponder:registry";
import {
  insertPositionIfNotExists,
  updatePosition,
} from "./shared/entities/position";
import { insertTokenIfNotExists, updateToken } from "./shared/entities/token";
import {
  fetchExistingPool,
  updatePool,
} from "./shared/entities/pool";
import { updateAsset } from "./shared/entities/asset";
import { computeDollarLiquidity } from "@app/utils/computeDollarLiquidity";
import { computeMarketCap, fetchEthPrice, fetchZoraPrice } from "./shared/oracle";
import {
  insertActivePoolsBlobIfNotExists,
} from "./shared/scheduledJobs";
import { CHAINLINK_ETH_DECIMALS } from "@app/utils/constants";
import { SwapOrchestrator, SwapService, PriceService } from "@app/core";
import { insertUserIfNotExists } from "./shared/entities/user";
import { insertUserAssetIfNotExists, updateUserAsset } from "./shared/entities/userAsset";
import { asset, pool } from "ponder:schema";
import { insertZoraAssetIfNotExists, updateZoraAsset } from "./shared/entities/zora/asset";
import { insertZoraPoolIfNotExists, insertZoraPoolV4IfNotExists } from "./shared/entities/zora/pool";
import { Address, zeroAddress } from "viem";
import { computeV3Price } from "@app/utils";
import { chainConfigs } from "@app/config";

// ponder.on("ZoraFactory:CoinCreated", async ({ event, context }) => {
//   const { pool, coin, currency, caller } = event.args;
//   const timestamp = event.block.timestamp;

//   const numeraireId = currency.toLowerCase() as `0x${string}`;

//   const isToken0 = coin.toLowerCase() < currency.toLowerCase();

//   let quotePrice;
//   if (numeraireId === chainConfigs.base.addresses.stables?.usdc) {
//     quotePrice = 10n ** 8n;
//   } else {
//     quotePrice = await fetchEthPrice(timestamp, context);
//   }

//   const [poolEntity, assetTokenEntity] = await Promise.all([
//     insertZoraPoolIfNotExists({
//       poolAddress: pool,
//       context,
//       timestamp,
//     }),
//     insertTokenIfNotExists({
//       tokenAddress: coin,
//       creatorAddress: caller,
//       timestamp,
//       context,
//     }),
//     insertTokenIfNotExists({
//       tokenAddress: numeraireId,
//       creatorAddress: caller,
//       timestamp,
//       context,
//       isDerc20: false,
//     }),
//     insertZoraAssetIfNotExists({
//       assetAddress: coin,
//       poolAddress: pool,
//       numeraireAddress: currency,
//       timestamp,
//       context,
//     }),
//   ]);

//   const price = computeV3Price({
//     sqrtPriceX96: poolEntity.sqrtPrice,
//     isToken0,
//     decimals: 18,
//   });

//   const { totalSupply } = assetTokenEntity;
//   const marketCapUsd = computeMarketCap({
//     price,
//     ethPrice: quotePrice,
//     totalSupply,
//   });

//   const liquidityUsd = computeDollarLiquidity({
//     assetBalance: isToken0 ? poolEntity.reserves0 : poolEntity.reserves1,
//     quoteBalance: isToken0 ? poolEntity.reserves1 : poolEntity.reserves0,
//     price,
//     ethPrice: quotePrice,
//   });

//   await updatePool({
//     poolAddress: pool,
//     context,
//     update: {
//       price,
//       isToken0,
//       asset: coin,
//       baseToken: coin,
//       quoteToken: currency,
//       marketCapUsd,
//       dollarLiquidity: liquidityUsd,
//       isQuoteEth: currency === chainConfigs.base.addresses.shared.weth,
//     }
//   })
// });

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
  const { coin, currency, poolKey, poolKeyHash, caller } = event.args;
  const timestamp = event.block.timestamp;

  const poolAddress = poolKeyHash as `0x${string}`;
  const numeraireId = currency.toLowerCase() as `0x${string}`;

  const zoraPrice = await fetchZoraPrice(timestamp, context);

  const isQuoteZora = currency != zeroAddress && currency === chainConfigs[context.chain.name].addresses.zora.zoraToken;

  const [poolEntity, assetTokenEntity] = await Promise.all([
    insertZoraPoolV4IfNotExists({
      poolAddress,
      context,
      timestamp,
      ethPrice: zoraPrice,
      poolKey,
      baseToken: coin,
      quoteToken: currency,
      isQuoteZora,
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
    ethPrice: zoraPrice,
    totalSupply,
  });

  await Promise.all([
    insertZoraAssetIfNotExists({
      assetAddress: coin,
      poolAddress,
      numeraireAddress: currency,
      timestamp,
      context,
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

ponder.on("ZoraUniswapV3Pool:Swap", async ({ event, context }) => {
  const { chain } = context;
  const address = event.log.address.toLowerCase() as `0x${string}`;
  const timestamp = event.block.timestamp;
  const { amount0, amount1, sqrtPriceX96 } = event.args;
  const chainId = BigInt(chain.id);

  const ethPrice = await fetchEthPrice(timestamp, context);

  const {
    isToken0,
    baseToken,
    quoteToken,
    reserves0,
    reserves1,
    fee,
    totalFee0,
    totalFee1,
  } = await insertZoraPoolIfNotExists({
    poolAddress: address,
    timestamp,
    context,
  });

  if (baseToken === zeroAddress || quoteToken === zeroAddress) {
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

  const swapValueUsd =
    ((reserveQuoteDelta < 0n ? -reserveQuoteDelta : reserveQuoteDelta) *
      ethPrice) /
    CHAINLINK_ETH_DECIMALS;


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
    percentDayChange: 0,
  };

  // Define entity updaters
  const entityUpdaters = {
    updatePool,
    updateAsset,
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
        lastRefreshed: timestamp,
        reserves0: reserves0 + amount0,
        reserves1: reserves1 + amount1,
        marketCapUsd,
      },
    }),
  ]);
});

ponder.on("ZoraV4Hook:Swapped", async ({ event, context }) => {
  const { sender, poolKeyHash, swapSender, key, params, amount0, amount1, sqrtPriceX96 } = event.args;
  const timestamp = event.block.timestamp;

  const poolAddress = poolKeyHash as `0x${string}`;
  const zoraPrice = await fetchZoraPrice(timestamp, context);

  const poolEntity = await context.db.find(pool, {
    address: poolAddress,
    chainId: BigInt(context.chain.id),
  });


  if (!poolEntity) {
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

  const dollarLiquidity = computeDollarLiquidity({
    assetBalance: nextReservesAsset,
    quoteBalance: nextReservesQuote,
    price,
    ethPrice: zoraPrice,
    decimals: 18,
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
    ethPrice: zoraPrice,
    totalSupply,
    decimals: 18,
  });

  const swapValueUsd =
    ((reserveQuoteDelta < 0n ? -reserveQuoteDelta : reserveQuoteDelta) *
      zoraPrice) /
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
    ethPriceUSD: zoraPrice,
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
        reserves0: reserves0 + amount0,
        reserves1: reserves1 + amount1,
        marketCapUsd,
      },
    }),
  ]);
});

ponder.on("ZoraCoinV4:CoinTransfer", async ({ event, context }) => {
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
