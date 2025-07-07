import { Context } from "ponder:registry";
import { position } from "ponder.schema";
import { Address } from "viem";

export const insertPositionIfNotExists = async ({
  poolAddress,
  tickLower,
  tickUpper,
  liquidity,
  owner,
  timestamp,
  context,
}: {
  poolAddress: Address;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  owner: Address;
  timestamp: bigint;
  context: Context;
}): Promise<typeof position.$inferSelect> => {
  const { db, chain } = context;
  const poolAddr = poolAddress.toLowerCase() as `0x${string}`;

  const existingPosition = await db.find(position, {
    pool: poolAddr,
    tickLower: tickLower,
    tickUpper: tickUpper,
    chainId: BigInt(chain.id),
  });

  if (existingPosition) {
    return existingPosition;
  }

  return await db.insert(position).values({
    owner: owner.toLowerCase() as `0x${string}`,
    pool: poolAddr,
    tickLower,
    tickUpper,
    liquidity,
    createdAt: timestamp,
    chainId: BigInt(chain.id),
  });
};

export const updatePosition = async ({
  poolAddress,
  tickLower,
  tickUpper,
  context,
  update,
}: {
  poolAddress: Address;
  tickLower: number;
  tickUpper: number;
  context: Context;
  update: Partial<typeof position.$inferInsert>;
}) => {
  const { db, chain } = context;
  const poolAddr = poolAddress.toLowerCase() as `0x${string}`;

  await db
    .update(position, {
      pool: poolAddr,
      tickLower,
      tickUpper,
      chainId: BigInt(chain.id),
    })
    .set({
      ...update,
    });
};
