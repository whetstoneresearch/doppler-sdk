import { ponder } from "ponder:registry";
import { chainConfigs } from "@app/config/chains";
import { insertSwapIfNotExists } from "./shared/entities/swap";
import { updatePool } from "./shared/entities/pool";
import { updateAsset } from "./shared/entities/asset";
import { fetchEthPrice } from "./shared/oracle";
import { computeV4Price } from "@app/utils/v4-utils/computeV4Price";
import { Address } from "viem";
import { SwapService, SwapOrchestrator } from "@app/core";
import { computeDollarLiquidity } from "@app/utils/computeDollarLiquidity";
import { tryAddActivePool } from "./shared/scheduledJobs";
import { insertTokenIfNotExists } from "./shared/entities/token";
import { CHAINLINK_ETH_DECIMALS } from "@app/utils/constants";
import { position } from "ponder:schema";
import { fetchExistingV4Pool, updateV4Pool } from "./shared/entities/v4pools";
import { insertPositionIfNotExists, updatePosition } from "./shared/entities/position";

// Helper to get V4MigratorHook address for a chain
const getV4MigratorHook = (chainName: string): Address | null => {
  const config = chainConfigs[chainName as keyof typeof chainConfigs];
  if (!config || config.addresses.v4.v4MigratorHook === "0x0000000000000000000000000000000000000000") {
    return null;
  }
  return config.addresses.v4.v4MigratorHook;
};

// Track PoolManager Initialize events for pools created via V4Migrator
// ponder.on("PoolManager:Initialize", async ({ event, context }) => {
//   const { id: poolId, hooks, sqrtPriceX96, tick } = event.args;
//   const { timestamp } = event.block;
//   const { chain } = context;

//   // Get the V4MigratorHook address for this chain
//   const v4MigratorHook = getV4MigratorHook(chain.name);
//   if (!v4MigratorHook) {
//     return; // V4 migrator not configured for this chain
//   }

//   // Only process if this pool uses our migrator hook
//   if (hooks.toLowerCase() !== v4MigratorHook.toLowerCase()) {
//     return; // Not a migrated pool
//   }

//   // Get the existing v4pool entity (should have been created by Airlock:Migrate)
//   let existingV4Pool;
//   try {
//     existingV4Pool = await fetchExistingV4Pool({
//       poolId: poolId,
//       context,
//     });
//   } catch (error) {
//     console.warn(`V4 pool ${poolId} initialized via V4Migrator but not found in database`);
//     return;
//   }

//   // Get ETH price for initial calculations
//   const ethPrice = await fetchEthPrice(timestamp, context);

//   // Calculate the initial price from tick
//   const price = computeV4Price({
//     currentTick: Number(tick),
//     isToken0: existingV4Pool.isToken0,
//     baseTokenDecimals: 18,
//   });

//   // Calculate initial dollar price
//   const dollarPrice = (price * ethPrice) / CHAINLINK_ETH_DECIMALS;

//   // Update the v4pool with initialization data
//   await updateV4Pool({
//     poolId: poolId,
//     context,
//     update: {
//       price: dollarPrice,
//       tick: Number(tick),
//       sqrtPriceX96: sqrtPriceX96,
//       lastRefreshed: timestamp,
//     },
//   });
// });

// Track PoolManager Swap events for migrated pools
// ponder.on("PoolManager:Swap", async ({ event, context }) => {
//   const { id: poolId, sender, amount0, amount1, sqrtPriceX96, liquidity, tick, fee } = event.args;
//   const { timestamp } = event.block;
//   const { hash: txHash, from: txFrom } = event.transaction;
//   const { chain } = context;

//   // Check if this pool was created via migration
//   let v4pool;
//   try {
//     v4pool = await fetchExistingV4Pool({
//       poolId: poolId,
//       context,
//     });
//   } catch (error) {
//     return; // V4 pool not found, skip
//   }

//   if (!v4pool.migratedFromPool) {
//     return; // Not a migrated pool, skip
//   }

//   // Get ETH price for USD calculations
//   const ethPrice = await fetchEthPrice(timestamp, context);

