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
): Promise<bigint> => {
  const { db } = context;

  let roundedTimestamp = BigInt(Math.floor(Number(timestamp) / 300) * 300);

  let ethPriceData;
  while (!ethPriceData) {
    ethPriceData = await db.find(ethPrice, {
      timestamp: roundedTimestamp,
    });

    if (!ethPriceData) {
      roundedTimestamp -= 300n;
    }
  }

  return ethPriceData.price;
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

export const computeMarketCap = ({
  price,
  ethPrice,
  totalSupply,
}: {
  price: bigint;
  ethPrice: bigint;
  totalSupply: bigint;
}) => {
  const marketCap = (price * totalSupply) / BigInt(10 ** 18);
  const marketCapUsd = (marketCap * ethPrice) / CHAINLINK_ETH_DECIMALS;

  return marketCapUsd;
};
