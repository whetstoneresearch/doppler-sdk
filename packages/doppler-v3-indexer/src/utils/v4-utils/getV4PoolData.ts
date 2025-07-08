import { Address, Hex, numberToHex, zeroAddress } from "viem";
import { Context } from "ponder:registry";
import {
  DERC20ABI,
  DopplerABI,
  DopplerLensQuoterABI,
  StateViewABI,
} from "@app/abis";
import {
  PoolKey,
  V4PoolConfig,
  PositionData,
  Slot0Data,
  V4PoolData,
  QuoteExactSingleParams
} from "@app/types/v4-types";
import { getPoolId } from "./getPoolId";
import { computeV4Price } from "./computeV4Price";
import { getAssetData } from "../getAssetData";
import {
  getAmount0Delta,
  getAmount1Delta,
} from "../v3-utils/computeGraduationThreshold";
import { configs } from "addresses";
import { getMulticallOptions } from "@app/core/utils";

export const getV4PoolData = async ({
  hook,
  context,
}: {
  hook: Address;
  context: Context;
}): Promise<V4PoolData> => {
  const { stateView } = configs[context.chain.name].v4;
  const { client, chain } = context;

  const poolConfig = await getV4PoolConfig({ hook, context });

  const poolKey = await client.readContract({
    abi: DopplerABI,
    address: hook,
    functionName: "poolKey",
  });

  const key: PoolKey = {
    currency0: poolKey[0],
    currency1: poolKey[1],
    fee: poolKey[2],
    tickSpacing: poolKey[3],
    hooks: poolKey[4],
  };

  const poolId = getPoolId(key);

  const multicallOptions = getMulticallOptions(chain);

  const [slot0, liquidity] = await client.multicall({
    contracts: [
      {
        abi: StateViewABI,
        address: stateView,
        functionName: "getSlot0",
        args: [poolId],
      },
      {
        abi: StateViewABI,
        address: stateView,
        functionName: "getLiquidity",
        args: [poolId],
      },
    ],
    ...multicallOptions,
  });

  if (!slot0.result?.[3]) {
    console.error("Failed to get slot0 data");
  }

  const slot0Data: Slot0Data = {
    sqrtPrice: slot0.result?.[0] ?? 0n,
    tick: slot0.result?.[1] ?? 0,
    protocolFee: slot0.result?.[2] ?? 0,
    lpFee: slot0.result?.[3] ?? 0,
  };

  const liquidityResult = liquidity?.result ?? 0n;

  const assetData0 = await getAssetData(key.currency0, context);

  const baseToken =
    assetData0.poolInitializer != zeroAddress ? key.currency0 : key.currency1;
  const isToken0 = baseToken === key.currency0;
  const baseTokenDecimals = await context.client.readContract({
    abi: DERC20ABI,
    address: baseToken,
    functionName: "decimals",
  });

  const price = computeV4Price({
    isToken0,
    currentTick: slot0Data.tick,
    baseTokenDecimals,
  });

  return {
    poolKey: key,
    slot0Data,
    liquidity: liquidityResult,
    price,
    poolConfig: poolConfig!,
  };
};

export const getV4PoolConfig = async ({
  hook,
  context,
}: {
  hook: Address;
  context: Context;
}): Promise<V4PoolConfig> => {
  const { client } = context;

  const [
    numTokensToSell,
    minProceeds,
    maxProceeds,
    startingTime,
    endingTime,
    startingTick,
    endingTick,
    epochLength,
    gamma,
    isToken0,
    numPdSlugs,
  ] = await client.multicall({
    contracts: [
      {
        abi: DopplerABI,
        address: hook,
        functionName: "numTokensToSell",
        args: [],
      },
      {
        abi: DopplerABI,
        address: hook,
        functionName: "minimumProceeds",
        args: [],
      },
      {
        abi: DopplerABI,
        address: hook,
        functionName: "maximumProceeds",
      },
      {
        abi: DopplerABI,
        address: hook,
        functionName: "startingTime",
      },
      {
        abi: DopplerABI,
        address: hook,
        functionName: "endingTime",
      },
      {
        abi: DopplerABI,
        address: hook,
        functionName: "startingTick",
        args: [],
      },
      {
        abi: DopplerABI,
        address: hook,
        functionName: "endingTick",
        args: [],
      },
      {
        abi: DopplerABI,
        address: hook,
        functionName: "epochLength",
        args: [],
      },
      {
        abi: DopplerABI,
        address: hook,
        functionName: "gamma",
        args: [],
      },
      {
        abi: DopplerABI,
        address: hook,
        functionName: "isToken0",
        args: [],
      },
      {
        abi: DopplerABI,
        address: hook,
        functionName: "numPDSlugs",
        args: [],
      },
    ],
  });

  return {
    numTokensToSell: numTokensToSell.result!,
    minProceeds: minProceeds.result!,
    maxProceeds: maxProceeds.result!,
    startingTime: startingTime.result!,
    endingTime: endingTime.result!,
    startingTick: startingTick.result!,
    endingTick: endingTick.result!,
    epochLength: epochLength.result!,
    gamma: gamma.result!,
    isToken0: isToken0.result!,
    numPdSlugs: numPdSlugs.result!,
  };
};

