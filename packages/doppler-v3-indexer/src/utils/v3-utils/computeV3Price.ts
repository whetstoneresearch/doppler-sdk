import { PriceService } from "@app/core/pricing";

export const computeV3Price = ({
  sqrtPriceX96,
  isToken0,
  decimals,
}: {
  sqrtPriceX96: bigint;
  isToken0: boolean;
  decimals: number;
}) => {
  return PriceService.computePriceFromSqrtPriceX96({
    sqrtPriceX96,
    isToken0,
    decimals,
  });
};
