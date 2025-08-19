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

  return await db.insert(position).values({
    owner: owner.toLowerCase() as `0x${string}`,
    pool: poolAddr,
    tickLower,
    tickUpper,
    liquidity,
    createdAt: timestamp,
    chainId: BigInt(chain.id),
  }).onConflictDoUpdate((curr) => {
    return {
      liquidity: curr.liquidity + liquidity,
    };
  });
};
