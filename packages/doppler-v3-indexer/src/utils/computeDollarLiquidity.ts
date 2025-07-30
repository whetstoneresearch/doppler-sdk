import { MarketDataService } from "@app/core";
import { CHAINLINK_ETH_DECIMALS } from "./constants";

export const computeDollarLiquidity = ({
  assetBalance,
  quoteBalance,
  price,
  ethPrice,
  decimals = 8,
}: {
  assetBalance: bigint;
  quoteBalance: bigint;
  price: bigint;
  ethPrice: bigint;
  decimals?: number;
}) => {
  return MarketDataService.calculateLiquidity({
    assetBalance,
    quoteBalance,
    price,
    ethPriceUSD: ethPrice,
    isQuoteETH: true,
    decimals,
  });
};
