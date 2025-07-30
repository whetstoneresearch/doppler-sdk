import { ethPrice, zoraUsdcPrice } from "ponder.schema";
import { Context } from "ponder:registry";
import { and, gte, lte } from "drizzle-orm";
import { Address } from "viem";
import { CHAINLINK_ETH_DECIMALS } from "@app/utils/constants";
import { updateAsset } from "./entities/asset";
import { DERC20ABI } from "@app/abis";
import { updatePool } from "./entities/pool";
import { MarketDataService } from "@app/core";

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

export const fetchZoraPrice = async (
  timestamp: bigint,
  context: Context
): Promise<bigint> => {
  const { db } = context;

  let roundedTimestamp = BigInt(Math.floor(Number(timestamp) / 300) * 300);

  let zoraPriceData;
  while (!zoraPriceData) {
    zoraPriceData = await db.find(zoraUsdcPrice, {
      timestamp: roundedTimestamp,
    });

    if (!zoraPriceData) {
      roundedTimestamp -= 300n;
    }
  }

  return zoraPriceData.price;
};

export const computeMarketCap = ({
  price,
  ethPrice,
  totalSupply,
}: {
  price: bigint;
  ethPrice: bigint;
  totalSupply: bigint;
  decimals?: number;
}) => {
  return MarketDataService.calculateMarketCap({
    price,
    totalSupply,
    ethPriceUSD: ethPrice,
    assetDecimals: 18,
    isQuoteETH: true,
    decimals: 18,
  });
};
