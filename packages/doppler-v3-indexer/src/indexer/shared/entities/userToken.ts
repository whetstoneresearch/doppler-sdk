import { Context } from "ponder:registry";
import { userToken } from "ponder.schema";
import { Address } from "viem";

export const insertUserTokenIfNotExists = async ({
  userId,
  assetId,
  timestamp,
  context,
}: {
  userId: Address;
  assetId: Address;
  timestamp: bigint;
  context: Context;
}): Promise<typeof userToken.$inferSelect> => {
  const { db, chain } = context;
  const userIdAddr = userId.toLowerCase() as `0x${string}`;
  const assetIdAddr = assetId.toLowerCase() as `0x${string}`;

  const existingUserToken = await db.find(userToken, {
    userId: userIdAddr,
    tokenId: assetIdAddr,
    chainId: BigInt(chain.id),
  });

  if (existingUserToken) {
    return existingUserToken;
  }

  return await db.insert(userToken).values({
    userId: userIdAddr,
    lastInteraction: timestamp,
    createdAt: timestamp,
    tokenId: assetIdAddr,
    balance: 0n,
    chainId: BigInt(chain.id),
  });
};

export const updateUserToken = async ({
  userId,
  assetId,
  context,
  update,
}: {
  userId: Address;
  assetId: Address;
  context: Context;
  update: Partial<typeof userToken.$inferInsert>;
}) => {
  const { db, chain } = context;
  const userIdAddr = userId.toLowerCase() as `0x${string}`;
  const assetIdAddr = assetId.toLowerCase() as `0x${string}`;

  await db
    .update(userToken, {
      userId: userIdAddr,
      tokenId: assetIdAddr,
      chainId: BigInt(chain.id),
    })
    .set({
      ...update,
    });
};
