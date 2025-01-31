import { ponder } from "ponder:registry";
import { computeV3Price, getV3PoolData } from "@app/utils/v3-utils";
import { asset, position, v3Pool } from "ponder.schema";
import { getAssetData } from "@app/utils/getAssetData";

ponder.on("UniswapV3Initializer:Create", async ({ event, context }) => {
  const { poolOrHook, asset: assetId, numeraire } = event.args;

  const assetData = await getAssetData(assetId, context);

  if (!assetData) {
    console.error("UniswapV3Initializer:Create - Asset data not found");
    return;
  }

  const { slot0Data, liquidity, price } = await getV3PoolData({
    address: poolOrHook,
    context,
  });

  console.log("numeraire", numeraire);

  await context.db
    .insert(v3Pool)
    .values({
      ...slot0Data,
      address: poolOrHook,
      liquidity: liquidity,
      createdAt: event.block.timestamp,
      initializer: assetData.poolInitializer,
      asset: assetId,
      baseToken: assetId,
      quoteToken: numeraire,
      price,
    })
    .onConflictDoNothing();

  await context.db
    .insert(asset)
    .values({
      ...assetData,
      address: assetId,
      createdAt: event.block.timestamp,
      migratedAt: null,
    })
    .onConflictDoNothing();
});

ponder.on("UniswapV3Pool:Mint", async ({ event, context }) => {
  const { db } = context;
  const pool = event.log.address;
  const { tickLower, tickUpper, amount, owner } = event.args;

  const { slot0Data, liquidity, poolState, price } = await getV3PoolData({
    address: pool,
    context,
  });

  await context.db
    .insert(v3Pool)
    .values({
      ...slot0Data,
      address: pool,
      liquidity,
      createdAt: event.block.timestamp,
      initializer: poolState.initializer,
      asset: poolState.asset,
      baseToken: poolState.asset,
      quoteToken: poolState.numeraire,
      price,
    })
    .onConflictDoUpdate((row) => ({
      liquidity: row.liquidity + amount,
    }));

  await db
    .insert(position)
    .values({
      id: `${owner}-${pool}-${tickLower}-${tickUpper}`,
      owner: owner,
      pool: pool,
      tickLower: tickLower,
      tickUpper: tickUpper,
      liquidity: amount,
      createdAt: event.block.timestamp,
    })
    .onConflictDoUpdate((row) => ({ liquidity: row.liquidity + amount }));
});

ponder.on("UniswapV3Pool:Burn", async ({ event, context }) => {
  const { db } = context;
  const pool = event.log.address;
  const { tickLower, tickUpper, owner, amount } = event.args;

  const { slot0Data, liquidity, poolState, price } = await getV3PoolData({
    address: pool,
    context,
  });

  await context.db
    .insert(v3Pool)
    .values({
      ...slot0Data,
      address: pool,
      liquidity,
      createdAt: event.block.timestamp,
      initializer: poolState.initializer,
      asset: poolState.asset,
      baseToken: poolState.asset,
      quoteToken: poolState.numeraire,
      price,
    })
    .onConflictDoUpdate((row) => ({
      liquidity: row.liquidity - amount,
    }));

  await db
    .insert(position)
    .values({
      id: `${owner}-${pool}-${tickLower}-${tickUpper}`,
      owner: owner,
      pool: pool,
      tickLower: tickLower,
      tickUpper: tickUpper,
      liquidity: amount,
      createdAt: event.block.timestamp,
    })
    .onConflictDoUpdate((row) => ({
      liquidity: row.liquidity - amount,
    }));
});

ponder.on("UniswapV3Pool:Swap", async ({ event, context }) => {
  const { db } = context;
  const pool = event.log.address;

  const { slot0Data, liquidity, poolState, price } = await getV3PoolData({
    address: pool,
    context,
  });

  await db
    .insert(v3Pool)
    .values({
      address: pool,
      ...slot0Data,
      liquidity: liquidity,
      createdAt: event.block.timestamp,
      baseToken: poolState.asset,
      quoteToken: poolState.numeraire,
      price,
      asset: poolState.asset,
    })
    .onConflictDoUpdate((row) => ({
      liquidity: liquidity,
      price: price,
      ...slot0Data,
    }));
});
