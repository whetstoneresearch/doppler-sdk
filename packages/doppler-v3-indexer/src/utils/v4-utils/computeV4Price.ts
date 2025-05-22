import { Address, zeroAddress } from "viem";
import { DERC20ABI, DopplerABI } from "@app/abis";
import { Context } from "ponder:registry";
import { Q192 } from "@app/utils/constants";
import { getV4PoolData, getPoolId } from "@app/utils/v4-utils";
import { getAssetData } from "@app/utils/getAssetData";
import { PoolKey } from "@app/types/v4-types";
import { configs } from "addresses";
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
  const ratioX192 = sqrtPriceX96 * sqrtPriceX96;
  const baseTokenDecimalScale = 10 ** baseTokenDecimals;

  const price = isToken0
    ? (ratioX192 * BigInt(baseTokenDecimalScale)) / Q192
    : (Q192 * BigInt(baseTokenDecimalScale)) / ratioX192;

  return price;
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
  const ratioX192 = sqrtPriceX96 * sqrtPriceX96;
  const baseTokenDecimalScale = 10 ** baseTokenDecimals;

  const price = isToken0
    ? (ratioX192 * BigInt(baseTokenDecimalScale)) / Q192
    : (Q192 * BigInt(baseTokenDecimalScale)) / ratioX192;

  return price;
};
