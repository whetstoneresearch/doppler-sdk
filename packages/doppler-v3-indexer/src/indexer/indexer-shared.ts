import { ponder } from "ponder:registry";
import { asset, pool, v4pools } from "ponder:schema";
import { insertAssetIfNotExists, updateAsset } from "./shared/entities/asset";
import { insertTokenIfNotExists, updateToken } from "./shared/entities/token";
import { insertV2PoolIfNotExists } from "./shared/entities/v2Pool";
import { updateUserAsset } from "./shared/entities/userAsset";
import { insertUserAssetIfNotExists } from "./shared/entities/userAsset";
import { insertUserIfNotExists, updateUser } from "./shared/entities/user";
import { updatePool } from "./shared/entities/pool";
import { chainConfigs } from "../config/chains";
import { UniswapV2FactoryABI } from "../abis/UniswapV2Factory";

ponder.on("Airlock:Migrate", async ({ event, context }) => {
  const { chain } = context;
  const { timestamp } = event.block;
  const assetId = event.args.asset.toLowerCase() as `0x${string}`;
  const poolAddress = event.args.pool.toLowerCase() as `0x${string}`;

  const factoryAddress = chainConfigs[chain.name].addresses.v2.factory;

  const assetEntity = await context.db.find(asset, {
    address: assetId,
  });

  if (!assetEntity) {
    console.warn(`Asset ${assetId} not found`);
    return;
  }

  const numeraire = assetEntity.numeraire;

  const pair = await context.client.readContract({
    abi: UniswapV2FactoryABI,
    address: factoryAddress,
    functionName: "getPair",
    args: [assetId, numeraire],
  });

  // Check if this is a V4 migration (pool address is 0x0)
  if (pair != "0x0000000000000000000000000000000000000000") {
    // V2 Migration (existing logic)
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
          migratedToPool: poolAddress, // The V2 pool address
        },
      }),
    ]);
  }
  // V4 Migration
  // const { chain } = context;
  // if (!chain) {
  //   console.warn("Chain not available in context");
  //   return;
  // }

  // const chainConfig = chainConfigs[chain.name as keyof typeof chainConfigs];

  // if (!chainConfig || chainConfig.addresses.v4.v4Migrator === "0x0000000000000000000000000000000000000000") {
  //   console.warn(`V4 migrator not configured for chain ${chain.name}`);
  //   return;
  // }

  // // Get the asset to find the old pool and numeraire
  // const assetEntity = await insertAssetIfNotExists({
  //   assetAddress: assetId,
  //   timestamp,
  //   context,
  // });

  // const oldPoolAddress = assetEntity.poolAddress;
  // const numeraireAddress = assetEntity.numeraire;

  // // Determine token0 and token1 order for the V4 migrator mapping
  // const [token0, token1] = assetId < numeraireAddress
  //   ? [assetId, numeraireAddress]
  //   : [numeraireAddress, assetId];

  // try {
  //   // Query the V4 migrator to get the asset data
  //   const assetData = await context.client.readContract({
  //     address: chainConfig.addresses.v4.v4Migrator,
  //     abi: V4MigratorABI,
  //     functionName: 'getAssetData',
  //     args: [token0, token1],
  //   });

  //   const { poolKey } = assetData;

  //   // Calculate the pool ID from the pool key - this is the unique identifier for V4 pools
  //   const poolId = getPoolId(poolKey);

  //   // For V4 migrated pools, we can't use getV4PoolData because they don't have individual hook contracts
  //   // Instead, we'll create a basic pool entity with the migration information

  //   // Create a basic pool entity for the migrated V4 pool
  //   const { db, chain } = context;
  //   if (!chain) {
  //     console.warn("Chain not available in context");
  //     return;
  //   }

  //   // Check if v4pool already exists
  //   const existingV4Pool = await db.find(v4pools, {
  //     poolId: poolId.toLowerCase() as `0x${string}`,
  //     chainId: BigInt(chain.id),
  //   });

  //   if (!existingV4Pool) {
  //     // Extract basic information from the poolKey
  //     const isToken0First = poolKey.currency0.toLowerCase() < poolKey.currency1.toLowerCase();
  //     const baseToken = isToken0First ? poolKey.currency0 : poolKey.currency1;
  //     const quoteToken = isToken0First ? poolKey.currency1 : poolKey.currency0;

  //     // Create the v4pools entity
  //     await db.insert(v4pools).values({
  //       poolId: poolId.toLowerCase() as `0x${string}`,
  //       chainId: BigInt(chain.id),

  //       // PoolKey components
  //       currency0: poolKey.currency0.toLowerCase() as `0x${string}`,
  //       currency1: poolKey.currency1.toLowerCase() as `0x${string}`,
  //       fee: Number(poolKey.fee),
  //       tickSpacing: Number(poolKey.tickSpacing),
  //       hooks: poolKey.hooks.toLowerCase() as `0x${string}`,

  //       // Pool state (will be initialized by PoolManager:Initialize event)
  //       sqrtPriceX96: 0n,
  //       liquidity: 0n,
  //       tick: 0,

  //       // Token references
  //       baseToken: baseToken.toLowerCase() as `0x${string}`,
  //       quoteToken: quoteToken.toLowerCase() as `0x${string}`,
  //       asset: assetId,

  //       // Migration tracking
  //       migratedFromPool: oldPoolAddress,
  //       migratedAt: timestamp,
  //       migratorVersion: "v4",

  //       // Metrics (will be updated by swap events)
  //       price: 0n,
  //       volumeUsd: 0n,
  //       dollarLiquidity: 0n,
  //       totalFee0: 0n,
  //       totalFee1: 0n,
  //       reserves0: 0n,
  //       reserves1: 0n,

  //       // Timestamps
  //       createdAt: timestamp,
  //       lastRefreshed: timestamp,
  //       lastSwapTimestamp: null,

  //       // Price tracking
  //       percentDayChange: 0,

  //       // Relations
  //       dailyVolume: null,

  //       // Helper fields
  //       isToken0: assetId === baseToken.toLowerCase(),
  //       isQuoteEth: quoteToken.toLowerCase() === "0x0000000000000000000000000000000000000000" ||
  //         quoteToken.toLowerCase() === chainConfigs[chain.name as keyof typeof chainConfigs].addresses.shared.weth.toLowerCase(),
  // });
  // }

  //   // Update the old pool as migrated (store the V4 pool ID)
  //   await updatePool({
  //     poolAddress: oldPoolAddress,
  //     context,
  //     update: {
  //       migratedAt: timestamp,
  //       migrated: true,
  //       migratedToV4PoolId: poolId.toLowerCase() as `0x${string}`, // Store the 32-byte pool ID
  //     },
  //   });

  //   // Update the asset as migrated
  //   await updateAsset({
  //     assetAddress: assetId,
  //     context,
  //     update: {
  //       migratedAt: timestamp,
  //       migrated: true,
  //       // Note: We keep poolAddress pointing to the original pool
  //       // The v4pools entity tracks the new pool
  //     },
  // });

  // } catch (error) {
  //   console.error(`Failed to process V4 migration for asset ${assetId}:`, error);
  // }

  //TODO: fix early bail out on v4 migration
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