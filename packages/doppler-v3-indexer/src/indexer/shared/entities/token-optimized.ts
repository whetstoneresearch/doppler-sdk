import { Context } from "ponder:registry";
import { token } from "ponder:schema";
import { Address, zeroAddress } from "viem";
import { DERC20ABI } from "@app/abis";
import { getMulticallOptions } from "@app/core/utils";
import { chainConfigs } from "@app/config";

/**
 * Optimized version that combines insert and update in a single operation
 */
export const upsertTokenWithPool = async ({
  tokenAddress,
  isDerc20,
  isCreatorCoin,
  isContentCoin,
  poolAddress,
  context,
  creatorCoinPid,
  creatorAddress,
  timestamp,
}: {
  tokenAddress: Address;
  isDerc20: boolean;
  isCreatorCoin: boolean;
  isContentCoin: boolean;
  context: Context;
  creatorCoinPid: Address | null;
  creatorAddress: Address;
  timestamp: bigint;
  poolAddress: `0x${string}` | null;
}): Promise<typeof token.$inferSelect> => {
  const { db, chain, client } = context;
  const address = tokenAddress.toLowerCase() as `0x${string}`;

  const wethAddress = chainConfigs[chain.name]?.addresses?.shared?.weth;
  const zoraAddress = chainConfigs[chain.name]?.addresses?.zora?.zoraToken;

  let tokenData: Partial<typeof token.$inferInsert> = {
    address,
    chainId: chain.id,
    isDerc20,
    isCreatorCoin,
    isContentCoin,
    pool: poolAddress,
    creatorCoinPid,
    creatorAddress,
    firstSeenAt: timestamp,
    lastSeenAt: timestamp,
  };

  if (
    address === zeroAddress ||
    (wethAddress && address === wethAddress.toLowerCase())
  ) {
    tokenData = {
      ...tokenData,
      name: address === zeroAddress ? "Ethereum" : "Wrapped Ether",
      symbol: address === zeroAddress ? "ETH" : "WETH",
      decimals: 18,
      totalSupply: 0n,
    };
  } else if (zoraAddress && address === zoraAddress.toLowerCase()) {
    tokenData = {
      ...tokenData,
      name: "Zora",
      symbol: "ZORA",
      decimals: 18,
      totalSupply: 1_000_000_000n,
    };
  } else {
    // Fetch token metadata for regular tokens
    const multicallOptions = getMulticallOptions(chain);
    const [nameResult, symbolResult, decimalsResult, totalSupplyResult, tokenURIResult] =
      await client.multicall({
        contracts: [
          { abi: DERC20ABI, address, functionName: "name" },
          { abi: DERC20ABI, address, functionName: "symbol" },
          { abi: DERC20ABI, address, functionName: "decimals" },
          { abi: DERC20ABI, address, functionName: "totalSupply" },
          { abi: DERC20ABI, address, functionName: "tokenURI" },
        ],
        ...multicallOptions,
      });

    tokenData = {
      ...tokenData,
      name: nameResult?.result ?? `Unknown Token (${address})`,
      symbol: symbolResult?.result ?? "???",
      decimals: decimalsResult?.result ?? 18,
      totalSupply: totalSupplyResult?.result ?? 0n,
      derc20Data: isDerc20 ? address : undefined,
      tokenUri: tokenURIResult?.result ?? "",
    };

    if (process.env.NODE_ENV !== "local") {
      void fetch(
        `${process.env.METADATA_UPDATER_ENDPOINT}?tokenAddress=${address}&chainId=${chain.id}`
      );
    }
  }

  if (poolAddress) {
    return await db
      .insert(token)
      .values(tokenData as typeof token.$inferInsert)
      .onConflictDoUpdate((existing) => ({
        pool: poolAddress,
        isDerc20,
        isCreatorCoin,
        isContentCoin,
        creatorCoinPid,
        lastSeenAt: timestamp,
        // Keep existing totalSupply if it's already set
        totalSupply: existing.totalSupply || tokenData.totalSupply,
      }));
  } else {
    return await db
      .insert(token)
      .values(tokenData as typeof token.$inferInsert)
      .onConflictDoUpdate(() => ({
        lastSeenAt: timestamp,
      }));
  }
};
