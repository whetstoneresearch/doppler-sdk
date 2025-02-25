import { Context } from "ponder:registry";
import { token } from "ponder.schema";
import { Address, zeroAddress } from "viem";
import { DERC20ABI } from "@app/abis";

export const insertTokenIfNotExists = async ({
  tokenAddress,
  timestamp,
  context,
  isDerc20 = false,
  poolAddress,
}: {
  tokenAddress: Address;
  timestamp: bigint;
  context: Context;
  isDerc20?: boolean;
  poolAddress?: Address;
}) => {
  const { db, network } = context;
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

  const chainId = BigInt(network.chainId);

  // ignore pool field for native tokens
  if (address === zeroAddress) {
    return await db.insert(token).values({
      address: address.toLowerCase() as `0x${string}`,
      chainId,
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
      firstSeenAt: timestamp,
      lastSeenAt: timestamp,
      totalSupply: 0n,
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
    });

    const tokenURI = tokenURIResult?.result;
    let image: string | undefined;
    if (tokenURI?.startsWith("ipfs://")) {
      try {
        const cid = tokenURI.replace("ipfs://", "");
        const url = `https://${process.env.PINATA_GATEWAY_URL}/ipfs/${cid}?pinataGatewayToken=${process.env.PINATA_GATEWAY_KEY}`;
        const response = await fetch(url);
        const data = await response.json();

        if (
          data &&
          typeof data === "object" &&
          "image" in data &&
          typeof data.image === "string"
        ) {
          if (data.image.startsWith("ipfs://")) {
            image = data.image;
          }
        }
      } catch (error) {
        console.error(
          `Failed to fetch IPFS metadata for token ${address}:`,
          error
        );
      }
    }

    return await context.db
      .insert(token)
      .values({
        address: address.toLowerCase() as `0x${string}`,
        chainId,
        name: nameResult?.result ?? `Unknown Token (${address})`,
        symbol: symbolResult?.result ?? "???",
        decimals: decimalsResult.result ?? 18,
        totalSupply: totalSupplyResult.result ?? 0n,
        firstSeenAt: timestamp,
        lastSeenAt: timestamp,
        isDerc20,
        image,
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

