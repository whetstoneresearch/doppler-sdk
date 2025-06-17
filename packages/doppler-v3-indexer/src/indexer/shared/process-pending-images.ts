import { Context } from "ponder:registry";
import { token } from "ponder.schema";
import { processPendingTokenImages, removePendingTokenImage } from "./pending-token-images";
import type { Address } from "viem";
import { updateToken } from "./entities/token";

/**
 * Block handler that processes pending token images
 */
export async function handlePendingTokenImages({
  context,
  timestamp,
}: {
  context: Context;
  timestamp: number;
}) {
  const { chain, db } = context;
  const chainId = BigInt(chain.id);

  try {
    const result = await processPendingTokenImages({
      context,
      chainId,
      timestamp,
    });

    if (!result) return;

    const { tokensToProcess, blob } = result;

    if (tokensToProcess.length === 0) {
      return;
    }

    console.log(`Processing ${tokensToProcess.length} pending token images on ${chain.name}`);

    // Process each token
    for (const tokenAddress of tokensToProcess) {
      const tokenInfo = blob[tokenAddress];
      if (!tokenInfo) continue;

      try {
        let image: string | undefined;
        let tokenUriData: any = {};

        // Try to fetch the image again
        if (tokenInfo.tokenURI?.includes("ipfs://")) {
          const cid = tokenInfo.tokenURI.replace("ipfs://", "");
          const ipfsUrl = `https://ipfs.io/ipfs/${cid}`;

          try {
            const response = await fetch(ipfsUrl);
            tokenUriData = await response.json();

            if (
              tokenUriData &&
              typeof tokenUriData === "object" &&
              "image_hash" in tokenUriData &&
              typeof tokenUriData.image_hash === "string"
            ) {
              if (tokenUriData.image_hash.startsWith("ipfs://")) {
                image = tokenUriData.image_hash;
              }
            }
          } catch (error) {
            console.error(
              `Retry failed for IPFS metadata for token ${tokenAddress}:`,
              error
            );
            continue; // Skip to next token
          }
        } else if (tokenInfo.tokenURI?.includes("ohara")) {
          try {
            const response = await fetch(tokenInfo.tokenURI);
            tokenUriData = await response.json();

            if (
              tokenUriData &&
              typeof tokenUriData === "object" &&
              "image" in tokenUriData &&
              typeof tokenUriData.image === "string"
            ) {
              if (tokenUriData.image.startsWith("https://")) {
                image = tokenUriData.image;
              }
            }
          } catch (error) {
            console.error(
              `Retry failed for ohara metadata for token ${tokenAddress}:`,
              error
            );
            continue; // Skip to next token
          }
        }

        // If we successfully fetched an image, update the token
        if (image) {
          await updateToken({
            tokenAddress,
            context,
            update: {
              image,
            },
          });

          // Remove from pending list
          await removePendingTokenImage({
            context,
            chainId,
            tokenAddress,
          });

          console.log(`Successfully updated image for token ${tokenAddress}`);
        }
      } catch (error) {
        console.error(`Error processing token ${tokenAddress}:`, error);
      }
    }
  } catch (error) {
    console.error(`Error in handlePendingTokenImages:`, error);
  }
}