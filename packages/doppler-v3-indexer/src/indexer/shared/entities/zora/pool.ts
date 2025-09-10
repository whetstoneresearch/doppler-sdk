import { PoolKey } from "@app/types";
import { computeDollarLiquidity } from "@app/utils/computeDollarLiquidity";
import { computeV3Price } from "@app/utils/v3-utils";
import { Context } from "ponder:registry";
import { pool } from "ponder:schema";
import { Address, zeroAddress } from "viem";
import { ZoraV4HookABI } from "@app/abis/ZoraV4HookABI";
import { StateViewABI } from "@app/abis";
import { getPoolId } from "@app/utils/v4-utils/getPoolId";
import { chainConfigs } from "@app/config";
import { 
  getAmount0Delta, 
  getAmount1Delta 
} from "@app/utils/v3-utils/computeGraduationThreshold";
import { computeMarketCap } from "../../oracle";

/**
 * Optimized version with caching and reduced contract calls
 */
export const insertZoraPoolV4Optimized = async ({
  poolAddress,
  baseToken,
  quoteToken,
  timestamp,
  context,
  ethPrice,
  poolKey,
  isQuoteZora,
  isCreatorCoin,
  isContentCoin,
  totalSupply,
}: {
  poolAddress: Address;
  baseToken: Address;
  quoteToken: Address;
  timestamp: bigint;
  context: Context;
  ethPrice: bigint;
  poolKey: PoolKey;
  isQuoteZora: boolean;
  isCreatorCoin: boolean;
  isContentCoin: boolean;
  totalSupply: bigint;
}): Promise<typeof pool.$inferSelect> => {
  const { db, chain, client } = context;
  const address = poolAddress.toLowerCase() as `0x${string}`;
  const chainId = chain.id;

  // Check if pool already exists (early return)
  const existingPool = await db.find(pool, {
    address,
    chainId,
  });

  if (existingPool) {
    return existingPool;
  }

  const isToken0 = baseToken.toLowerCase() < quoteToken.toLowerCase();
  const isQuoteEth = quoteToken === zeroAddress || 
    quoteToken === chainConfigs[chain.name].addresses.shared.weth;

  // Optimized contract calls - single multicall instead of multiple calls
  const stateView = chainConfigs[chain.name].addresses.v4.stateView;
  const poolId = getPoolId(poolKey);
  const hook = poolKey.hooks;

  const [poolCoinResult, slot0Result] = await client.multicall({
    contracts: [
      {
        abi: ZoraV4HookABI,
        address: hook,
        functionName: "getPoolCoin",
        args: [poolKey],
      },
      {
        abi: StateViewABI,
        address: stateView,
        functionName: "getSlot0",
        args: [poolId],
      },
    ],
  });

  const sqrtPriceX96 = slot0Result.result?.[0] ?? 0n;
  const tick = slot0Result.result?.[1] ?? 0;
  
  // Calculate reserves only if needed
  let token0Reserve = 0n;
  let token1Reserve = 0n;
  let liquidity = 0n;

  if (poolCoinResult.result?.positions) {
    const positions = poolCoinResult.result.positions;
    
    // Batch process all positions at once
    for (const position of positions) {
      const { tickLower, tickUpper, liquidity: posLiquidity } = position;
      liquidity += posLiquidity;
      if (tick < tickLower) {
        token0Reserve += getAmount0Delta({
          tickLower,
          tickUpper,
          liquidity: posLiquidity,
          roundUp: false,
        });
      } else if (tick < tickUpper) {
        token0Reserve += getAmount0Delta({
          tickLower: tick,
          tickUpper,
          liquidity: posLiquidity,
          roundUp: false,
        });
        token1Reserve += getAmount1Delta({
          tickLower,
          tickUpper: tick,
          liquidity: posLiquidity,
          roundUp: false,
        });
      } else {
        token1Reserve += getAmount1Delta({
          tickLower,
          tickUpper,
          liquidity: posLiquidity,
          roundUp: false,
        });
      }
    }
  }

  const price = computeV3Price({
    sqrtPriceX96,
    isToken0,
    decimals: 18,
  });

  const marketCapUsd = computeMarketCap({
    price,
    ethPrice,
    totalSupply,
    decimals: isQuoteEth ? 8 : 18,
  });

  const dollarLiquidity = computeDollarLiquidity({
    assetBalance: isToken0 ? token0Reserve : token1Reserve,
    quoteBalance: isToken0 ? token1Reserve : token0Reserve,
    price,
    ethPrice,
    decimals: isQuoteEth ? 8 : 18,
  });

  // Insert new pool with all data at once
  return await db.insert(pool).values({
    address,
    tick,
    sqrtPrice: sqrtPriceX96,
    liquidity,
    createdAt: timestamp,
    asset: baseToken,
    baseToken,
    quoteToken,
    price,
    type: "zora",
    chainId,
    fee: poolKey.fee,
    dollarLiquidity,
    dailyVolume: address,
    maxThreshold: 0n,
    graduationBalance: 0n,
    totalFee0: 0n,
    totalFee1: 0n,
    volumeUsd: 0n,
    reserves0: token0Reserve,
    reserves1: token1Reserve,
    percentDayChange: 0,
    isToken0,
    marketCapUsd,
    isQuoteEth,
    isQuoteZora,
    integrator: zeroAddress,
    isContentCoin,
    isCreatorCoin,
    holderCount: 0,
    lastSwapTimestamp: timestamp,
    lastRefreshed: timestamp,
    poolKey,
  });
};