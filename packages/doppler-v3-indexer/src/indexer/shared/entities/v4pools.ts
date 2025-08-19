import { Context } from "ponder:registry";
import { v4pools } from "ponder:schema";

export const fetchExistingV4Pool = async ({
  poolId,
  context,
}: {
  poolId: `0x${string}`;
  context: Context;
}) => {
  const { db, chain } = context;
  if (!chain) {
    throw new Error("Chain not available in context");
  }
  
  const existingPool = await db.find(v4pools, {
    poolId: poolId.toLowerCase() as `0x${string}`,
    chainId: chain.id,
  });
  
  if (!existingPool) {
    throw new Error(`V4 pool ${poolId} not found`);
  }
  
  return existingPool;
};

export const updateV4Pool = async ({
  poolId,
  context,
  update,
}: {
  poolId: `0x${string}`;
  context: Context;
  update: Partial<typeof v4pools.$inferInsert>;
}) => {
  const { db, chain } = context;
  if (!chain) {
    throw new Error("Chain not available in context");
  }
  
  await db.update(v4pools, {
    poolId: poolId.toLowerCase() as `0x${string}`,
    chainId: chain.id,
  }).set(update);
};