import { ponder } from "ponder:registry";
import { asset, user, userAsset, v3Pool, position } from "../ponder.schema";
import { AirlockABI } from "../abis/AirlockABI";
import { UniswapV3PoolABI } from "../abis/UniswapV3PoolABI";
import { Hex } from "viem";

interface AssetData {
  numeraire: Hex;
  timelock: Hex;
  governance: Hex;
  liquidityMigrator: Hex;
  poolInitializer: Hex;
  pool: Hex;
  migrationPool: Hex;
  numTokensToSell: bigint;
  totalSupply: bigint;
  integrator: Hex;
}

ponder.on("Airlock:Create", async ({ event, context }) => {
  const { client } = context;
  const { Airlock } = context.contracts;
  const { asset: assetId, poolOrHook } = event.args;

  const assetData = await client.readContract({
    abi: AirlockABI,
    address: Airlock.address,
    functionName: "getAssetData",
    args: [assetId],
  });

  const assetDataStruct: AssetData = {
    numeraire: assetData[0],
    timelock: assetData[1],
    governance: assetData[2],
    liquidityMigrator: assetData[3],
    poolInitializer: assetData[4],
    pool: assetData[5],
    migrationPool: assetData[6],
    numTokensToSell: assetData[7],
    totalSupply: assetData[8],
    integrator: assetData[9],
  };

  await context.db
    .insert(asset)
    .values({
      id: assetId,
      ...assetDataStruct,
      createdAt: event.block.timestamp,
      migratedAt: null,
    })
    .onConflictDoNothing();

  const poolData = await client.readContract({
    abi: UniswapV3PoolABI,
    address: poolOrHook,
    functionName: "slot0",
  });

  const liquidity = await client.readContract({
    abi: UniswapV3PoolABI,
    address: poolOrHook,
    functionName: "liquidity",
  });

  const poolDataStruct = {
    sqrtPrice: poolData[0],
    tick: poolData[1],
  };

  await context.db.insert(v3Pool).values({
    id: poolOrHook,
    ...poolDataStruct,
    liquidity: liquidity,
    createdAt: event.block.timestamp,
  });
});

ponder.on("Airlock:Migrate", async ({ event, context }) => {
  const { db } = context;
  const { asset: assetId } = event.args;
  const { client } = context;
  const { Airlock } = context.contracts;

  const assetData = await client.readContract({
    abi: AirlockABI,
    address: Airlock.address,
    functionName: "getAssetData",
    args: [assetId],
  });

  const assetDataStruct: AssetData = {
    numeraire: assetData[0],
    timelock: assetData[1],
    governance: assetData[2],
    liquidityMigrator: assetData[3],
    poolInitializer: assetData[4],
    pool: assetData[5],
    migrationPool: assetData[6],
    numTokensToSell: assetData[7],
    totalSupply: assetData[8],
    integrator: assetData[9],
  };

  await db
    .insert(asset)
    .values({
      id: assetId,
      ...assetDataStruct,
      createdAt: event.block.timestamp,
      migratedAt: event.block.timestamp,
    })
    .onConflictDoUpdate((row) => ({
      migratedAt: event.block.timestamp,
    }));
});

ponder.on("UniswapV3Pool:Mint", async ({ event, context }) => {
  const { db } = context;
  const pool = event.log.address;
  const { tickLower, tickUpper, amount, owner } = event.args;

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
  const { tickLower, tickUpper, owner } = event.args;

  await db
    .insert(position)
    .values({
      id: `${owner}-${pool}-${tickLower}-${tickUpper}`,
      owner: owner,
      pool: pool,
      tickLower: tickLower,
      tickUpper: tickUpper,
      liquidity: event.args.amount,
      createdAt: event.block.timestamp,
    })
    .onConflictDoUpdate((row) => ({
      liquidity: row.liquidity - event.args.amount,
    }));
});

ponder.on("UniswapV3Pool:Swap", async ({ event, context }) => {
  const { db } = context;
  const { client } = context;
  const pool = event.log.address;

  const poolData = await client.readContract({
    abi: UniswapV3PoolABI,
    address: pool,
    functionName: "slot0",
  });

  const poolDataStruct = {
    sqrtPrice: poolData[0],
    tick: poolData[1],
  };

  const liquidity = await client.readContract({
    abi: UniswapV3PoolABI,
    address: pool,
    functionName: "liquidity",
  });

  await db
    .insert(v3Pool)
    .values({
      id: pool,
      ...poolDataStruct,
      liquidity: liquidity,
      createdAt: event.block.timestamp,
    })
    .onConflictDoUpdate((row) => ({
      liquidity: liquidity,
      sqrtPrice: poolData[0],
      tick: poolData[1],
    }));
});

ponder.on("DERC20:Transfer", async ({ event, context }) => {
  const userAddress = event.transaction.from;
  const { db } = context;
  const { address } = event.log;

  await db
    .insert(user)
    .values({
      id: event.args.from,
      address: event.args.from,
      createdAt: event.block.timestamp,
    })
    .onConflictDoNothing();

  await db
    .insert(userAsset)
    .values({
      id: `${userAddress}-${address}`,
      userId: userAddress,
      assetId: address,
    })
    .onConflictDoNothing();
});
// ponder.on("Airlock:SetModuleState", async ({ event, context }) => {
//   const { modules } = context.db;

//   await context.db.insert(modules).values({
//     id: event.args.module,
//     state: event.args.state,
//     lastUpdated: new Date(Number(event.block.timestamp)),
//   });
// });
