import { PriceService } from "@app/core/pricing";

export const computeV3Price = ({
  sqrtPriceX96,
  isToken0,
  decimals = 18,
  quoteDecimals = 18,
}: {
  sqrtPriceX96: bigint;
  isToken0: boolean;
  decimals?: number;
  quoteDecimals?: number;
}) => {
  return PriceService.computePriceFromSqrtPriceX96({
    sqrtPriceX96,
    isToken0,
    decimals,
    quoteDecimals,
  });
};