export const getReservesV4 = async ({
  hook,
  context,
}: {
  hook: Address;
  context: Context;
}) => {
  const { client } = context;
  const { stateView } = configs[context.chain.name].v4;

  const poolKey = await client.readContract({
    abi: DopplerABI,
    address: hook,
    functionName: "poolKey",
  });

  const key: PoolKey = {
    currency0: poolKey[0],
    currency1: poolKey[1],
    fee: poolKey[2],
    tickSpacing: poolKey[3],
    hooks: poolKey[4],
  };

  const poolId = getPoolId(key);

  const numPdSlugs = await client.readContract({
    abi: DopplerABI,
    address: hook,
    functionName: "numPDSlugs",
    args: [],
  });

  const [, tick] = await client.readContract({
    abi: StateViewABI,
    address: stateView,
    functionName: "getSlot0",
    args: [poolId],
  });

  // create objects like those in the multicall of length numPdSlugs where the arg is the index + 2
  const arr = new Array(numPdSlugs);

  const positionArgs = arr.map((_, i) => {
    return {
      abi: DopplerABI,
      address: hook,
      functionName: "positions",
      args: [numberToHex(i + 3, { size: 32 })],
    };
  });

  const positions = await client.multicall({
    contracts: [
      {
        abi: DopplerABI,
        address: hook,
        functionName: "positions",
        args: [numberToHex(1, { size: 32 })],
      },
      {
        abi: DopplerABI,
        address: hook,
        functionName: "positions",
        args: [numberToHex(2, { size: 32 })],
      },
      ...positionArgs,
    ],
  });

  const positionData: PositionData[] = positions
    .map((position) => {
      if (!position.result || !Array.isArray(position.result)) {
        return;
      }
      const posData = position.result;
      const [tickLower, tickUpper, liquidity] = posData;
      return {
        tickLower: Number(tickLower),
        tickUpper: Number(tickUpper),
        liquidity: liquidity as bigint,
        salt: Number(posData[3]),
      };
    })
    .filter((position) => position !== undefined);

  const reserves = positionData
    .map((position) => {
      const { tickLower, tickUpper, liquidity } = position;

      let amount0;
      let amount1;
      if (tick < tickLower) {
        amount0 = getAmount0Delta({
          tickLower,
          tickUpper,
          liquidity,
          roundUp: false,
        });
      } else if (tick < tickUpper) {
        amount0 = getAmount0Delta({
          tickLower: tick,
          tickUpper,
          liquidity,
          roundUp: false,
        });
      } else {
        amount0 = 0n;
      }

      if (tick < tickLower) {
        amount1 = 0n;
      } else if (tick < tickUpper) {
        amount1 = getAmount1Delta({
          tickLower,
          tickUpper: tick,
          liquidity,
          roundUp: false,
        });
      } else {
        amount1 = getAmount1Delta({
          tickLower,
          tickUpper,
          liquidity,
          roundUp: false,
        });
      }

      return {
        token0Reserve: amount0,
        token1Reserve: amount1,
      };
    })
    .reduce(
      (acc, curr) => {
        return {
          token0Reserve: acc.token0Reserve + curr.token0Reserve,
          token1Reserve: acc.token1Reserve + curr.token1Reserve,
        };
      },
      { token0Reserve: 0n, token1Reserve: 0n }
    );

  return reserves;
};

export const getLatestSqrtPrice = async ({
  isToken0,
  poolKey,
  context,
}: {
  isToken0: boolean;
  poolKey: PoolKey;
  context: Context;
}): Promise<{
  sqrtPriceX96: bigint;
  tick: number;
  amount0: bigint;
  amount1: bigint;
}> => {
  const { client, chain } = context;
  const lensQuoter = configs[chain.name].v4.dopplerLens;

  const input: QuoteExactSingleParams = {
    poolKey,
    zeroForOne: !isToken0,
    exactAmount: 1n,
    hookData: "0x" as Hex,
  };

  const lensQuote = await client.simulateContract({
    abi: DopplerLensQuoterABI,
    address: lensQuoter,
    functionName: "quoteDopplerLensData",
    args: [input],
  });

  const sqrtPriceX96 = lensQuote.result.sqrtPriceX96;
  const tick = lensQuote.result.tick;
  const amount0 = lensQuote.result.amount0;
  const amount1 = lensQuote.result.amount1;

  return { sqrtPriceX96, tick, amount0, amount1 };
};
