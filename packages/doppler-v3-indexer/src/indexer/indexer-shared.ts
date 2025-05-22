import { ponder } from "ponder:registry";
import { pool, user } from "ponder.schema";
import { insertAssetIfNotExists, updateAsset } from "./shared/entities/asset";
import { insertTokenIfNotExists, updateToken } from "./shared/entities/token";
import { insertV2PoolIfNotExists } from "./shared/entities/v2Pool";
import { updateUserAsset } from "./shared/entities/userAsset";
import { insertUserAssetIfNotExists } from "./shared/entities/userAsset";
import { insertUserIfNotExists, updateUser } from "./shared/entities/user";
import { updatePool } from "./shared/entities/pool";

ponder.on("Airlock:Migrate", async ({ event, context }) => {
  const { timestamp } = event.block;
  const assetId = event.args.asset.toLowerCase() as `0x${string}`;

  await insertV2PoolIfNotExists({
    assetAddress: assetId,
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
  const { address } = event.log;
  const { timestamp } = event.block;
  const { from, to, value } = event.args;

  const { db, network } = context;

  const creatorAddress = event.transaction.from;

  const fromId = from.toLowerCase() as `0x${string}`;
  const toId = to.toLowerCase() as `0x${string}`;
  const assetId = address.toLowerCase() as `0x${string}`;

  const tokenData = await insertTokenIfNotExists({
    tokenAddress: assetId,
    creatorAddress,
    timestamp,
    context,
    isDerc20: true,
  });

  const assetData = await insertAssetIfNotExists({
    assetAddress: assetId,
    timestamp,
    context,
  });

  await insertUserIfNotExists({
    userId: toId,
    timestamp,
    context,
  });

  const fromUser = await insertUserIfNotExists({
    userId: fromId,
    timestamp,
    context,
  });

  if (fromUser.lastSeenAt != timestamp) {
    await updateUser({
      userId: fromId,
      context,
      update: {
        lastSeenAt: timestamp,
      },
    });
  }

  const toUserAsset = await insertUserAssetIfNotExists({
    userId: toId,
    assetId: assetId,
    timestamp,
    context,
  });

  await updateUserAsset({
    userId: toId,
    assetId: assetId,
    context,
    update: {
      balance: toUserAsset.balance + value,
      lastInteraction: timestamp,
    },
  });

  const fromUserAsset = await insertUserAssetIfNotExists({
    userId: fromId,
    assetId: assetId,
    timestamp,
    context,
  });

  await updateUserAsset({
    userId: fromId,
    assetId: assetId,
    context,
    update: {
      lastInteraction: timestamp,
      balance: fromUserAsset.balance - value,
    },
  });

  let holderCountDelta = 0;
  if (toUserAsset.balance == 0n && toUserAsset.balance + value > 0n) {
    holderCountDelta += 1;
  }
  if (fromUserAsset.balance > 0n && fromUserAsset.balance - value == 0n) {
    holderCountDelta -= 1;
  }

  await updateToken({
    tokenAddress: assetId,
    context,
    update: {
      holderCount: tokenData.holderCount + holderCountDelta,
    },
  });

  await updateAsset({
    assetAddress: assetId,
    context,
    update: {
      holderCount: assetData.holderCount + holderCountDelta,
    },
  });

  const poolEntity = await db.find(pool, {
    address: assetData.poolAddress,
    chainId: BigInt(network.chainId),
  });

  if (poolEntity) {
    await updatePool({
      poolAddress: assetData.poolAddress,
      context,
      update: {
        holderCount: tokenData.holderCount + holderCountDelta,
      },
    });
  }
});

ponder.on("V4DERC20:Transfer", async ({ event, context }) => {
  const { address } = event.log;
  const { timestamp } = event.block;
  const { from, to, value } = event.args;
  const { db, network } = context;

  const creatorAddress = event.transaction.from;

  const fromId = from.toLowerCase() as `0x${string}`;
  const toId = to.toLowerCase() as `0x${string}`;
  const assetId = address.toLowerCase() as `0x${string}`;

  const tokenData = await insertTokenIfNotExists({
    tokenAddress: assetId,
    creatorAddress,
    timestamp,
    context,
    isDerc20: true,
  });

  const assetData = await insertAssetIfNotExists({
    assetAddress: assetId,
    timestamp,
    context,
  });

  await insertUserIfNotExists({
    userId: toId,
    timestamp,
    context,
  });

  const fromUser = await insertUserIfNotExists({
    userId: fromId,
    timestamp,
    context,
  });

  if (fromUser.lastSeenAt != timestamp) {
    await updateUser({
      userId: fromId,
      context,
      update: {
        lastSeenAt: timestamp,
      },
    });
  }

  const toUserAsset = await insertUserAssetIfNotExists({
    userId: toId,
    assetId: assetId,
    timestamp,
    context,
  });

  await updateUserAsset({
    userId: toId,
    assetId: assetId,
    context,
    update: {
      balance: toUserAsset.balance + value,
      lastInteraction: timestamp,
    },
  });

  const fromUserAsset = await insertUserAssetIfNotExists({
    userId: fromId,
    assetId: assetId,
    timestamp,
    context,
  });

  await updateUserAsset({
    userId: fromId,
    assetId: assetId,
    context,
    update: {
      lastInteraction: timestamp,
      balance: fromUserAsset.balance - value,
    },
  });

  let holderCountDelta = 0;
  if (toUserAsset.balance == 0n && toUserAsset.balance + value > 0n) {
    holderCountDelta += 1;
  }
  if (fromUserAsset.balance > 0n && fromUserAsset.balance - value == 0n) {
    holderCountDelta -= 1;
  }

  await updateToken({
    tokenAddress: assetId,
    context,
    update: {
      holderCount: tokenData.holderCount + holderCountDelta,
    },
  });

  await updateAsset({
    assetAddress: assetId,
    context,
    update: {
      holderCount: assetData.holderCount + holderCountDelta,
    },
  });

  const poolEntity = await db.find(pool, {
    address: assetData.poolAddress,
    chainId: BigInt(network.chainId),
  });

  if (poolEntity) {
    await updatePool({
      poolAddress: assetData.poolAddress,
      context,
      update: {
        holderCount: tokenData.holderCount + holderCountDelta,
      },
    });
  }
});
