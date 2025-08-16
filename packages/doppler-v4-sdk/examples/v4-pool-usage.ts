/**
 * Example: Using V4 Pool Support for Post-Migration Pools
 * 
 * This example demonstrates how to interact with Uniswap V4 pools
 * that tokens have graduated to after completing Doppler's price discovery.
 */

import { createPublicClient, createWalletClient, http, parseEther } from 'viem';
import { base } from 'viem/chains';
import {
  V4PoolFactory,
  computePoolId,
  formatPoolId,
  FEE_TIERS,
  TICK_SPACINGS
} from 'doppler-v4-sdk';

// Example addresses (replace with actual addresses)
const POOL_MANAGER_ADDRESS = '0x...'; // V4 PoolManager singleton
const STATE_VIEW_ADDRESS = '0x...';   // V4 StateView contract
const V4_MIGRATOR_HOOK = '0x...';     // Shared hook for graduated pools

async function main() {
  // 1. Create clients
  const publicClient = createPublicClient({
    chain: base,
    transport: http(),
  });

  const walletClient = createWalletClient({
    chain: base,
    transport: http(),
  });

  // 2. Create a read-only pool instance for a graduated token
  const assetToken = '0x...'; // Doppler token that graduated
  const quoteToken = '0x...'; // WETH or other quote token

  const pool = V4PoolFactory.forGraduatedPool(
    assetToken,
    quoteToken,
    POOL_MANAGER_ADDRESS,
    STATE_VIEW_ADDRESS,
    V4_MIGRATOR_HOOK
  );

  // 3. Read pool state
  console.log('Pool ID:', formatPoolId(pool.getPoolId()));
  
  const slot0 = await pool.getSlot0();
  console.log('Current tick:', slot0.tick);
  console.log('Sqrt Price X96:', slot0.sqrtPriceX96.toString());
  console.log('LP Fee:', slot0.lpFee, 'hundredths of a bip');

  const liquidity = await pool.getLiquidity();
  console.log('Total liquidity:', liquidity.toString());

  const price = await pool.getCurrentPrice();
  console.log('Current price (raw):', price.toString());

  // 4. Create a write-enabled pool for transactions
  const writePool = V4PoolFactory.fromTokensWrite(
    assetToken,
    quoteToken,
    FEE_TIERS.MEDIUM,        // 0.3% fee
    TICK_SPACINGS.MEDIUM,    // 60 tick spacing
    V4_MIGRATOR_HOOK,
    POOL_MANAGER_ADDRESS,
    STATE_VIEW_ADDRESS
  );

  // 5. Execute a swap
  try {
    const swapReceipt = await writePool.swap({
      zeroForOne: true,                    // Swap token0 for token1
      amountSpecified: parseEther('1'),    // 1 token0
      sqrtPriceLimitX96: 0n,              // No price limit
    });
    console.log('Swap tx:', swapReceipt);
  } catch (error) {
    console.error('Swap failed:', error);
  }

  // 6. Add liquidity to the pool
  try {
    const currentTick = await pool.getCurrentTick();
    const tickSpacing = pool.getTickSpacing();
    
    // Add liquidity around current price
    const tickLower = Math.floor(currentTick / tickSpacing) * tickSpacing - tickSpacing * 10;
    const tickUpper = Math.floor(currentTick / tickSpacing) * tickSpacing + tickSpacing * 10;

    const liquidityReceipt = await writePool.addLiquidity(
      tickLower,
      tickUpper,
      parseEther('100'), // liquidity amount
    );
    console.log('Add liquidity tx:', liquidityReceipt);
  } catch (error) {
    console.error('Add liquidity failed:', error);
  }

  // 7. Working with PoolKeys
  const poolKey = pool.getPoolKey();
  console.log('Pool configuration:');
  console.log('- Currency 0:', poolKey.currency0);
  console.log('- Currency 1:', poolKey.currency1);
  console.log('- Fee:', poolKey.fee, 'hundredths of a bip');
  console.log('- Tick Spacing:', poolKey.tickSpacing);
  console.log('- Hooks:', poolKey.hooks);

  // 8. Pool ID utilities
  const poolId = computePoolId(poolKey);
  console.log('Computed pool ID:', poolId);
  console.log('Formatted:', formatPoolId(poolId));
}

// Example: Creating pool from different inputs
async function alternativeCreation() {
  // From PoolKey
  const poolKey = {
    currency0: '0x...',
    currency1: '0x...',
    fee: 3000,
    tickSpacing: 60,
    hooks: V4_MIGRATOR_HOOK,
  } as const;

  const poolFromKey = V4PoolFactory.fromPoolKey(
    poolKey,
    POOL_MANAGER_ADDRESS,
    STATE_VIEW_ADDRESS
  );

  // From individual tokens
  const poolFromTokens = V4PoolFactory.fromTokens(
    '0x...', // token0
    '0x...', // token1
    3000,    // fee
    60,      // tick spacing
    V4_MIGRATOR_HOOK,
    POOL_MANAGER_ADDRESS,
    STATE_VIEW_ADDRESS
  );
}

main().catch(console.error);