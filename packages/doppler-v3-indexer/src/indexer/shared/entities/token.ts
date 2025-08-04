import { DERC20ABI } from "@app/abis";
import { getMulticallOptions } from "@app/core/utils/multicall";
import { token } from "ponder.schema";
import { Context } from "ponder:registry";
import { Address, zeroAddress } from "viem";

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
  } else {
    const [
      nameResult,
      symbolResult,
      decimalsResult,
      totalSupplyResult,
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
      ],
      ...multicallOptions,
    });


    const dbResponse = await context.db
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
        pool: isDerc20 ? poolAddress : undefined,
        derc20Data: isDerc20 ? address : undefined,
      })
      .onConflictDoUpdate((row) => ({
        pool: row.pool,
      }));
      fetch(`${process.env.METADATA_UPDATER_ENDPOINT}?tokenAddress=${address}`) as unknown;

      return dbResponse;
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

  const dbResponse = await db
    .update(token, {
      address,
    })
    .set(update);

  fetch(`${process.env.METADATA_UPDATER_ENDPOINT}?tokenAddress=${address}`) as unknown;

  return dbResponse;
};
