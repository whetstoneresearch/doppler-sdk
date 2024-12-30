import { ponder } from "ponder:registry";
import { assets } from "../ponder.schema";
import { AirlockABI } from "../abis/AirlockABI";
import { Hex } from "viem";

type AssetData = {
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
};

ponder.on("Airlock:Create", async ({ event, context }) => {
  const { client } = context;
  const { Airlock } = context.contracts;

  const assetData = await client.readContract({
    abi: AirlockABI,
    address: Airlock.address,
    functionName: "getAssetData",
    args: [event.args.asset],
  });

  // Insert the asset record with all its related data
  await context.db.insert(assets).values({
    id: event.args.asset,
    numeraire: event.args.numeraire,
    pool: assetData[5],
    timelock: assetData[6],
    governance: assetData[4],
    liquidityMigrator: assetData[3],
    migrationPool: assetData[2],
    poolInitializer: assetData[1],
    createdAt: new Date(Number(event.block.timestamp)),
    migratedAt: null,
    v2Pool: assetData[6],
  });
});

ponder.on("Airlock:Migrate", async ({ event, context }) => {
  const { assets } = context.db;

  await assets.update({
    id: event.args.asset,
    migratedAt: new Date(Number(event.block.timestamp)),
  });
});

ponder.on("Airlock:SetModuleState", async ({ event, context }) => {
  const { modules } = context.db;

  await context.db.insert(modules).values({
    id: event.args.module,
    state: event.args.state,
    lastUpdated: new Date(Number(event.block.timestamp)),
  });
});
