import { ponder } from "ponder:registry";
import { token, userAsset, user, ethPrice } from "ponder.schema";
import { configs } from "addresses";
import { ChainlinkOracleABI } from "@app/abis/ChainlinkOracleABI";
import { updateAsset } from "./shared/entities/asset";
import { insertTokenIfNotExists } from "./shared/entities/token";
import { insertV2PoolIfNotExists } from "./shared/entities/v2Pool";
import { updateUserAsset } from "./shared/entities/userAsset";
import { insertUserAssetIfNotExists } from "./shared/entities/userAsset";
import { DERC20ABI } from "@app/abis/DERC20ABI";
ponder.on("Airlock:Migrate", async ({ event, context }) => {
  const { timestamp } = event.block;
  const { asset: assetId, pool: poolId } = event.args;

  await insertV2PoolIfNotExists({
    assetAddress: assetId,
    poolAddress: poolId,
    timestamp,
    context,
  });

  await updateAsset({
    assetAddress: assetId,
    context,
    update: {
      migratedAt: timestamp,
      migrated: true,
    },
  });
});

ponder.on("DERC20:Transfer", async ({ event, context }) => {
  const { db, client, network } = context;
  const { address } = event.log;
  const { timestamp } = event.block;
  const { from, to } = event.args;

  const tokenData = await insertTokenIfNotExists({
    tokenAddress: address,
    timestamp,
    context,
    isDerc20: true,
  });

  await db
    .insert(user)
    .values({
      address: to.toLowerCase() as `0x${string}`,
      chainId: BigInt(network.chainId),
      createdAt: timestamp,
      lastSeenAt: timestamp,
    })
    .onConflictDoUpdate((_) => ({
      lastSeenAt: timestamp,
    }));

  await db
    .insert(user)
    .values({
      address: from.toLowerCase() as `0x${string}`,
      chainId: BigInt(network.chainId),
      createdAt: timestamp,
      lastSeenAt: timestamp,
    })
    .onConflictDoUpdate((_) => ({
      lastSeenAt: timestamp,
    }));

  const fromUserBalanceEndBalance = await client.readContract({
    abi: DERC20ABI,
    address: address,
    functionName: "balanceOf",
    args: [from],
  });

  const toUserBalanceEndBalance = await client.readContract({
    abi: DERC20ABI,
    address: address,
    functionName: "balanceOf",
    args: [to],
  });

  const toUserAsset = await insertUserAssetIfNotExists({
    userId: to.toLowerCase() as `0x${string}`,
    assetId: address.toLowerCase() as `0x${string}`,
    timestamp,
    context,
  });

  await updateUserAsset({
    userId: to.toLowerCase() as `0x${string}`,
    assetId: address.toLowerCase() as `0x${string}`,
    context,
    update: {
      balance: toUserBalanceEndBalance,
      lastInteraction: timestamp,
    },
  });

  const fromUserAsset = await insertUserAssetIfNotExists({
    userId: from.toLowerCase() as `0x${string}`,
    assetId: address.toLowerCase() as `0x${string}`,
    timestamp,
    context,
  });

  await updateUserAsset({
    userId: from.toLowerCase() as `0x${string}`,
    assetId: address.toLowerCase() as `0x${string}`,
    context,
    update: {
      lastInteraction: timestamp,
      balance: fromUserBalanceEndBalance,
    },
  });

  let holderCountDelta = 0;
  if (toUserAsset.balance == 0n && toUserBalanceEndBalance > 0n) {
    holderCountDelta += 1;
  }
  if (fromUserAsset.balance > 0n && fromUserBalanceEndBalance == 0n) {
    holderCountDelta -= 1;
  }

  await db.update(token, { address: address }).set({
    holderCount: tokenData.holderCount + holderCountDelta,
  });
});

ponder.on("ChainlinkEthPriceFeed:block", async ({ event, context }) => {
  const { db, client, network } = context;
  const { timestamp } = event.block;

  const latestAnswer = await client.readContract({
    abi: ChainlinkOracleABI,
    address: configs[network.name].oracle.chainlinkEth,
    functionName: "latestAnswer",
  });

  const price = latestAnswer;

  await db
    .insert(ethPrice)
    .values({
      timestamp: timestamp,
      price: price,
    })
    .onConflictDoNothing();
});
