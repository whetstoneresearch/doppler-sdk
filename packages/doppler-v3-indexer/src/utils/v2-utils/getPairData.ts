import { UniswapV2PairABI } from "@app/abis";
import { Context } from "ponder:registry";
import { Hex } from "viem";

export const getPairData = async ({
  address,
  context,
}: {
  address: Hex;
  context: Context;
}) => {
  const { client } = context;

  const reserves = await client.readContract({
    abi: UniswapV2PairABI,
    address: address,
    functionName: "getReserves",
  });

  const reserve0 = reserves[0];
  const reserve1 = reserves[1];

  return {
    reserve0,
    reserve1,
  };
};
