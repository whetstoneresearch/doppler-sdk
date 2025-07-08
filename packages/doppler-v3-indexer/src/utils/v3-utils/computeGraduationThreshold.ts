import { SqrtPriceMath, TickMath } from "@uniswap/v3-sdk";
import JSBI from "jsbi";

const MIN_TICK = -887222;
const MAX_TICK = 887272;

export const getAmount0Delta = ({
  tickLower,
  tickUpper,
  liquidity,
  roundUp,
}: {
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  roundUp: boolean;
}): bigint => {
  const sqrtPriceA = TickMath.getSqrtRatioAtTick(tickLower);
  const sqrtPriceB = TickMath.getSqrtRatioAtTick(tickUpper);

  const amount0Delta = SqrtPriceMath.getAmount0Delta(
    sqrtPriceA,
    sqrtPriceB,
    JSBI.BigInt(liquidity.toString()),
    roundUp
  );

  return BigInt(amount0Delta.toString());
};

export const getAmount1Delta = ({
  tickLower,
  tickUpper,
  liquidity,
  roundUp,
}: {
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  roundUp: boolean;
}): bigint => {
  const sqrtPriceA = TickMath.getSqrtRatioAtTick(tickLower);
  const sqrtPriceB = TickMath.getSqrtRatioAtTick(tickUpper);

  const amount1Delta = SqrtPriceMath.getAmount1Delta(
    sqrtPriceA,
    sqrtPriceB,
    JSBI.BigInt(liquidity.toString()),
    roundUp
  );

  return BigInt(amount1Delta.toString());
};

export const computeGraduationThresholdDelta = ({
  tickLower,
  tickUpper,
  liquidity,
  isToken0,
}: {
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  isToken0: boolean;
}): bigint => {
  if (
    tickLower <= MIN_TICK + 100 ||
    tickLower >= MAX_TICK - 100 ||
    tickUpper <= MIN_TICK + 100 ||
    tickUpper >= MAX_TICK - 100
  ) {
    return 0n;
  }

  const delta = isToken0
    ? getAmount1Delta({
        tickLower,
        tickUpper,
        liquidity,
        roundUp: true,
      })
    : getAmount0Delta({ tickLower, tickUpper, liquidity, roundUp: true });

  return delta;
};
