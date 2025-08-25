import { Context } from "ponder:registry";
import { userAsset } from "ponder.schema";
import { Address } from "viem";

export const insertUserAssetIfNotExists = async ({
  userId,
  assetId,
  timestamp,
  context,
}: {
  userId: Address;
  assetId: Address;
  timestamp: bigint;
  context: Context;
}): Promise<typeof userAsset.$inferSelect> => {
  const { db, chain } = context;
  const userIdAddr = userId.toLowerCase() as `0x${string}`;
  const assetIdAddr = assetId.toLowerCase() as `0x${string}`;

  const existingUserAsset = await db.find(userAsset, {
    userId: userIdAddr,
    assetId: assetIdAddr,
    chainId: BigInt(chain.id),
  });

  if (existingUserAsset) {
    return existingUserAsset;
  }

  return await db.insert(userAsset).values({
    userId: userIdAddr,
    lastInteraction: timestamp,
    createdAt: timestamp,
    assetId: assetIdAddr,
    balance: 0n,
    chainId: BigInt(chain.id),
  });
};

export const updateUserAsset = async ({
  userId,
  assetId,
  context,
  update,
}: {
  userId: Address;
  assetId: Address;
  context: Context;
  update: Partial<typeof userAsset.$inferInsert>;
}) => {
  const { db, chain } = context;
  const userIdAddr = userId.toLowerCase() as `0x${string}`;
  const assetIdAddr = assetId.toLowerCase() as `0x${string}`;

  await db
    .update(userAsset, {
      userId: userIdAddr,
      assetId: assetIdAddr,
      chainId: BigInt(chain.id),
    })
    .set({
      ...update,
    });
};
