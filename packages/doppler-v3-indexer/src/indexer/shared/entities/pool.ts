import { getV3PoolData } from "@app/utils/v3-utils";
import { computeDollarLiquidity } from "@app/utils/computeDollarLiquidity";
import { pool } from "ponder:schema";
import { Address } from "viem";
import { Context } from "ponder:registry";

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
    token0Balance,
    token1Balance,
    token0,
    poolState,
  } = poolData;

  const dollarLiquidity = await computeDollarLiquidity({
    assetBalance: token0Balance,
    quoteBalance: token1Balance,
    price,
    timestamp,
    context,
  });

  const isToken0 = token0.toLowerCase() === poolState.asset.toLowerCase();

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
    dollarLiquidity,
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
