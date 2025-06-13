import { ponder } from "ponder:registry";
import { pool } from "ponder.schema";
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

  const v2Pool = await insertV2PoolIfNotExists({
    assetAddress: assetId,
    timestamp,
    context,
  });

  await Promise.all([
    updateAsset({
      assetAddress: assetId,
      context,
      update: {
        migratedAt: timestamp,
        migrated: true,
      },
    }),
    updatePool({
      poolAddress: v2Pool.parentPool,
      context,
      update: {
        migratedAt: timestamp,
        migrated: true,
      },
    }),
  ]);
});

ponder.on("DERC20:Transfer", async ({ event, context }) => {
  const { address } = event.log;
  const { timestamp } = event.block;
  const { from, to, value } = event.args;

  const { db, chain } = context;

  const creatorAddress = event.transaction.from;

  const fromId = from.toLowerCase() as `0x${string}`;
  const toId = to.toLowerCase() as `0x${string}`;
  const assetId = address.toLowerCase() as `0x${string}`;

  const [tokenData, assetData, fromUser, toUserAsset, fromUserAsset] = await Promise.all([
    insertTokenIfNotExists({
      tokenAddress: assetId,
      creatorAddress,
      timestamp,
      context,
      isDerc20: true,
    }),
    insertAssetIfNotExists({
      assetAddress: assetId,
      timestamp,
      context,
    }),
    insertUserIfNotExists({
      userId: fromId,
      timestamp,
      context,
    }),
    insertUserAssetIfNotExists({
      userId: toId,
      assetId: assetId,
      timestamp,
      context,
    }),
    insertUserAssetIfNotExists({
      userId: fromId,
      assetId: assetId,
      timestamp,
      context,
    }),
    insertUserIfNotExists({
      userId: toId,
      timestamp,
      context,
    }),
  ]);

  if (fromUser.lastSeenAt != timestamp) {
    await updateUser({
      userId: fromId,
      context,
      update: {
        lastSeenAt: timestamp,
      },
    });
  }

  let holderCountDelta = 0;
  if (toUserAsset.balance == 0n && toUserAsset.balance + value > 0n) {
    holderCountDelta += 1;
  }
  if (fromUserAsset.balance > 0n && fromUserAsset.balance - value == 0n) {
    holderCountDelta -= 1;
  }

  const [poolEntity] = await Promise.all([
    db.find(pool, {
      address: assetData.poolAddress,
      chainId: BigInt(chain.id),
    }),
    updateToken({
      tokenAddress: assetId,
      context,
      update: {
        holderCount: tokenData.holderCount + holderCountDelta,
      },
    }),
    updateAsset({
      assetAddress: assetId,
      context,
      update: {
        holderCount: assetData.holderCount + holderCountDelta,
      },
    }),
    updateUserAsset({
      userId: toId,
      assetId: assetId,
      context,
      update: {
        balance: toUserAsset.balance + value,
        lastInteraction: timestamp,
      },
    }),
    updateUserAsset({
      userId: fromId,
      assetId: assetId,
      context,
      update: {
        lastInteraction: timestamp,
        balance: fromUserAsset.balance - value,
      },
    }),
  ]);

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
  const { db, chain } = context;

  const creatorAddress = event.transaction.from;

  const fromId = from.toLowerCase() as `0x${string}`;
  const toId = to.toLowerCase() as `0x${string}`;
  const assetId = address.toLowerCase() as `0x${string}`;

  const [tokenData, assetData, fromUser, toUserAsset, fromUserAsset] = await Promise.all([
    insertTokenIfNotExists({
      tokenAddress: assetId,
      creatorAddress,
      timestamp,
      context,
      isDerc20: true,
    }),
    insertAssetIfNotExists({
      assetAddress: assetId,
      timestamp,
      context,
    }),
    insertUserIfNotExists({
      userId: fromId,
      timestamp,
      context,
    }),
    insertUserAssetIfNotExists({
      userId: toId,
      assetId: assetId,
      timestamp,
      context,
    }),
    insertUserAssetIfNotExists({
      userId: fromId,
      assetId: assetId,
      timestamp,
      context,
    }),
    insertUserIfNotExists({
      userId: toId,
      timestamp,
      context,
    }),
  ])

  if (fromUser.lastSeenAt != timestamp) {
    await updateUser({
      userId: fromId,
      context,
      update: {
        lastSeenAt: timestamp,
      },
    });
  }

  let holderCountDelta = 0;
  if (toUserAsset.balance == 0n && toUserAsset.balance + value > 0n) {
    holderCountDelta += 1;
  }
  if (fromUserAsset.balance > 0n && fromUserAsset.balance - value == 0n) {
    holderCountDelta -= 1;
  }

  const [poolEntity] = await Promise.all([
    db.find(pool, {
      address: assetData.poolAddress,
      chainId: BigInt(chain.id),
    }),
    updateUserAsset({
      userId: toId,
      assetId: assetId,
      context,
      update: {
        balance: toUserAsset.balance + value,
        lastInteraction: timestamp,
      },
    }),
    updateUserAsset({
      userId: fromId,
      assetId: assetId,
      context,
      update: {
        lastInteraction: timestamp,
        balance: fromUserAsset.balance - value,
      },
    }),
    updateToken({
      tokenAddress: assetId,
      context,
      update: {
        holderCount: tokenData.holderCount + holderCountDelta,
      },
    }),
    updateAsset({
      assetAddress: assetId,
      context,
      update: {
        holderCount: assetData.holderCount + holderCountDelta,
      },
    }),
  ])

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

ponder.on("V4DERC20_2:Transfer", async ({ event, context }) => {
  const { address } = event.log;
  const { timestamp } = event.block;
  const { from, to, value } = event.args;
  const { db, chain } = context;

  const creatorAddress = event.transaction.from;

  const fromId = from.toLowerCase() as `0x${string}`;
  const toId = to.toLowerCase() as `0x${string}`;
  const assetId = address.toLowerCase() as `0x${string}`;

  const [tokenData, assetData, fromUser, toUserAsset, fromUserAsset] = await Promise.all([
    insertTokenIfNotExists({
      tokenAddress: assetId,
      creatorAddress,
      timestamp,
      context,
      isDerc20: true,
    }),
    insertAssetIfNotExists({
      assetAddress: assetId,
      timestamp,
      context,
    }),
    insertUserIfNotExists({
      userId: fromId,
      timestamp,
      context,
    }),
    insertUserAssetIfNotExists({
      userId: toId,
      assetId: assetId,
      timestamp,
      context,
    }),
    insertUserAssetIfNotExists({
      userId: fromId,
      assetId: assetId,
      timestamp,
      context,
    }),
    insertUserIfNotExists({
      userId: toId,
      timestamp,
      context,
    }),
  ])

  if (fromUser.lastSeenAt != timestamp) {
    await updateUser({
      userId: fromId,
      context,
      update: {
        lastSeenAt: timestamp,
      },
    });
  }

  let holderCountDelta = 0;
  if (toUserAsset.balance == 0n && toUserAsset.balance + value > 0n) {
    holderCountDelta += 1;
  }
  if (fromUserAsset.balance > 0n && fromUserAsset.balance - value == 0n) {
    holderCountDelta -= 1;
  }

  const [poolEntity] = await Promise.all([
    db.find(pool, {
      address: assetData.poolAddress,
      chainId: BigInt(chain.id),
    }),
    updateUserAsset({
      userId: toId,
      assetId: assetId,
      context,
      update: {
        balance: toUserAsset.balance + value,
        lastInteraction: timestamp,
      },
    }),
    updateUserAsset({
      userId: fromId,
      assetId: assetId,
      context,
      update: {
        lastInteraction: timestamp,
        balance: fromUserAsset.balance - value,
      },
    }),
    updateToken({
      tokenAddress: assetId,
      context,
      update: {
        holderCount: tokenData.holderCount + holderCountDelta,
      },
    }),
    updateAsset({
      assetAddress: assetId,
      context,
      update: {
        holderCount: assetData.holderCount + holderCountDelta,
      },
    }),
  ])

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
