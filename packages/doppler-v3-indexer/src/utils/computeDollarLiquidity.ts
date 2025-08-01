import { MarketDataService } from "@app/core";

export const computeDollarLiquidity = ({
  assetBalance,
  quoteBalance,
  price,
  ethPrice,
  decimals,
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
