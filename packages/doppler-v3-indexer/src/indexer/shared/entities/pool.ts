import { getV3PoolData } from "@app/utils/v3-utils";
import { computeDollarLiquidity } from "@app/utils/computeDollarLiquidity";
import { pool } from "ponder:schema";
import { Address } from "viem";
import { Context } from "ponder:registry";
import { fetchEthPrice } from "../oracle";

export const insertPoolIfNotExists = async ({
  poolAddress,
  timestamp,
  context,
}: {
  poolAddress: Address;
  timestamp: bigint;
  context: Context;
}): Promise<typeof pool.$inferSelect> => {
  const { db, network } = context;
  const existingPool = await db.find(pool, {
    address: poolAddress,
    chainId: BigInt(network.chainId),
  });

  if (existingPool) {
    return existingPool;
  }

  const poolData = await getV3PoolData({
    address: poolAddress,
    context,
  });

  const {
    slot0Data,
    liquidity,
    price,
    fee,
    reserve0,
    reserve1,
    token0,
    poolState,
  } = poolData;

  const ethPrice = await fetchEthPrice(timestamp, context);

  const isToken0 = token0.toLowerCase() === poolState.asset.toLowerCase();

  console.log("isToken0", isToken0);

  let dollarLiquidity;
  if (ethPrice) {
    dollarLiquidity = await computeDollarLiquidity({
      assetBalance: isToken0 ? reserve0 : reserve1,
      quoteBalance: isToken0 ? reserve1 : reserve0,
      price,
      ethPrice,
    });
  }

  return await db.insert(pool).values({
    ...poolData,
    ...slot0Data,
    address: poolAddress,
    liquidity: liquidity,
    createdAt: timestamp,
    asset: poolState.asset,
    baseToken: poolState.asset,
    quoteToken: poolState.numeraire,
    price,
    type: "v3",
    chainId: BigInt(network.chainId),
    fee,
    dollarLiquidity: dollarLiquidity ?? 0n,
    dailyVolume: poolAddress,
    graduationThreshold: 0n,
    graduationBalance: 0n,
    totalFee0: 0n,
    totalFee1: 0n,
    isToken0,
  });
};

export const updatePool = async ({
  poolAddress,
  context,
  update,
}: {
  poolAddress: Address;
  context: Context;
  update?: Partial<typeof pool.$inferInsert>;
}) => {
  const { db, network } = context;

  await db
    .update(pool, {
      address: poolAddress,
      chainId: BigInt(network.chainId),
    })
    .set({
      ...update,
    });
};
