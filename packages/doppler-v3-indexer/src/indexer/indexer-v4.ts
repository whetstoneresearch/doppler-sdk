import { ponder } from "ponder:registry";
import { getAssetData } from "@app/utils/getAssetData";
import { asset, pool } from "ponder.schema";
import { getV4PoolData } from "@app/utils/v4-utils";

ponder.on("UniswapV4Initializer:Create", async ({ event, context }) => {
  // TODO: FIX THE STATEVIEW RETURNING 0???
  const { poolOrHook: hook, asset: assetId, numeraire } = event.args;
  const { db, network } = context;
  const assetData = await getAssetData(assetId, context);

  if (!assetData) {
    console.error("UniswapV3Initializer:Create - Asset data not found");
    return;
  }

  const { slot0Data, liquidity, price, poolKey } = await getV4PoolData({
    context,
    hook,
  });

  await db
    .insert(pool)
    .values({
      ...slot0Data,
      address: hook,
      liquidity: liquidity,
      createdAt: event.block.timestamp,
      asset: assetId,
      baseToken: assetId,
      quoteToken: numeraire,
      price,
      type: "v4",
      dollarLiquidity: 0n,
      chainId: BigInt(network.chainId),
      fee: poolKey.fee,
      dailyVolume: hook,
    })
    .onConflictDoNothing();

  await context.db
    .insert(asset)
    .values({
      ...assetData,
      address: assetId,
      chainId: BigInt(network.chainId),
      createdAt: event.block.timestamp,
      migratedAt: null,
    })
    .onConflictDoNothing();
});
