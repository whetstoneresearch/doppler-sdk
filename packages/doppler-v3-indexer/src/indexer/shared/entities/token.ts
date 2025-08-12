import { DERC20ABI } from "@app/abis";
import { token } from "ponder.schema";
import { Context } from "ponder:registry";
import { Address, zeroAddress } from "viem";
import { getMulticallOptions } from "@app/core/utils/multicall";
import { chainConfigs } from "@app/config";

export const appendTokenPool = async ({
  tokenAddress,
  isDerc20,
  isCreatorCoin,
  isContentCoin,
  poolAddress,
  context,
  creatorCoinPid = null,
}: {
  tokenAddress: Address;
  isDerc20: boolean;
  isCreatorCoin: boolean;
  isContentCoin: boolean;
  poolAddress: Address;
  context: Context;
  creatorCoinPid?: Address | null;
}) => {
  const { db } = context;

  const existingToken = await db.find(token, {
    address: tokenAddress,
  });

  if (existingToken) {
    return existingToken;
  }

  return await db.update(token, {
    address: tokenAddress,
  }).set({
    isDerc20,
    isCreatorCoin,
    isContentCoin,
    pool: poolAddress,
    creatorCoinPid,
  });
};

export const insertTokenIfNotExists = async ({
  tokenAddress,
  creatorAddress,
  timestamp,
  context,
  isDerc20 = false,
  poolAddress,
}: {
  tokenAddress: Address;
  creatorAddress: Address;
  timestamp: bigint;
  context: Context;
  isDerc20?: boolean;
  creatorCoin?: boolean;
  contentCoin?: boolean;
  poolAddress?: Address;
}): Promise<typeof token.$inferSelect> => {
  const { db, chain } = context;

  const multicallOptions = getMulticallOptions(chain);
  const address = tokenAddress.toLowerCase() as `0x${string}`;

  const existingToken = await db.find(token, {
    address,
  });

  if (existingToken?.isDerc20 && !existingToken?.pool && poolAddress) {
    await db.update(token, { address }).set({
      pool: poolAddress,
    });
  } else if (existingToken) {
    return existingToken;
  }

  const chainId = BigInt(chain.id);

  const zoraAddress = chainConfigs[chain.name].addresses.zora.zoraToken;

  // ignore pool field for native tokens
  if (address == zeroAddress) {
    return await db.insert(token).values({
      address: address.toLowerCase() as `0x${string}`,
      chainId,
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
      creatorAddress: zeroAddress,
      firstSeenAt: timestamp,
      lastSeenAt: timestamp,
      totalSupply: 0n,
      isDerc20: false,
    });
  } else if (address == zoraAddress) {
    return await db.insert(token).values({
      address: address.toLowerCase() as `0x${string}`,
      chainId,
      name: "Zora",
      symbol: "ZORA",
      decimals: 18,
      creatorAddress: zeroAddress,
      firstSeenAt: timestamp,
      lastSeenAt: timestamp,
      totalSupply: 10000000000000000000000000000n,
      isDerc20: false,
    });
  } else {
    const [
      nameResult,
      symbolResult,
      decimalsResult,
      totalSupplyResult,
      tokenURIResult,
    ] = await context.client.multicall({
      contracts: [
        {
          abi: DERC20ABI,
          address,
          functionName: "name",
        },
        {
          abi: DERC20ABI,
          address,
          functionName: "symbol",
        },
        {
          abi: DERC20ABI,
          address,
          functionName: "decimals",
        },
        {
          abi: DERC20ABI,
          address,
          functionName: "totalSupply",
        },
        {
          abi: DERC20ABI,
          address,
          functionName: "tokenURI",
        },
      ],
      ...multicallOptions,
    });

    const tokenURI = tokenURIResult?.result;
    let tokenUriData;
    let image: string | undefined;
    // if (tokenURI?.startsWith("ipfs://")) {
    //   try {
    //     if (
    //       !tokenURI.startsWith("ipfs://") &&
    //       !tokenURI.startsWith("http://") &&
    //       !tokenURI.startsWith("https://")
    //     ) {
    //       console.error(`Invalid tokenURI for token ${address}: ${tokenURI}`);
    //     }
    //     const cid = tokenURI.replace("ipfs://", "");
    //     const url = `https://${process.env.PINATA_GATEWAY_URL}/ipfs/${cid}?pinataGatewayToken=${process.env.PINATA_GATEWAY_KEY}`;
    //     const response = await fetch(url);
    //     tokenUriData = await response.json();

    //     if (
    //       tokenUriData &&
    //       typeof tokenUriData === "object" &&
    //       "image" in tokenUriData &&
    //       typeof tokenUriData.image === "string"
    //     ) {
    //       if (tokenUriData.image.startsWith("ipfs://")) {
    //         image = tokenUriData.image;
    //       }
    //     } else if (
    //       tokenUriData &&
    //       typeof tokenUriData === "object" &&
    //       "image_hash" in tokenUriData &&
    //       typeof tokenUriData.image_hash === "string"
    //     ) {
    //       if (tokenUriData.image_hash.startsWith("ipfs://")) {
    //         image = tokenUriData.image_hash;
    //       }
    //     }
    //   } catch (error) {
    //     console.error(
    //       `Failed to fetch IPFS metadata for token ${address}:`,
    //       error
    //     );
    //   }
    // } else if (tokenURI?.includes("ohara")) {
    //   try {
    //     const url = tokenURI;
    //     const response = await fetch(url);
    //     tokenUriData = await response.json();

    //     if (
    //       tokenUriData &&
    //       typeof tokenUriData === "object" &&
    //       "image" in tokenUriData &&
    //       typeof tokenUriData.image === "string"
    //     ) {
    //       if (tokenUriData.image.startsWith("https://")) {
    //         image = tokenUriData.image;
    //       }
    //     } else {
    //       // Add to pending list for retry
    //       await addPendingTokenImage({
    //         context,
    //         chainId,
    //         tokenAddress: address,
    //         tokenURI,
    //         timestamp: Number(timestamp),
    //       });
    //     }
    //   } catch (error) {
    //     console.error(
    //       `Failed to fetch ohara metadata for token ${address}:`,
    //       error
    //     );
    //     // Add to pending list for retry
    //     await addPendingTokenImage({
    //       context,
    //       chainId,
    //       tokenAddress: address,
    //       tokenURI,
    //       timestamp: Number(timestamp),
    //     });
    //   }
    // } else if (tokenURI?.includes("https://api.paragraph.com")) {
    //   try {
    //     const response = await fetch(tokenURI);
    //     tokenUriData = await response.json();

    //     if (
    //       tokenUriData &&
    //       typeof tokenUriData === "object" &&
    //       "image" in tokenUriData &&
    //       typeof tokenUriData.image === "string"
    //     ) {
    //       if (tokenUriData.image.startsWith("https://")) {
    //         image = tokenUriData.image;
    //       }
    //     }
    //   } catch (error) {
    //     console.error(
    //       `Failed to fetch Paragraph metadata for token ${address}:`,
    //       error
    //     );
    //   }
    // }

    return await context.db
      .insert(token)
      .values({
        address: address.toLowerCase() as `0x${string}`,
        chainId,
        name: nameResult?.result ?? `Unknown Token (${address})`,
        symbol: symbolResult?.result ?? "???",
        decimals: decimalsResult?.result ?? 18,
        totalSupply: totalSupplyResult?.result ?? 0n,
        creatorAddress,
        firstSeenAt: timestamp,
        lastSeenAt: timestamp,
        isDerc20,
        image,
        tokenUriData,
        pool: isDerc20 ? poolAddress : undefined,
        derc20Data: isDerc20 ? address : undefined,
      })
      .onConflictDoUpdate((row) => ({
        pool: row.pool,
      }));
  }
};

export const updateToken = async ({
  tokenAddress,
  context,
  update,
}: {
  tokenAddress: Address;
  context: Context;
  update: Partial<typeof token.$inferInsert>;
}): Promise<typeof token.$inferSelect> => {
  const { db } = context;

  const address = tokenAddress.toLowerCase() as `0x${string}`;

  return await db
    .update(token, {
      address,
    })
    .set(update);
};
