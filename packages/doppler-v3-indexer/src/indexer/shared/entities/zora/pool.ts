import { configs, PoolKey } from "@app/types";
import { computeDollarLiquidity } from "@app/utils/computeDollarLiquidity";
import { computeV3Price } from "@app/utils/v3-utils";
import { getReservesV4Zora } from "@app/utils/v4-utils/getV4PoolData";
import { Context } from "ponder:registry";
import { pool } from "ponder:schema";
import { Address, zeroAddress } from "viem";

export const insertZoraPoolIfNotExists = async ({
  poolAddress,
  timestamp,
  context,
  tick,
  sqrtPrice,
}: {
  poolAddress: Address;
  timestamp: bigint;
  context: Context;
  tick?: number;
  sqrtPrice?: bigint;
}): Promise<typeof pool.$inferSelect> => {
  const { db, chain } = context;
  const address = poolAddress.toLowerCase() as `0x${string}`;

  const existingPool = await db.find(pool, {
    address,
    chainId: chain.id,
  });

  if (existingPool) {
    return existingPool;
  }

  const tickValue = tick ?? 0;
  const sqrtPriceValue = sqrtPrice ?? 0n;

  const slot0Data = {
    tick: tickValue,
    sqrtPrice: sqrtPriceValue,
  }

  return await db.insert(pool).values({
    ...slot0Data,
    address,
    liquidity: 0n,
    createdAt: timestamp,
    asset: zeroAddress,
    baseToken: zeroAddress,
    quoteToken: zeroAddress,
    price: 0n, // update in coin created event
    type: "v3",
    chainId: chain.id,
    fee: 0,
    dollarLiquidity: 0n,
    dailyVolume: address,
    maxThreshold: 0n,
    graduationBalance: 0n,
    totalFee0: 0n,
    totalFee1: 0n,
    volumeUsd: 0n,
    reserves0: 0n,
    reserves1: 0n,
    percentDayChange: 0,
    isToken0: false,
    marketCapUsd: 0n,
    isQuoteEth: false,
    integrator: zeroAddress,
  });
};

export const updatePool = async ({
  poolAddress,
  context,
  update,
}: {
  poolAddress: Address;
  context: Context;
  update: Partial<typeof pool.$inferInsert>;
}) => {
  const { db, chain } = context;
  const address = poolAddress.toLowerCase() as `0x${string}`;

  await db
    .update(pool, {
      address,
      chainId: chain.id,
    })
    .set({
      ...update,
    });
};

export const insertZoraPoolV4IfNotExists = async ({
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
  poolKeyHash,
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
  poolKeyHash?: `0x${string}`;
}): Promise<typeof pool.$inferSelect> => {
  const { db, chain } = context;
  const address = poolAddress.toLowerCase() as `0x${string}`;

  const isToken0 = baseToken.toLowerCase() < quoteToken.toLowerCase();

  const existingPool = await db.find(pool, {
    address,
    chainId: chain.id,
  });

  if (existingPool) {
    return existingPool;
  }

  const { reserves, sqrtPriceX96, tick } = await getReservesV4Zora({
    poolAddress,
    isContentCoin,
    isCreatorCoin,
    poolKey,
    context,
    poolKeyHash,
  });

  const isQuoteEth = quoteToken === zeroAddress || quoteToken === configs[chain.name].shared.weth;

  const { token0Reserve, token1Reserve, liquidity } = reserves;

  const price = computeV3Price({
    sqrtPriceX96,
    isToken0,
    decimals: 18,
  });

  const liquidityUsd = computeDollarLiquidity({
    assetBalance: isToken0 ? token0Reserve : token1Reserve,
    quoteBalance: isToken0 ? token1Reserve : token0Reserve,
    price,
    ethPrice,
  });

  return await db.insert(pool).values({
    address,
    tick ,
    sqrtPrice: sqrtPriceX96,
    liquidity,
    createdAt: timestamp,
    asset: baseToken,
    baseToken: baseToken,
    quoteToken: quoteToken,
    price,
    type: "v4",
    chainId: chain.id,
    fee: poolKey.fee,
    dollarLiquidity: liquidityUsd,
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
    marketCapUsd: 0n,
    isQuoteEth,
    isQuoteZora,
    integrator: zeroAddress,
    isContentCoin,
    isCreatorCoin,
  });
};
