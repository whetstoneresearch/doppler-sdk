import { DERC20ABI } from "@app/abis";
import { configs, V4PoolData } from "@app/types";
import { computeDollarLiquidity } from "@app/utils/computeDollarLiquidity";
import { getAssetData } from "@app/utils/getAssetData";
import { getV3PoolData } from "@app/utils/v3-utils";
import { computeGraduationPercentage } from "@app/utils/v4-utils";
import { getReservesV4 } from "@app/utils/v4-utils/getV4PoolData";
import { Context } from "ponder:registry";
import { pool } from "ponder:schema";
import { Address } from "viem";
import { computeMarketCap } from "../oracle";
import { computeGraduationPercentage } from "@app/utils/v4-utils";
import { DERC20ABI } from "@app/abis";
import { V4PoolData } from "@app/types";
import { configs } from "@app/types";
import { getLockableV3PoolData } from "@app/utils/v3-utils/getV3PoolData";

export const fetchExistingPool = async ({
  poolAddress,
  context,
}: {
  poolAddress: Address;
  context: Context;
}): Promise<typeof pool.$inferSelect> => {
  const { db, chain } = context;
  const address = poolAddress.toLowerCase() as `0x${string}`;
  const existingPool = await db.find(pool, {
    address,
    chainId: BigInt(chain.id),
  });

  if (!existingPool) {
    throw new Error(`Pool ${address} not found in chain ${chain.id}`);
  }
  return existingPool;
};

export const insertPoolIfNotExists = async ({
  poolAddress,
  timestamp,
  context,
  ethPrice,
}: {
  poolAddress: Address;
  timestamp: bigint;
  context: Context;
  ethPrice: bigint;
}): Promise<typeof pool.$inferSelect> => {
  const { db, chain, client } = context;
  const address = poolAddress.toLowerCase() as `0x${string}`;

  const existingPool = await db.find(pool, {
    address,
    chainId: BigInt(chain.id),
  });

  if (existingPool) {
    return existingPool;
  }

  const poolData = await getV3PoolData({
    address,
    context,
  });

  const { slot0Data, liquidity, price, fee, token0, poolState } = poolData;

  const isToken0 = token0.toLowerCase() === poolState.asset.toLowerCase();

  const assetAddr = poolState.asset.toLowerCase() as `0x${string}`;
  const numeraireAddr = poolState.numeraire.toLowerCase() as `0x${string}`;

  const isQuoteEth =
    poolState.numeraire.toLowerCase() ===
      "0x0000000000000000000000000000000000000000" ||
    poolState.numeraire.toLowerCase() === configs[chain.name].shared.weth;

  const [assetTotalSupply, assetData] = await Promise.all([
    client.readContract({
      address: assetAddr,
      abi: DERC20ABI,
      functionName: "totalSupply",
    }),
    getAssetData(assetAddr, context),
  ]);

  const marketCapUsd = computeMarketCap({
    price,
    ethPrice,
    totalSupply: assetTotalSupply,
  });

  return await db.insert(pool).values({
    ...poolData,
    ...slot0Data,
    address,
    liquidity: liquidity,
    createdAt: timestamp,
    asset: assetAddr,
    baseToken: assetAddr,
    quoteToken: numeraireAddr,
    price,
    type: "v3",
    chainId: BigInt(chain.id),
    fee,
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
    isToken0,
    marketCapUsd,
    isQuoteEth,
    integrator: assetData.integrator,
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
      chainId: BigInt(chain.id),
    })
    .set({
      ...update,
    });
};

