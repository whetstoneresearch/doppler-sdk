import { UniswapV3InitializerABI } from "@app/abis";
import { SqrtPriceMath, TickMath } from "@uniswap/v3-sdk";
import { poolConfig } from "ponder.schema";
import JSBI from "jsbi";
import { Context } from "ponder:registry";
import { Address } from "viem";
import { addresses } from "@app/types/addresses";

const MIN_TICK = -887222;
const MAX_TICK = 887272;

const getAmount0Delta = async ({
  tickLower,
  tickUpper,
  liquidity,
  roundUp,
}: {
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  roundUp: boolean;
}): Promise<bigint> => {
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

const getAmount1Delta = async ({
  tickLower,
  tickUpper,
  liquidity,
  roundUp,
}: {
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  roundUp: boolean;
}): Promise<bigint> => {
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

export const computeGraduationThresholdDelta = async ({
  tickLower,
  tickUpper,
  liquidity,
  isToken0,
}: {
  poolAddress: Address;
  context: Context;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  isToken0: boolean;
}): Promise<bigint> => {
  if (
    tickLower <= MIN_TICK + 100 ||
    tickLower >= MAX_TICK - 100 ||
    tickUpper <= MIN_TICK + 100 ||
    tickUpper >= MAX_TICK - 100
  ) {
    return 0n;
  }

  const delta = isToken0
    ? await getAmount1Delta({
        tickLower,
        tickUpper,
        liquidity,
        roundUp: true,
      })
    : await getAmount0Delta({ tickLower, tickUpper, liquidity, roundUp: true });

  return delta;
};

export const getPoolConfig = async ({
  poolAddress,
  context,
}: {
  poolAddress: Address;
  context: Context;
}): Promise<{ tickLower: number; tickUpper: number }> => {
  const { v3Initializer } = addresses.v3;

  let cfg;

  const dbCfgData = await context.db.find(poolConfig, {
    pool: poolAddress,
  });

  if (dbCfgData) {
    cfg = { tickLower: dbCfgData.tickLower, tickUpper: dbCfgData.tickUpper };
  } else {
    const cfgData = await context.client.readContract({
      abi: UniswapV3InitializerABI,
      address: v3Initializer,
      functionName: "getState",
      args: [poolAddress],
    });

    cfg = {
      tickLower: cfgData[2],
      tickUpper: cfgData[3],
    };
  }

  return cfg;
};

export const insertPoolConfigIfNotExists = async ({
  poolAddress,
  context,
}: {
  poolAddress: Address;
  context: Context;
}) => {
  const cfg = await getPoolConfig({ poolAddress, context });

  await context.db
    .insert(poolConfig)
    .values({ ...cfg, pool: poolAddress })
    .onConflictDoNothing();

  return cfg;
};
