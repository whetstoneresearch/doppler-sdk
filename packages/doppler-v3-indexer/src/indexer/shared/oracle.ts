import { ethPrice, zoraUsdcPrice } from "ponder.schema";
import { Context } from "ponder:registry";
import { MarketDataService } from "@app/core";

export const fetchEthPrice = async (
  timestamp: bigint,
  context: Context
): Promise<bigint> => {
  const { db, chain } = context;
  let roundedTimestamp = BigInt(Math.floor(Number(timestamp) / 300) * 300);

  let ethPriceData;
  let i = 0;
  while (!ethPriceData) {
    i++;
    ethPriceData = await db.find(ethPrice, {
      timestamp: roundedTimestamp,
      chainId: chain.id,
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
  const { db, chain } = context;

  let roundedTimestamp = BigInt(Math.floor(Number(timestamp) / 300) * 300);

  let zoraPriceData;
  while (!zoraPriceData) {
    zoraPriceData = await db.find(zoraUsdcPrice, {
      timestamp: roundedTimestamp,
      chainId: chain.id,
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
  decimals,
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
    decimals,
  });
};