//   // Calculate the new price after the swap
//   const newTick = Number(tick);
//   const price = computeV4Price({
//     currentTick: newTick,
//     isToken0: v4pool.isToken0, // Use the stored token order
//     baseTokenDecimals: 18,
//   });

//   // Determine swap amounts (V4 uses negative values for amounts out)
//   const amountIn = amount0 > 0n ? amount0 : amount1;
//   const amountOut = amount0 < 0n ? -amount0 : -amount1;
//   const isZeroForOne = amount0 > 0n;

//   // Determine the swap type
//   const type = SwapService.determineSwapType({
//     isToken0: v4pool.isToken0,
//     amount0: amount0 > 0n ? amount0 : -amount0,
//     amount1: amount1 > 0n ? amount1 : -amount1,
//   });

//   // Get token total supply for market cap calculation
//   const { totalSupply } = await insertTokenIfNotExists({
//     tokenAddress: v4pool.asset!,
//     creatorAddress: v4pool.poolId,
//     timestamp,
//     context,
//     isDerc20: true,
//   });

//   // Calculate market metrics
//   const metrics = SwapService.calculateMarketMetrics({
//     totalSupply,
//     price,
//     swapAmountIn: amountIn,
//     swapAmountOut: amountOut,
//     ethPriceUSD: ethPrice,
//     assetDecimals: 18,
//     assetBalance: v4pool.reserves0, // Use stored reserves
//     quoteBalance: v4pool.reserves1,
//     isQuoteETH: v4pool.isQuoteEth,
//   });

//   // Calculate swap value in USD
//   let quoteDelta = 0n;
//   if (v4pool.isToken0) {
//     if (amount1 > 0n) {
//       quoteDelta = amount1;
//     } else {
//       quoteDelta = -amount1;
//     }
//   } else {
//     if (amount0 > 0n) {
//       quoteDelta = amount0;
//     } else {
//       quoteDelta = -amount0;
//     }
//   }
//   const swapValueUsd = quoteDelta * ethPrice / CHAINLINK_ETH_DECIMALS;

//   // Calculate 24-hour price change
//   const priceChange = await compute24HourPriceChange({
//     poolAddress: poolId,
//     marketCapUsd: metrics.marketCapUsd,
//     context,
//   });

//   // Create swap data
//   const swapData = SwapOrchestrator.createSwapData({
//     poolAddress: poolId,
//     sender: sender.toLowerCase() as Address,
//     transactionHash: txHash,
//     transactionFrom: txFrom,
//     blockNumber: event.block.number,
//     timestamp,
//     assetAddress: v4pool.asset!,
//     quoteAddress: v4pool.quoteToken,
//     isToken0: v4pool.isToken0,
//     amountIn,
//     amountOut,
//     price,
//     ethPriceUSD: ethPrice,
//   });

//   // Create market metrics
//   const marketMetrics = {
//     liquidityUsd: metrics.liquidityUsd,
//     marketCapUsd: metrics.marketCapUsd,
//     swapValueUsd: swapValueUsd,
//     percentDayChange: priceChange,
//   };

//   // Calculate fee amounts
//   // V4 fees are taken from the amount in
//   const feeAmount = (amountIn * BigInt(fee)) / 1000000n; // fee is in hundredths of a bip

//   // Define entity updaters
//   const entityUpdaters = {
//     updatePool,
//     updateAsset,
//     insertSwap: insertSwapIfNotExists,
//     insertOrUpdateBuckets,
//     insertOrUpdateDailyVolume,
//     tryAddActivePool,
//   };

