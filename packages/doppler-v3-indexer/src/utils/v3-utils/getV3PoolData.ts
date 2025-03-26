import { Address } from "viem";
import { Context } from "ponder:registry";
import {
  DERC20ABI,
  UniswapV3InitializerABI,
  UniswapV3PoolABI,
} from "@app/abis";
import { configs } from "addresses";
import { computeV3Price } from "./computeV3Price";

export type PoolState = {
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
  poolState: PoolState;
  price: bigint;
  fee: number;
  reserve0: bigint;
  reserve1: bigint;
};

export const getV3PoolData = async ({
  address,
  context,
}: {
  address: Address;
  context: Context;
}): Promise<V3PoolData> => {
  const { client, network } = context;

  let multiCallAddress = {};
  if (network.name == "ink") {
    multiCallAddress = {
      multicallAddress: "0xcA11bde05977b3631167028862bE2a173976CA11",
    };
  }

  const [slot0, liquidity, token0, token1, fee] = await client.multicall({
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
      {
        abi: UniswapV3PoolABI,
        address,
        functionName: "fee",
      },
    ],
    ...multiCallAddress,
  });

  const poolState = await getPoolState({
    poolAddress: address,
    context,
  });

  const slot0Data = {
    sqrtPrice: slot0.result?.[0] ?? 0n,
    tick: slot0.result?.[1] ?? 0,
  };

  const liquidityResult = liquidity?.result ?? 0n;

  const token0Result = token0?.result ?? "0x";
  const token1Result = token1?.result ?? "0x";
  const feeResult = fee?.result ?? 10_000;

  const { reserve0, reserve1 } = await getV3PoolReserves({
    token0: token0Result,
    token1: token1Result,
    address,
    context,
  });

  const isToken0 = token0Result.toLowerCase() === poolState.asset.toLowerCase();
  const price = await computeV3Price({
    sqrtPriceX96: slot0Data.sqrtPrice,
    baseToken: poolState.asset,
    context,
    isToken0,
  });

  return {
    slot0Data,
    liquidity: liquidityResult,
    token0: token0Result.toLowerCase() as `0x${string}`,
    token1: token1Result.toLowerCase() as `0x${string}`,
    fee: feeResult,
    poolState,
    price,
    reserve0,
    reserve1,
  };
};

export const getV3PoolReserves = async ({
  token0,
  token1,
  address,
  context,
}: {
  token0: Address;
  token1: Address;
  address: Address;
  context: Context;
}) => {
  const { client, network } = context;

  let multiCallAddress = {};
  if (network.name == "ink") {
    multiCallAddress = {
      multicallAddress: "0xcA11bde05977b3631167028862bE2a173976CA11",
    };
  }

  const [r0, r1] = await client.multicall({
    contracts: [
      {
        abi: DERC20ABI,
        address: token0,
        functionName: "balanceOf",
        args: [address],
      },
      {
        abi: DERC20ABI,
        address: token1,
        functionName: "balanceOf",
        args: [address],
      },
    ],
    ...multiCallAddress,
  });

  const reserve0 = r0?.result ?? 0n;
  const reserve1 = r1?.result ?? 0n;

  return {
    reserve0,
    reserve1,
  };
};

const getPoolState = async ({
  poolAddress,
  context,
}: {
  poolAddress: Address;
  context: Context;
}) => {
  const { client } = context;
  const { v3Initializer } = configs[context.network.name].v3;

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
