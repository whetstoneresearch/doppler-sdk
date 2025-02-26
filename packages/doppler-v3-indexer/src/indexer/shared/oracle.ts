import { ethPrice } from "ponder.schema";
import { Context } from "ponder:registry";
import { and, gte, lte } from "drizzle-orm";
import { Address } from "viem";
import { CHAINLINK_ETH_DECIMALS } from "@app/utils/constants";
import { updateAsset } from "./entities/asset";
import { DERC20ABI } from "@app/abis";
export const fetchEthPrice = async (
  timestamp: bigint,
  context: Context
): Promise<bigint | null> => {
  const { db } = context;
  const priceObj = await db.sql.query.ethPrice.findFirst({
    where: and(
      gte(ethPrice.timestamp, timestamp - 10n * 60n),
      lte(ethPrice.timestamp, timestamp)
    ),
  });

  if (!priceObj) {
    console.error("No price found for timestamp", timestamp);
    return null;
  }

  return priceObj.price;
};

export const updateMarketCap = async ({
  assetAddress,
  price,
  ethPrice,
  context,
}: {
  assetAddress: Address;
  price: bigint;
  ethPrice: bigint;
  context: Context;
}) => {
  const { client } = context;


  const totalSupply = await client.readContract({
    address: assetAddress,
    abi: DERC20ABI,
    functionName: "totalSupply",
  });

  const marketCap = (price * totalSupply) / BigInt(10 ** 18);
  const marketCapUsd = (marketCap * ethPrice) / CHAINLINK_ETH_DECIMALS;

  await updateAsset({
    assetAddress,
    context,
    update: {
      marketCapUsd,
    },
  });
};
