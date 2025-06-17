import type { Address } from "viem";
import { pendingTokenImages } from "ponder.schema";
import { Context } from "ponder:registry";

interface PendingTokenInfo {
  address: Address;
  tokenURI: string;
  addedAt: number;
  retryCount: number;
  lastRetryAt?: number;
}

type PendingTokensBlob = Record<Address, PendingTokenInfo>;

/**
 * Add a token to the pending images list
 */
export async function addPendingTokenImage({
  context,
  chainId,
  tokenAddress,
  tokenURI,
  timestamp,
}: {
  context: Context;
  chainId: bigint;
  tokenAddress: Address;
  tokenURI: string;
  timestamp: number;
}) {
  // Fetch existing blob
  const existing = await context.db.find(pendingTokenImages, { chainId });

  const blob: PendingTokensBlob = existing ? existing.tokens as PendingTokensBlob : {};

  // Add the new token
  blob[tokenAddress] = {
    address: tokenAddress,
    tokenURI,
    addedAt: timestamp,
    retryCount: 0,
  };

  // Upsert the blob
  await context.db
    .insert(pendingTokenImages)
    .values({
      chainId,
      tokens: blob,
    })
    .onConflictDoUpdate({
      tokens: blob,
    });
}

/**
 * Remove a token from the pending images list
 */
export async function removePendingTokenImage({
  context,
  chainId,
  tokenAddress,
}: {
  context: Context;
  chainId: bigint;
  tokenAddress: Address;
}) {
  // Fetch existing blob
  const existing = await context.db.find(pendingTokenImages, { chainId });

  const blob: PendingTokensBlob = existing ? existing.tokens as PendingTokensBlob : {};

  // Remove the token
  delete blob[tokenAddress];

  // Update the blob
  await context.db.update(pendingTokenImages, { chainId }).set({ tokens: blob });
}

/**
 * Process pending token images and retry fetching
 */
export async function processPendingTokenImages({
  context,
  chainId,
  timestamp,
}: {
  context: Context;
  chainId: bigint;
  timestamp: number;
}) {
  // Fetch existing blob
  const existing = await context.db.find(pendingTokenImages, { chainId });

  if (!existing) return;

  const blob: PendingTokensBlob = existing ? existing.tokens as PendingTokensBlob : {};
  const updatedBlob: PendingTokensBlob = { ...blob };
  const tokensToProcess: Address[] = [];

  // Only process tokens that haven't been retried recently (5 minute cooldown)
  const cooldownPeriod = 5 * 60; // 5 minutes in seconds

  for (const [address, info] of Object.entries(blob)) {
    const shouldRetry = !info.lastRetryAt ||
      (timestamp - info.lastRetryAt) > cooldownPeriod;

    if (shouldRetry && info.retryCount < 10) { // Max 10 retries
      tokensToProcess.push(address as Address);
    } else if (info.retryCount >= 10) {
      // Remove tokens that have failed too many times
      delete updatedBlob[address as Address];
    }
  }

  // Update retry metadata for tokens we're about to process
  for (const address of tokensToProcess) {
    updatedBlob[address]!.lastRetryAt = timestamp;
    updatedBlob[address]!.retryCount += 1;
  }

  // Update the blob with retry metadata
  await context.db
    .update(pendingTokenImages, { chainId })
    .set({ tokens: updatedBlob });

  return { tokensToProcess, blob: updatedBlob };
}