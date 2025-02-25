import { Address, Hex, zeroAddress } from "viem";
import { Context } from "ponder:registry";
import { DERC20ABI, DopplerABI, StateViewABI } from "@app/abis";
import { configs } from "addresses";
import { PoolKey } from "@app/types/v4-types";
import { getPoolId } from "./getPoolId";
import { computeV4Price } from "./computeV4Price";
import { getAssetData } from "../getAssetData";

export interface Slot0Data {
  sqrtPrice: bigint;
  tick: number;
  protocolFee: number;
  lpFee: number;
}

export interface V4PoolData {
  poolKey: PoolKey;
  slot0Data: Slot0Data;
  liquidity: bigint;
  price: bigint;
}

export const getV4PoolData = async ({
  context,
  hook,
}: {
  context: Context;
  hook: Address;
}): Promise<V4PoolData> => {
  const { stateView } = configs[context.network.name].v4;
  const { client } = context;

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

  console.log("liquidityResult", liquidityResult);

  const assetData0 = await getAssetData(key.currency0, context);

  console.log(slot0);

  const baseToken =
    assetData0.poolInitializer != zeroAddress ? key.currency0 : key.currency1;
  const isToken0 = baseToken === key.currency0;
  const baseTokenDecimals = await context.client.readContract({
    abi: DERC20ABI,
    address: baseToken,
    functionName: "decimals",
  });

  console.log("baseTokenDecimals", baseTokenDecimals);

  const price = await computeV4Price({
    isToken0,
    sqrtPriceX96: slot0Data.sqrtPrice,
    baseTokenDecimals,
  });

  return {
    poolKey: key,
    slot0Data,
    liquidity: liquidityResult,
    price,
  };
};