export const insertPoolIfNotExistsV4 = async ({
  poolAddress,
  timestamp,
  poolData,
  ethPrice,
  context,
}: {
  poolAddress: Address;
  timestamp: bigint;
  ethPrice: bigint;
  context: Context;
  poolData: V4PoolData;
}): Promise<typeof pool.$inferSelect> => {
  const { db, chain, client } = context;
  const address = poolAddress.toLowerCase() as `0x${string}`;
  const existingPool = await db.find(pool, {
    address,
    chainId: BigInt(chain.id),
  });

  if (existingPool) {
    return existingPool;
  }

  const { poolKey, slot0Data, liquidity, price, poolConfig } = poolData;
  const { fee } = poolKey;

  const assetAddr = poolConfig.isToken0 ? poolKey.currency0 : poolKey.currency1;
  const numeraireAddr = poolConfig.isToken0
    ? poolKey.currency1
    : poolKey.currency0;

  const isQuoteEth =
    numeraireAddr.toLowerCase() ===
      "0x0000000000000000000000000000000000000000" ||
    numeraireAddr.toLowerCase() === configs[chain.name].shared.weth;

  const [reserves, totalSupply, assetData] = await Promise.all([
    getReservesV4({
      hook: address,
      context,
    }),
    client.readContract({
      address: assetAddr,
      abi: DERC20ABI,
      functionName: "totalSupply",
    }),
    getAssetData(assetAddr, context),
  ]);

  const { token0Reserve, token1Reserve } = reserves;

  const assetBalance = poolConfig.isToken0 ? token0Reserve : token1Reserve;
  const quoteBalance = poolConfig.isToken0 ? token1Reserve : token0Reserve;

  const dollarLiquidity = computeDollarLiquidity({
    assetBalance,
    quoteBalance,
    price,
    ethPrice,
  });

  const marketCapUsd = computeMarketCap({
    price,
    ethPrice,
    totalSupply,
  });

  const graduationPercentage = computeGraduationPercentage({
    maxThreshold: poolConfig.maxProceeds,
    graduationBalance: 0n,
  });

  return await db.insert(pool).values({
    address,
    chainId: BigInt(chain.id),
    tick: slot0Data.tick,
    sqrtPrice: slot0Data.sqrtPrice,
    liquidity: liquidity,
    createdAt: timestamp,
    asset: assetAddr,
    baseToken: assetAddr,
    quoteToken: numeraireAddr,
    price,
    fee,
    type: "v4",
    dollarLiquidity: dollarLiquidity ?? 0n,
    dailyVolume: address,
    volumeUsd: 0n,
    percentDayChange: 0,
    totalFee0: 0n,
    totalFee1: 0n,
    maxThreshold: poolConfig.maxProceeds,
    minThreshold: poolConfig.minProceeds,
    graduationBalance: 0n,
    graduationPercentage,
    isToken0: poolConfig.isToken0,
    marketCapUsd,
    reserves0: token0Reserve,
    reserves1: token1Reserve,
    poolKey: JSON.stringify(poolKey),
    isQuoteEth,
    integrator: assetData.integrator,
  });
};

export const insertLockableV3PoolIfNotExists = async ({
  poolAddress,
  timestamp,
  context,
  ethPrice,
}: {
  poolAddress: Address;
  timestamp: bigint;
  context: Context;
  ethPrice: bigint;
}): Promise<typeof pool.$inferSelect> => {
  const { db, chain, client } = context;
  const address = poolAddress.toLowerCase() as `0x${string}`;

  const existingPool = await db.find(pool, {
    address,
    chainId: BigInt(chain.id),
  });

  if (existingPool) {
    return existingPool;
  }

  const poolData = await getLockableV3PoolData({
    address,
    context,
  });

  const { slot0Data, liquidity, price, fee, token0, poolState } = poolData;

  const isToken0 = token0.toLowerCase() === poolState.asset.toLowerCase();

  const assetAddr = poolState.asset.toLowerCase() as `0x${string}`;
  const numeraireAddr = poolState.numeraire.toLowerCase() as `0x${string}`;

  const isQuoteEth =
    poolState.numeraire.toLowerCase() ===
      "0x0000000000000000000000000000000000000000" ||
    poolState.numeraire.toLowerCase() === configs[chain.name].shared.weth;

  const [assetTotalSupply, assetData] = await Promise.all([
    client.readContract({
      address: assetAddr,
      abi: DERC20ABI,
      functionName: "totalSupply",
    }),
    getAssetData(assetAddr, context),
  ]);

  const marketCapUsd = computeMarketCap({
    price,
    ethPrice,
    totalSupply: assetTotalSupply,
  });

  return await db.insert(pool).values({
    ...poolData,
    ...slot0Data,
    address,
    liquidity: liquidity,
    createdAt: timestamp,
    asset: assetAddr,
    baseToken: assetAddr,
    quoteToken: numeraireAddr,
    price,
    type: "v3",
    chainId: BigInt(chain.id),
    fee,
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
    isToken0,
    marketCapUsd,
    isStreaming: true,
    isQuoteEth,
    integrator: assetData.integrator,
    isQuoteEth
  });
};
