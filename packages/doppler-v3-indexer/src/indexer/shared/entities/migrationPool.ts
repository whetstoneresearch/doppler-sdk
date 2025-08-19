import { pool, migrationPool } from "ponder:schema";
import { Address } from "viem";
import { Context } from "ponder:registry";
import { getV3MigrationPoolData } from "@app/utils/v3-utils/getV3PoolData";

export const fetchV3MigrationPool = async ({
  poolAddress,
  context,
}: {
  poolAddress: Address;
  context: Context;
}): Promise<typeof migrationPool.$inferSelect | null> => {
  const { db, chain } = context;
  const address = poolAddress.toLowerCase() as `0x${string}`;

  const existingPool = await db.find(migrationPool, {
    address,
    chainId: chain.id,
  });

  if (existingPool) {
    return existingPool;
  }

  return null;
};
export const insertV3MigrationPoolIfNotExists = async ({
  poolAddress,
  parentPool,
  timestamp,
  context,
}: {
  poolAddress: Address;
  parentPool: Address;
  timestamp: bigint;
  context: Context;
}): Promise<typeof migrationPool.$inferSelect> => {
  const { db, chain } = context;
  const address = poolAddress.toLowerCase() as `0x${string}`;
  const parentPoolAddress = parentPool.toLowerCase() as `0x${string}`;

  const parentPoolEntity = await db.find(pool, {
    address: parentPoolAddress,
    chainId: chain.id,
  });

  const existingPool = await db.find(migrationPool, {
    address,
    chainId: chain.id,
  });

  if (existingPool) {
    return existingPool;
  }

  const poolData = await getV3MigrationPoolData({
    address,
    baseToken: parentPoolEntity!.baseToken,
    context,
  });

  const { price, token0, token1, reserve0, reserve1, isToken0, fee } = poolData;

  const assetAddr = token0.toLowerCase() as `0x${string}`;
  const numeraireAddr = token1.toLowerCase() as `0x${string}`;

  const reserveBaseToken = isToken0 ? reserve0 : reserve1;
  const reserveQuoteToken = isToken0 ? reserve1 : reserve0;

  return await db.insert(migrationPool).values({
    address,
    migratedAt: timestamp,
    baseToken: assetAddr,
    quoteToken: numeraireAddr,
    reserveBaseToken,
    reserveQuoteToken,
    price,
    chainId: chain.id,
    parentPool: parentPoolAddress,
    isToken0,
    fee,
    type: "v3",
  });
};

export const updateMigrationPool = async ({
  poolAddress,
  context,
  update,
}: {
  poolAddress: Address;
  context: Context;
  update: Partial<typeof migrationPool.$inferInsert>;
}) => {
  const { db, chain } = context;
  const address = poolAddress.toLowerCase() as `0x${string}`;

  await db
    .update(migrationPool, {
      address,
      chainId: chain.id,
    })
    .set({
      ...update,
    });
};
