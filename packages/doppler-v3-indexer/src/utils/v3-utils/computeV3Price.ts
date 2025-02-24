import { Address } from "viem";
import { DERC20ABI } from "@app/abis";
import { Context } from "ponder:registry";
import { Q192 } from "@app/utils/constants";

export const computeV3Price = async ({
  sqrtPriceX96,
  baseToken,
  context,
  isToken0,
}: {
  sqrtPriceX96: bigint;
  baseToken: Address;
  context: Context;
  isToken0: boolean;
}) => {
  const baseTokenDecimals = await context.client.readContract({
    abi: DERC20ABI,
    address: baseToken,
    functionName: "decimals",
  });

  const ratioX192 = sqrtPriceX96 * sqrtPriceX96;

  const baseTokenDecimalScale = 10 ** baseTokenDecimals;

  const price = isToken0
    ? (ratioX192 * BigInt(baseTokenDecimalScale)) / Q192
    : (Q192 * BigInt(baseTokenDecimalScale)) / ratioX192;

  return price;
};
