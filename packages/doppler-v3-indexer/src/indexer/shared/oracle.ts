import { ethPrice } from "ponder.schema";
import { Context } from "ponder:registry";
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

export const computeMarketCap = ({
  price,
  ethPrice,
  totalSupply,
}: {
  price: bigint;
  ethPrice: bigint;
  totalSupply: bigint;
}) => {
  return MarketDataService.calculateMarketCap({
    price,
    totalSupply,
    ethPriceUSD: ethPrice,
    assetDecimals: 18,
    isQuoteETH: true,
  });
};
