import { Context } from "ponder:registry";
import { user, userAsset } from "ponder:schema";
import { Address } from "viem";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as `0x${string}`;

/**
 * Batch upsert users and user assets efficiently
 */
export const batchUpsertUsersAndAssets = async ({
  senderAddress,
  recipientAddress,
  tokenAddress,
  senderBalance,
  recipientBalance,
  timestamp,
  context,
}: {
  senderAddress: Address;
  recipientAddress: Address;
  tokenAddress: Address;
  senderBalance: bigint;
  recipientBalance: bigint;
  timestamp: bigint;
  context: Context;
}): Promise<{
  senderAsset: typeof userAsset.$inferSelect | null;
  recipientAsset: typeof userAsset.$inferSelect | null;
  holderCountDelta: number;
}> => {
  const { db, chain } = context;
  const senderLower = senderAddress.toLowerCase() as `0x${string}`;
  const recipientLower = recipientAddress.toLowerCase() as `0x${string}`;
  const tokenLower = tokenAddress.toLowerCase() as `0x${string}`;
  const isMint = senderLower === ZERO_ADDRESS;
  const isBurn = recipientLower === ZERO_ADDRESS;

  // Create user entries (skip zero address)
  const userInserts: Promise<any>[] = [];
  if (!isMint) {
    userInserts.push(
      db.insert(user)
        .values({
          address: senderLower,
          chainId: chain.id,
          createdAt: timestamp,
          lastSeenAt: timestamp,
        })
        .onConflictDoUpdate(() => ({
          lastSeenAt: timestamp,
        }))
    );
  }
  if (!isBurn) {
    userInserts.push(
      db.insert(user)
        .values({
          address: recipientLower,
          chainId: chain.id,
          createdAt: timestamp,
          lastSeenAt: timestamp,
        })
        .onConflictDoUpdate(() => ({
          lastSeenAt: timestamp,
        }))
    );
  }
  
  if (userInserts.length > 0) {
    await Promise.all(userInserts);
  }

  // Batch fetch existing user assets (skip zero address)
  let existingSenderAsset: typeof userAsset.$inferSelect | null = null;
  let existingRecipientAsset: typeof userAsset.$inferSelect | null = null;
  
  const assetFetches: Promise<any>[] = [];
  if (!isMint) {
    assetFetches.push(
      db.find(userAsset, {
        userId: senderLower,
        assetId: tokenLower,
        chainId: chain.id,
      }).then(result => { existingSenderAsset = result; })
    );
  }
  if (!isBurn) {
    assetFetches.push(
      db.find(userAsset, {
        userId: recipientLower,
        assetId: tokenLower,
        chainId: chain.id,
      }).then(result => { existingRecipientAsset = result; })
    );
  }
  
  if (assetFetches.length > 0) {
    await Promise.all(assetFetches);
  }

  // Calculate holder count delta
  let holderCountDelta = 0;
  
  // Handle mints (new tokens entering circulation)
  if (isMint && recipientBalance > 0n) {
    const recipientPrevBalance = existingRecipientAsset?.balance ?? 0n;
    if (recipientPrevBalance === 0n) {
      holderCountDelta += 1;
    }
  }
  // Handle burns (tokens leaving circulation)
  else if (isBurn && senderBalance === 0n) {
    const senderPrevBalance = existingSenderAsset?.balance ?? 0n;
    if (senderPrevBalance > 0n) {
      holderCountDelta -= 1;
    }
  }
  // Handle regular transfers
  else if (!isMint && !isBurn) {
    const senderPrevBalance = existingSenderAsset?.balance ?? 0n;
    const recipientPrevBalance = existingRecipientAsset?.balance ?? 0n;
    
    if (recipientPrevBalance === 0n && recipientBalance > 0n) {
      holderCountDelta += 1;
    }
    if (senderPrevBalance > 0n && senderBalance === 0n) {
      holderCountDelta -= 1;
    }
  }

  // Batch upsert user assets (skip zero address)
  let senderAsset: typeof userAsset.$inferSelect | null = null;
  let recipientAsset: typeof userAsset.$inferSelect | null = null;
  
  const assetUpserts: Promise<any>[] = [];
  
  if (!isMint) {
    assetUpserts.push(
      db.insert(userAsset)
        .values({
          userId: senderLower,
          assetId: tokenLower,
          chainId: chain.id,
          createdAt: timestamp,
          balance: senderBalance,
          lastInteraction: timestamp,
        })
        .onConflictDoUpdate(() => ({
          balance: senderBalance,
          lastInteraction: timestamp,
        }))
        .then(result => { senderAsset = result; })
    );
  }
  
  if (!isBurn) {
    assetUpserts.push(
      db.insert(userAsset)
        .values({
          userId: recipientLower,
          assetId: tokenLower,
          chainId: chain.id,
          balance: recipientBalance,
          createdAt: timestamp,
          lastInteraction: timestamp,
        })
        .onConflictDoUpdate(() => ({
          balance: recipientBalance,
          lastInteraction: timestamp,
        }))
        .then(result => { recipientAsset = result; })
    );
  }
  
  if (assetUpserts.length > 0) {
    await Promise.all(assetUpserts);
  }

  return {
    senderAsset,
    recipientAsset,
    holderCountDelta,
  };
};

/**
 * Batch update holder counts for multiple entities
 */
export const batchUpdateHolderCounts = async ({
  tokenAddress,
  poolAddress,
  holderCountDelta,
  currentTokenHolderCount,
  context,
}: {
  tokenAddress: Address;
  poolAddress: Address | null;
  holderCountDelta: number;
  currentTokenHolderCount: number;
  context: Context;
}): Promise<void> => {
  const { db, chain } = context;

  if (holderCountDelta === 0) {
    return;
  }

  const updates: Promise<any>[] = [];

  // Update token holder count
  updates.push(
    db.update(token, {
      address: tokenAddress.toLowerCase() as `0x${string}`,
      chainId: chain.id,
    }).set({
      holderCount: currentTokenHolderCount + holderCountDelta,
    })
  );

  // Update pool and asset holder counts if pool exists
  if (poolAddress) {
    updates.push(
      db.update(pool, {
        address: poolAddress.toLowerCase() as `0x${string}`,
        chainId: chain.id,
      }).set({
        holderCount: currentTokenHolderCount + holderCountDelta,
      })
    );
  }

  await Promise.all(updates);
};

// Import necessary schema types
import { token, pool } from "ponder:schema";