//   // Perform common updates via orchestrator
//   await Promise.all([
//     SwapOrchestrator.performSwapUpdates(
//       {
//         swapData,
//         swapType: type,
//         metrics: marketMetrics,
//         poolData: {
//           parentPoolAddress: poolId,
//           price,
//         },
//         chainId: BigInt(chain.id),
//         context,
//       },
//       entityUpdaters
//     ),
//     updateV4Pool({
//       poolId: poolId,
//       context,
//       update: {
//         price,
//         tick: newTick,
//         sqrtPriceX96: sqrtPriceX96,
//         liquidity,
//         volumeUsd: v4pool.volumeUsd + swapValueUsd,
//         lastSwapTimestamp: timestamp,
//         totalFee0: isZeroForOne ? v4pool.totalFee0 + feeAmount : v4pool.totalFee0,
//         totalFee1: !isZeroForOne ? v4pool.totalFee1 + feeAmount : v4pool.totalFee1,
//         reserves0: v4pool.isToken0 ? v4pool.reserves0 - (isZeroForOne ? amountOut : amountIn) : v4pool.reserves0 + (isZeroForOne ? amountIn : amountOut),
//         reserves1: v4pool.isToken0 ? v4pool.reserves1 + (!isZeroForOne ? amountIn : amountOut) : v4pool.reserves1 - (!isZeroForOne ? amountOut : amountIn),
//       },
//     }),
//   ]);
// });

// // Track PoolManager ModifyLiquidity events for migrated pools
// ponder.on("PoolManager:ModifyLiquidity", async ({ event, context }) => {
//   const { id: poolId, sender, tickLower, tickUpper, liquidityDelta } = event.args;
//   const { timestamp } = event.block;
//   const { db, chain } = context;

//   // Check if this pool was created via migration
//   let v4pool;
//   try {
//     v4pool = await fetchExistingV4Pool({
//       poolId: poolId,
//       context,
//     });
//   } catch (error) {
//     return; // V4 pool not found, skip
//   }

//   if (!v4pool.migratedFromPool) {
//     return; // Not a migrated pool, skip
//   }

//   // Get ETH price for liquidity calculations
//   const ethPrice = await fetchEthPrice(timestamp, context);

//   // Update pool liquidity
//   const newLiquidity = liquidityDelta > 0n
//     ? v4pool.liquidity + BigInt(liquidityDelta)
//     : v4pool.liquidity - BigInt(-liquidityDelta);

//   // Calculate dollar liquidity
//   const dollarLiquidity = computeDollarLiquidity({
//     assetBalance: v4pool.reserves0,
//     quoteBalance: v4pool.reserves1,
//     price: v4pool.price,
//     ethPrice,
//   });

//   await updateV4Pool({
//     poolId: poolId,
//     context,
//     update: {
//       liquidity: newLiquidity,
//       dollarLiquidity,
//       lastRefreshed: timestamp,
//     },
//   });

//   // Update position tracking if this is a new position
//   if (liquidityDelta > 0n) {
//     const existingPosition = await db.find(position, {
//       pool: poolId,
//       tickLower: Number(tickLower),
//       tickUpper: Number(tickUpper),
//       chainId: BigInt(chain.id),
//     });

//     if (existingPosition) {
//       await updatePosition({
//         poolAddress: poolId,
//         tickLower: Number(tickLower),
//         tickUpper: Number(tickUpper),
//         context,
//         update: {
//           liquidity: newLiquidity,
//         },
//       });
//     } else {
//       await insertPositionIfNotExists({
//         poolAddress: poolId,
//         tickLower: Number(tickLower),
//         tickUpper: Number(tickUpper),
//         liquidity: BigInt(liquidityDelta),
//         owner: sender,
//         timestamp,
//         context,
//       });
//     }
//   }
// });

// // Track PoolManager Donate events for migrated pools
// ponder.on("PoolManager:Donate", async ({ event, context }) => {
//   const { id: poolId, amount0, amount1 } = event.args;
//   const { timestamp } = event.block;

//   // Check if this pool was created via migration
//   let v4pool;
//   try {
//     v4pool = await fetchExistingV4Pool({
//       poolId: poolId,
//       context,
//     });
//   } catch (error) {
//     return; // V4 pool not found, skip
//   }

//   if (!v4pool.migratedFromPool) {
//     return; // Not a migrated pool, skip
//   }

//   // Update pool reserves with donated amounts
//   await updateV4Pool({
//     poolId: poolId,
//     context,
//     update: {
//       reserves0: v4pool.reserves0 + amount0,
//       reserves1: v4pool.reserves1 + amount1,
//       lastRefreshed: timestamp,
//     },
//   });
// });