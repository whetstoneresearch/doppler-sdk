import { Context } from "ponder:registry";
import { user } from "ponder.schema";
import { Address } from "viem";

export const insertUserIfNotExists = async ({
  userId,
  timestamp,
  context,
}: {
  userId: Address;
  timestamp: bigint;
  context: Context;
}): Promise<typeof user.$inferSelect> => {
  const { db } = context;
  const userIdAddr = userId.toLowerCase() as `0x${string}`;

  const existingUser = await db.find(user, {
    address: userIdAddr,
  });

  if (existingUser) {
    return existingUser;
  }

  return await db.insert(user).values({
    address: userIdAddr,
    lastSeenAt: timestamp,
    createdAt: timestamp,
  });
};

export const updateUser = async ({
  userId,
  context,
  update,
}: {
  userId: Address;
  context: Context;
  update: Partial<typeof user.$inferInsert>;
}) => {
  const { db } = context;
  const userIdAddr = userId.toLowerCase() as `0x${string}`;

  await db
    .update(user, {
      address: userIdAddr,
    })
    .set({
      ...update,
    });
};
