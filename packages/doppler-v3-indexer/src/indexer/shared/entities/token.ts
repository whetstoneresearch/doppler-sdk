import { DERC20ABI } from "@app/abis";
import { chainConfigs } from "@app/config";
import { getMulticallOptions } from "@app/core/utils/multicall";
import { token } from "ponder.schema";
import { Context } from "ponder:registry";
import { Address, zeroAddress } from "viem";

export const appendTokenPool = async ({
  tokenAddress,
  isDerc20,
  isCreatorCoin,
  isContentCoin,
  poolAddress,
  context,
  creatorCoinPid = null,
  creatorAddress = zeroAddress,
}: {
  tokenAddress: Address;
  isDerc20: boolean;
  isCreatorCoin: boolean;
  isContentCoin: boolean;
  poolAddress: Address;
  context: Context;
  creatorCoinPid?: Address | null;
  creatorAddress?: Address;
}) => {
  const { db, chain } = context;

  const existingToken = await db.find(token, {
    address: tokenAddress,
    chainId: chain.id,
  });

  if (!existingToken) {
    await insertTokenIfNotExists({
      tokenAddress,
      creatorAddress,
      timestamp: BigInt(context.chain.id),
      context,
      poolAddress,
    });
  }

  return await db
    .update(token, {
      address: tokenAddress,
      chainId: chain.id,
    })
    .set({
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
    chainId: chain.id,
  });

  if (existingToken?.isDerc20 && !existingToken?.pool && poolAddress) {
    await db.update(token, { address, chainId: chain.id }).set({
      pool: poolAddress,
    });
  } else if (existingToken) {
    return existingToken;
  }

  const zoraAddress = chainConfigs[chain.name].addresses.zora.zoraToken;

  // ignore pool field for native tokens
  if (address == zeroAddress) {
    return await db.insert(token).values({
      address: address.toLowerCase() as `0x${string}`,
      chainId: chain.id,
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
      creatorAddress: zeroAddress,
      firstSeenAt: timestamp,
      lastSeenAt: timestamp,
      totalSupply: 0n,
      isDerc20: false,
    });
  } else if (address == zoraAddress.toLowerCase()) {
    if (process.env.NODE_ENV !== "local") {
      fetch(
        `${process.env.METADATA_UPDATER_ENDPOINT}?tokenAddress=${address}&chainId=${chain.id}`
      ) as unknown;
    }

    return await db.insert(token).values({
      address: address.toLowerCase() as `0x${string}`,
      chainId: chain.id,
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
    const [nameResult, symbolResult, decimalsResult, totalSupplyResult, tokenURIResult] =
      await context.client.multicall({
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
          }
        ],
        ...multicallOptions,
      });

    if (process.env.NODE_ENV !== "local") {
      void fetch(
        `${process.env.METADATA_UPDATER_ENDPOINT}?tokenAddress=${address}&chainId=${chain.id}`
      );
    }

    return await context.db
      .insert(token)
      .values({
        address: address.toLowerCase() as `0x${string}`,
        chainId: chain.id,
        name: nameResult?.result ?? `Unknown Token (${address})`,
        symbol: symbolResult?.result ?? "???",
        decimals: decimalsResult?.result ?? 18,
        totalSupply: totalSupplyResult?.result ?? 0n,
        creatorAddress,
        firstSeenAt: timestamp,
        lastSeenAt: timestamp,
        isDerc20,
        pool: poolAddress,
        derc20Data: isDerc20 ? address : undefined,
        tokenUri: tokenURIResult?.result ?? "",
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
  const { db, chain } = context;

  const address = tokenAddress.toLowerCase() as `0x${string}`;

  return await db
    .update(token, {
      address,
      chainId: chain.id,
    })
    .set(update);
};
