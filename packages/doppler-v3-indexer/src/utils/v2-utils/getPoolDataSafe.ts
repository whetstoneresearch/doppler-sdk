import { UniswapV2PairABI, UniswapV3PoolABI, DERC20ABI } from "@app/abis";
import { Context } from "ponder:registry";
import { Hex } from "viem";
import { getMulticallOptions } from "@app/core/utils";

export const getPoolDataSafe = async ({
  address,
  context,
}: {
  address: Hex;
  context: Context;
}) => {
  const { client, chain } = context;

  // First, try to determine if it's a V2 or V3 pool by checking for V3-specific functions
  try {
    const multicallOptions = getMulticallOptions(chain);
    
    // Try to call V3-specific functions
    const [slot0Result] = await client.multicall({
      contracts: [
        {
          abi: UniswapV3PoolABI,
          address: address,
          functionName: "slot0",
        },
      ],
      ...multicallOptions,
    });

    if (slot0Result.result) {
      // This is a V3 pool, get reserves by reading token balances
      const [token0Result, token1Result] = await client.multicall({
        contracts: [
          {
            abi: UniswapV3PoolABI,
            address: address,
            functionName: "token0",
          },
          {
            abi: UniswapV3PoolABI,
            address: address,
            functionName: "token1",
          },
        ],
        ...multicallOptions,
      });

      const token0 = token0Result.result;
      const token1 = token1Result.result;

      if (token0 && token1) {
        // Get balances of tokens in the pool
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
          ...multicallOptions,
        });

        return {
          reserve0: r0.result ?? 0n,
          reserve1: r1.result ?? 0n,
          isV3: true,
        };
      }
    }
  } catch (e) {
    // If V3 call fails, try V2
  }

  // Try V2 pool getReserves
  try {
    const reserves = await client.readContract({
      abi: UniswapV2PairABI,
      address: address,
      functionName: "getReserves",
    });

    return {
      reserve0: reserves[0],
      reserve1: reserves[1],
      isV3: false,
    };
  } catch (e) {
    // If both fail, return zero reserves
    console.error(`Failed to get pool data for ${address}:`, e);
    return {
      reserve0: 0n,
      reserve1: 0n,
      isV3: undefined,
    };
  }
};