import { Address } from "viem";
import { Context } from "ponder:registry";
import { UniswapV3InitializerABI, UniswapV3PoolABI } from "@app/abis";
import { addresses } from "@app/types/addresses";
import { computeV3Price } from "./computeV3Price";

type PoolState = {
  asset: Address;
  numeraire: Address;
  tickLower: number;
  tickUpper: number;
  numPositions: number;
  isInitialized: boolean;
  isExited: boolean;
  maxShareToBeSold: bigint;
  maxShareToBond: bigint;
  initializer: Address;
};

export type V3PoolData = {
  slot0Data: {
    sqrtPrice: bigint;
    tick: number;
  };
  liquidity: bigint;
  token0: Address;
  token1: Address;
  price: bigint;
  poolState: PoolState;
};

export const getV3PoolData = async ({
  address,
  context,
}: {
  address: Address;
  context: Context;
}): Promise<V3PoolData> => {
  const { client, db } = context;

  const [slot0, liquidity, token0, token1] = await client.multicall({
    contracts: [
      {
        abi: UniswapV3PoolABI,
        address,
        functionName: "slot0",
      },
      {
        abi: UniswapV3PoolABI,
        address,
        functionName: "liquidity",
      },
      {
        abi: UniswapV3PoolABI,
        address,
        functionName: "token0",
      },
      {
        abi: UniswapV3PoolABI,
        address,
        functionName: "token1",
      },
    ],
  });

  const poolState = await getPoolState({
    poolAddress: address,
    context,
  });

  const slot0Data = {
    sqrtPrice: slot0.result?.[0] ?? 0n,
    tick: slot0.result?.[1] ?? 0,
  };

  const price = await computeV3Price({
    sqrtPriceX96: slot0Data.sqrtPrice,
    baseToken: poolState.asset,
    context,
    poolAddress: address,
  });

  const liquidityResult = liquidity?.result ?? 0n;

  const token0Result = token0?.result ?? "0x";
  const token1Result = token1?.result ?? "0x";

  return {
    slot0Data,
    liquidity: liquidityResult,
    token0: token0Result,
    token1: token1Result,
    poolState,
    price,
  };
};

const getPoolState = async ({
  poolAddress,
  context,
}: {
  poolAddress: Address;
  context: Context;
}) => {
  const { client, db } = context;
  const { v3Initializer } = addresses.v3;

  const poolData = await client.readContract({
    abi: UniswapV3InitializerABI,
    address: v3Initializer,
    functionName: "getState",
    args: [poolAddress],
  });

  const poolState: PoolState = {
    asset: poolData[0],
    numeraire: poolData[1],
    tickLower: poolData[2],
    tickUpper: poolData[3],
    numPositions: poolData[4],
    isInitialized: poolData[5],
    isExited: poolData[6],
    maxShareToBeSold: poolData[7],
    maxShareToBond: poolData[8],
    initializer: v3Initializer,
  };

  return poolState;
};
