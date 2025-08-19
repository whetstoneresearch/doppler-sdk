import { ponder } from "ponder:registry";
import { pool, token } from "ponder:schema";
import { insertTokenIfNotExists, updateToken } from "./shared/entities/token";
import { insertV2MigrationPoolIfNotExists } from "./shared/entities/v2Pool";
import { updateUserToken, insertUserTokenIfNotExists } from "./shared/entities/userToken";
import { insertUserIfNotExists, updateUser } from "./shared/entities/user";
import { updatePool } from "./shared/entities/pool";
import { chainConfigs } from "@app/config";
import { insertV3MigrationPoolIfNotExists } from "./shared/entities/migrationPool";
import { zeroAddress } from "viem";

ponder.on("Airlock:Migrate", async ({ event, context }) => {
  const { chain } = context;
  const { timestamp } = event.block;
  const assetId = event.args.asset.toLowerCase() as `0x${string}`;
  const v2Migrator = chainConfigs[chain.name].addresses.v2.v2Migrator;

  const tokenEntity = await context.db.find(token, {
    address: assetId,
  });

  if (!tokenEntity) {
    return;
  }

  const poolEntity = await context.db.find(pool, {
    address: tokenEntity!.pool!,
    chainId: BigInt(chain.id),
  });

  if (!poolEntity) {
    return;
  }

  if (poolEntity.liquidityMigrator?.toLowerCase() == v2Migrator.toLowerCase()) {
    const v2Pool = await insertV2MigrationPoolIfNotExists({
      assetAddress: assetId,
      timestamp,
      context,
    });

    await Promise.all([
      updatePool({
        poolAddress: v2Pool.parentPool,
        context,
        update: {
          migratedAt: timestamp,
          migrated: true,
        },
      }),
    ]);
  }
});

ponder.on("UniswapV3Migrator:Migrate", async ({ event, context }) => {
  const { chain } = context;
  const { timestamp } = event.block;
  const { pool, token0, token1 } = event.args;

  const poolAddress = pool.toLowerCase() as `0x${string}`;
  const token0Address = token0.toLowerCase() as `0x${string}`;
  const token1Address = token1.toLowerCase() as `0x${string}`;

  let isToken0 = false;

  if (
    token0Address.toLowerCase() == zeroAddress ||
    token0Address.toLowerCase() ==
    chainConfigs[chain.name].addresses.shared.weth
  ) {
    isToken0 = false;
  } else {
    const tokenCheck = await context.db.find(token, {
      address: token0Address,
    });
    if (tokenCheck) {
      isToken0 = true;
    } else {
      isToken0 = false;
    }
  }

  const tokenEntity = await context.db.find(token, {
    address: isToken0 ? token0Address : token1Address,
  });

  await insertV3MigrationPoolIfNotExists({
    poolAddress,
    parentPool: tokenEntity!.pool!,
    timestamp,
    context,
  });

  await Promise.all([
    updatePool({
      poolAddress: tokenEntity!.pool!,
      context,
      update: {
        migratedAt: timestamp,
        migrated: true,
        migrationType: "v3",
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

  const [tokenData, fromUser, toUserAsset, fromUserAsset] =
    await Promise.all([
      insertTokenIfNotExists({
        tokenAddress: assetId,
        creatorAddress,
        timestamp,
        context,
        isDerc20: true,
      }),
      insertUserIfNotExists({
        userId: fromId,
        timestamp,
        context,
      }),
      insertUserTokenIfNotExists({
        userId: toId,
        assetId: assetId,
        timestamp,
        context,
      }),
      insertUserTokenIfNotExists({
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
      address: tokenData.pool!,
      chainId: BigInt(chain.id),
    }),
    updateToken({
      tokenAddress: assetId,
      context,
      update: {
        holderCount: tokenData.holderCount + holderCountDelta,
      },
    }),
    updateUserToken({
      userId: toId,
      assetId: assetId,
      context,
      update: {
        balance: toUserAsset.balance + value,
        lastInteraction: timestamp,
      },
    }),
    updateUserToken({
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
      poolAddress: tokenData.pool!,
      context,
      update: {
        holderCount: tokenData.holderCount + holderCountDelta,
      },
    });
  }
});
