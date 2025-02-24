import { ponder } from "ponder:registry";
import { asset, pool, v2Pool } from "ponder.schema";
import {
  insertOrUpdateBuckets,
  insertOrUpdateDailyVolume,
} from "./shared/timeseries";
import { computeV2Price } from "@app/utils/v2-utils/computeV2Price";
import { getPairData } from "@app/utils/v2-utils/getPairData";
import { computeDollarLiquidity } from "@app/utils/computeDollarLiquidity";
import { fetchEthPrice } from "./shared/oracle";
import { updateV2Pool } from "./shared/entities";
import { CHAINLINK_ETH_DECIMALS } from "@app/utils/constants";

ponder.on("UniswapV2Pair:Swap", async ({ event, context }) => {
  const { db, network } = context;
  const { address } = event.log;
  const { timestamp } = event.block;
  const { amount0In, amount1In, amount0Out, amount1Out } = event.args;

  // Early exit if pool not found
  const v2PoolData = await db.find(v2Pool, { address });
  if (!v2PoolData) return;

  // Fetch pair data
  const pairData = await getPairData({ address, context });
  if (!pairData) return;
  const { token0, token1, reserve0, reserve1 } = pairData;

  // Find associated asset data
  const assetData =
    (await db.find(asset, { address: token0 })) ||
    (await db.find(asset, { address: token1 }));
  if (!assetData) {
    console.error(
      `UniswapV2Pair:Swap - Asset data not found for pair ${address}`
    );
    return;
  }

  // Calculate swap amounts
  const amountIn = amount0In > 0 ? amount0In : amount1In;
  const amountOut = amount0Out > 0 ? amount0Out : amount1Out;

  // Determine token relationships
  const isToken0 = assetData.address.toLowerCase() === token0.toLowerCase();
  const { numeraire, poolAddress } = assetData;

  const tokenIn = amount0In > 0 ? token0 : token1;

  const assetBalance = isToken0 ? reserve0 : reserve1;
  const quoteBalance = isToken0 ? reserve1 : reserve0;

  if (!numeraire || !tokenIn || !reserve0 || !reserve1) {
    console.error(`Missing required data for swap in pool ${address}`);
    return;
  }

  const price = await computeV2Price({ assetBalance, quoteBalance });
  const ethPrice = await fetchEthPrice(timestamp, context);

  let dollarLiquidity;
  if (ethPrice) {
    await Promise.all([
      insertOrUpdateBuckets({
        poolAddress,
        price,
        timestamp,
        ethPrice,
        context,
      }),
      insertOrUpdateDailyVolume({
        poolAddress,
        amountIn,
        amountOut,
        timestamp,
        context,
        tokenIn,
        ethPrice,
      }),
    ]);

    dollarLiquidity = await computeDollarLiquidity({
      assetBalance,
      quoteBalance,
      price,
      ethPrice,
    });
    await updateV2Pool({
      poolAddress: address,
      context,
      update: { price: (price * ethPrice) / CHAINLINK_ETH_DECIMALS },
    });
  }

  // Prepare and execute final update
  const update = dollarLiquidity ? { price, dollarLiquidity } : { price };
  await db
    .update(pool, { address: poolAddress, chainId: BigInt(network.chainId) })
    .set(update);
});

// ponder.on("UniswapV2Pair:Mint", async ({ event, context }) => {
//   const { db, network } = context;
//   const address = event.log.address;
//   const { amount0, amount1 } = event.args;

// }
