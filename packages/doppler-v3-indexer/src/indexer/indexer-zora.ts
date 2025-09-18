import { ponder } from "ponder:registry";
import { updateToken } from "./shared/entities/token";
import { upsertTokenWithPool } from "./shared/entities/token-optimized";
import {
  updatePool,
} from "./shared/entities/pool";
import { fetchEthPrice, fetchZoraPrice } from "./shared/oracle";
import { batchUpsertUsersAndAssets, batchUpdateHolderCounts } from "./shared/entities/user-optimized";
import { handleOptimizedSwap } from "./shared/swap-optimizer";

import { zeroAddress } from "viem";
import { computeV3Price } from "@app/utils";
import { chainConfigs } from "@app/config";
import { token, pool } from "ponder:schema";
import { insertZoraPoolV4Optimized } from "./shared/entities/zora/pool";

ponder.on("ZoraFactory:CoinCreatedV4", async ({ event, context }) => {
  const { db, chain } = context;
  const { coin, currency, poolKey, poolKeyHash, caller } = event.args;
  const timestamp = event.block.timestamp;

  const poolAddress = poolKeyHash.toLowerCase() as `0x${string}`;
  const coinAddress = coin.toLowerCase() as `0x${string}`;
  const currencyAddress = currency.toLowerCase() as `0x${string}`;
  const callerId = caller.toLowerCase() as `0x${string}`;

  const [zoraPrice, ethPrice] = await Promise.all([
    fetchZoraPrice(timestamp, context),
    fetchEthPrice(timestamp, context),
  ]);


  const isQuoteZora = currency != zeroAddress && currency.toLowerCase() === chainConfigs[context.chain.name].addresses.zora.zoraToken.toLowerCase();
  const isQuoteEth = currency === zeroAddress || currency.toLowerCase() === chainConfigs[context.chain.name].addresses.shared.weth.toLowerCase();

  let isQuoteCreatorCoin = false;
  let creatorCoinPid = null;
  if (!isQuoteZora && !isQuoteEth) {
      const creatorCoinEntity = await db.find(token, {
        address: currencyAddress,
        chainId: chain.id,
      });

      isQuoteCreatorCoin = creatorCoinEntity?.isCreatorCoin ?? false;
      creatorCoinPid = isQuoteCreatorCoin ? creatorCoinEntity?.pool : null;
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
      chainId: chain.id,
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

  // Optimized parallel operations with single upsert for tokens
  const [assetTokenEntity] = await Promise.all([
    upsertTokenWithPool({
      tokenAddress: coinAddress,
      isDerc20: false,
      isCreatorCoin: false,
      isContentCoin: true,
      poolAddress,
      context,
      creatorCoinPid: creatorCoinPid ?? null,
      creatorAddress: callerId,
      timestamp,
    }),
    upsertTokenWithPool({
      tokenAddress: currencyAddress,
      isDerc20: false,
      isCreatorCoin: false,
      isContentCoin: false,
      poolAddress: null,
      context,
      creatorCoinPid: creatorCoinPid ?? null,
      creatorAddress: callerId,
      timestamp,
    }),
  ]);

  const { totalSupply } = assetTokenEntity;

  await insertZoraPoolV4Optimized({
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
    totalSupply
  });
});

ponder.on("ZoraFactory:CreatorCoinCreated", async ({ event, context }) => {
  const { coin, currency, poolKey, poolKeyHash, caller } = event.args;
  const timestamp = event.block.timestamp;

  const poolAddress = poolKeyHash.toLowerCase() as `0x${string}`;
  const coinAddress = coin.toLowerCase() as `0x${string}`;
  const currencyAddress = currency.toLowerCase() as `0x${string}`;
  const callerId = caller.toLowerCase() as `0x${string}`;

  const [zoraPrice, ethPrice] = await Promise.all([
    fetchZoraPrice(timestamp, context),
    fetchEthPrice(timestamp, context),
  ]);

  const isQuoteZora = currency != zeroAddress && currency.toLowerCase() === chainConfigs[context.chain.name].addresses.zora.zoraToken.toLowerCase();
  const isQuoteEth = currency === zeroAddress || currency.toLowerCase() === chainConfigs[context.chain.name].addresses.shared.weth.toLowerCase();

  let usdPrice;
  if (isQuoteZora) {
    usdPrice = zoraPrice;
  } else if (isQuoteEth) {
    usdPrice = ethPrice;
  }

  if (!usdPrice) {
    return;
  }

  // Optimized parallel operations with single upsert for tokens
  const [assetTokenEntity] = await Promise.all([
    upsertTokenWithPool({
      tokenAddress: coinAddress,
      isDerc20: true,
      isCreatorCoin: true,
      isContentCoin: false,
      poolAddress,
      context,
      creatorCoinPid: null,
      creatorAddress: callerId,
      timestamp,
    }),
    upsertTokenWithPool({
      tokenAddress: currencyAddress,
      isDerc20: false,
      isCreatorCoin: false,
      isContentCoin: false,
      poolAddress: null,
      context,
      creatorAddress: callerId,
      creatorCoinPid: null,
      timestamp,
    }),
  ]);

  const { totalSupply } = assetTokenEntity;
  await insertZoraPoolV4Optimized({
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
    totalSupply,
  });
});

ponder.on("ZoraV4Hook:Swapped", async ({ event, context }) => {
  const { poolKeyHash, swapSender, amount0, amount1, sqrtPriceX96, isCoinBuy } = event.args;
  const timestamp = event.block.timestamp;

  await handleOptimizedSwap(
    {
      poolAddress: poolKeyHash,
      swapSender,
      amount0,
      amount1,
      sqrtPriceX96,
      isCoinBuy,
      timestamp,
      transactionHash: event.transaction.hash,
      transactionFrom: event.transaction.from,
      blockNumber: event.block.number,
      context,
    },
    true,
  );
});

ponder.on("ZoraV4CreatorCoinHook:Swapped", async ({ event, context }) => {
  const { poolKeyHash, swapSender, amount0, amount1, sqrtPriceX96, isCoinBuy } = event.args;
  const timestamp = event.block.timestamp;

  await handleOptimizedSwap(
    {
      poolAddress: poolKeyHash,
      swapSender,
      amount0,
      amount1,
      sqrtPriceX96,
      isCoinBuy,
      timestamp,
      transactionHash: event.transaction.hash,
      transactionFrom: event.transaction.from,
      blockNumber: event.block.number,
      context,
    },
    true,
  );
});

ponder.on("ZoraCreatorCoinV4:LiquidityMigrated", async ({ event, context }) => {
  const { chain, db } = context;
  const { fromPoolKeyHash, toPoolKey, toPoolKeyHash } = event.args;
  const timestamp = event.block.timestamp;

  const fromPoolAddress = fromPoolKeyHash;
  const toPoolAddress = toPoolKeyHash;

  const fromPoolEntity = await db.find(pool, {
    address: fromPoolAddress,
    chainId: chain.id,
  });

  if (!fromPoolEntity) {
    return;
  }

  const baseTokenEntity = await db.find(token, {
    address: fromPoolEntity.baseToken,
    chainId: chain.id,
  });

  if (!baseTokenEntity) {
    return;
  }

  const totalSupply = baseTokenEntity.totalSupply;

  const zoraPrice = await fetchZoraPrice(timestamp, context);
  const ethPrice = await fetchEthPrice(timestamp, context);

  const isQuoteZora = fromPoolEntity.quoteToken.toLowerCase() === chainConfigs[context.chain.name].addresses.zora.zoraToken.toLowerCase();
  const isQuoteEth = fromPoolEntity.quoteToken.toLowerCase() === chainConfigs[context.chain.name].addresses.shared.weth.toLowerCase();

  await Promise.all([
    insertZoraPoolV4Optimized({
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
      totalSupply,
    }),
    updateToken({
      tokenAddress: fromPoolEntity.baseToken,
      context,
      update: {
        pool: toPoolAddress,
      },
    }),
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
    chainId: chain.id,
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

  // Batch fetch token and asset data
  const tokenData = await db.find(token, { address: tokenAddress, chainId: chain.id });

  // Ensure token exists (upsert if needed)
  const finalTokenData = tokenData || await upsertTokenWithPool({
    tokenAddress,
    isDerc20: true,
    isCreatorCoin: true,
    isContentCoin: false,
    poolAddress: null,
    context,
    creatorCoinPid: null,
    creatorAddress,
    timestamp,
  });

  // Batch upsert users and assets, get holder count delta
  const { holderCountDelta } = await batchUpsertUsersAndAssets({
    senderAddress,
    recipientAddress,
    tokenAddress,
    senderBalance,
    recipientBalance,
    timestamp,
    context,
  });

  // Batch update holder counts across all entities
  if (holderCountDelta !== 0) {
    await batchUpdateHolderCounts({
      tokenAddress,
      poolAddress: finalTokenData.pool,
      holderCountDelta,
      currentTokenHolderCount: finalTokenData.holderCount,
      context,
    });
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

  // Batch fetch token and asset data
  const tokenData = await db.find(token, { address: tokenAddress, chainId: chain.id });

  // Ensure token exists (upsert if needed)
  const finalTokenData = tokenData || await upsertTokenWithPool({
    tokenAddress,
    isDerc20: false,
    isCreatorCoin: false,
    isContentCoin: true,
    poolAddress: null,
    context,
    creatorCoinPid: null,
    creatorAddress,
    timestamp,
  });

  // Batch upsert users and assets, get holder count delta
  const { holderCountDelta } = await batchUpsertUsersAndAssets({
    senderAddress,
    recipientAddress,
    tokenAddress,
    senderBalance,
    recipientBalance,
    timestamp,
    context,
  });

  // Batch update holder counts across all entities
  if (holderCountDelta !== 0) {
    await batchUpdateHolderCounts({
      tokenAddress,
      poolAddress: finalTokenData.pool,
      holderCountDelta,
      currentTokenHolderCount: finalTokenData.holderCount,
      context,
    });
  }
});