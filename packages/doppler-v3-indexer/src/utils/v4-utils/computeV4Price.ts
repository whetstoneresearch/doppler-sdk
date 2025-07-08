import { PriceService } from "@app/core/pricing";
import { TickMath } from "@uniswap/v3-sdk";

export const computeV4Price = ({
  isToken0,
  currentTick,
  baseTokenDecimals,
}: {
  isToken0: boolean;
  currentTick: number;
  baseTokenDecimals: number;
}) => {
  const sqrtPriceX96 = BigInt(
    TickMath.getSqrtRatioAtTick(currentTick).toString()
  );

  return PriceService.computePriceFromSqrtPriceX96({
    sqrtPriceX96,
    isToken0,
    decimals: baseTokenDecimals,
  });
};

export const computeV4PriceFromSqrtPriceX96 = ({
  isToken0,
  sqrtPriceX96,
  baseTokenDecimals,
}: {
  isToken0: boolean;
  sqrtPriceX96: bigint;
  baseTokenDecimals: number;
}) => {
  return PriceService.computePriceFromSqrtPriceX96({
    sqrtPriceX96,
    isToken0,
    decimals: baseTokenDecimals,
  });
};
