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
  const { db } = context;

  const existingToken = await db.find(token, {
    address: tokenAddress,
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
  } else if (address == zoraAddress.toLowerCase()) {
    fetch(`${process.env.METADATA_UPDATER_ENDPOINT}?tokenAddress=${address}`) as unknown;
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
    fetch(`${process.env.METADATA_UPDATER_ENDPOINT}?tokenAddress=${address}`) as unknown;

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
        tokenURI,
        isDerc20,
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
  fetch(`${process.env.METADATA_UPDATER_ENDPOINT}?tokenAddress=${address}`) as unknown;

  return await db
    .update(token, {
      address,
    })
    .set(update);
};
