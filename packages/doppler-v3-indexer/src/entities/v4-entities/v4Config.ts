import { Context } from "ponder:registry";
import { v4PoolConfig } from "ponder:schema";
import { Address } from "viem";
import { getV4PoolConfig } from "@app/utils/v4-utils/getV4PoolData";

export const insertV4ConfigIfNotExists = async ({
  hookAddress,
  context,
}: {
  hookAddress: Address;
  context: Context;
}) => {
  const { db } = context;

  const existingConfig = await db.find(v4PoolConfig, {
    hookAddress,
  });

  if (existingConfig) {
    return existingConfig;
  }

  const config = await getV4PoolConfig({ hook: hookAddress, context });

  return await db.insert(v4PoolConfig).values({
    ...config,
    hookAddress,
  });
};

export const updateV4Config = async ({
  hookAddress,
  context,
  update,
}: {
  hookAddress: Address;
  context: Context;
  update?: Partial<typeof v4PoolConfig.$inferInsert>;
}) => {
  const { db } = context;

  await db
    .update(v4PoolConfig, {
      hookAddress,
    })
    .set({
      ...update,
    });
};
