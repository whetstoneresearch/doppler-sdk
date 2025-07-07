import { Context } from "ponder:registry";
import { v4pool } from "ponder:schema";

export const insertV4PoolIfNotExists = async ({
  poolId,
  context,
  timestamp,
  sqrtPrice,
  lowerTick,
  upperTick,
  liquidity,
  reserves0,
  reserves1
}: {
  poolId: `0x${string}`;
  timestamp: bigint;
  context: Context;
  sqrtPrice: bigint;
  lowerTick: number;
  upperTick: number;
  liquidity: bigint;
  reserves0: bigint;
  reserves1: bigint
}) => {
  const { db, chain } = context;

  const existingPool = await db.find(v4pool, {
    poolId: poolId.toLowerCase() as `0x${string}`,
    chainId: BigInt(chain.id),
  });

  if (existingPool) {
    return existingPool;
  }

  return await db.insert(v4pool).values({
    poolId,
    chainId: BigInt(chain.id),
    currency0: currency0,
    currency1: currency1,
    fee,
    tickSpacing,
    hooks: hooks,
    sqrtPriceX96,
    liquidity,
    tick,
    asset,
    migratedFromPool,
    migratedAt: timestamp,
    price,
    createdAt,
    isToken0,
    isQuoteEth,
    volumeUsd,
    dollarLiquidity,
    totalFee0,
    totalFee1,
    reserves0,
    reserves1,
    lastRefreshed,
  });

};

export const updateV4Pool = async ({
  poolId,
  context,
  update,
}: {
  poolId: `0x${string}`;
  context: Context;
  update: Partial<typeof v4pool.$inferInsert>;
}) => {
  const { db, chain } = context;
  if (!chain) {
    throw new Error("Chain not available in context");
  }

  await db.update(v4pool, {
    poolId: poolId.toLowerCase() as `0x${string}`,
    chainId: BigInt(chain.id),
  }).set(update);
};