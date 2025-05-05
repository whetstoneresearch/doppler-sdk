import { getV3PoolData } from "@app/utils/v3-utils";
import { getV4PoolData } from "@app/utils/v4-utils";
import { computeDollarLiquidity } from "@app/utils/computeDollarLiquidity";
import { pool } from "ponder:schema";
import { Address, zeroAddress } from "viem";
import { Context } from "ponder:registry";
import { fetchEthPrice } from "../oracle";
import { getReservesV4, V4PoolData } from "@app/utils/v4-utils/getV4PoolData";
import { computeV4Price } from "@app/utils/v4-utils/computeV4Price";
import { getZoraPoolData, PoolState } from "@app/utils/v3-utils/getV3PoolData";

export const insertPoolIfNotExists = async ({
  poolAddress,
  timestamp,
  context,
  ethPrice,
  isZora = false,
}: {
  poolAddress: Address;
  timestamp: bigint;
  context: Context;
  ethPrice: bigint;
  isZora?: boolean;
}): Promise<typeof pool.$inferSelect> => {
  const { db, network } = context;
  const address = poolAddress.toLowerCase() as `0x${string}`;

  const existingPool = await db.find(pool, {
    address,
    chainId: BigInt(network.chainId),
  });

  if (existingPool) {
    return existingPool;
  }

  const poolData = await getV3PoolData({
    address,
    context,
    isZora,
  });

  const {
    slot0Data,
    liquidity,
    price,
    fee,
    reserve0,
    reserve1,
    token0,
    poolState,
  } = poolData;

  const isToken0 = token0.toLowerCase() === poolState.asset.toLowerCase();

  const assetAddr = poolState.asset.toLowerCase() as `0x${string}`;
  const numeraireAddr = poolState.numeraire.toLowerCase() as `0x${string}`;

  let dollarLiquidity;
  if (ethPrice) {
    dollarLiquidity = await computeDollarLiquidity({
      assetBalance: isToken0 ? reserve0 : reserve1,
      quoteBalance: isToken0 ? reserve1 : reserve0,
      price,
      ethPrice,
    });
  }

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
    chainId: BigInt(network.chainId),
    fee,
    dollarLiquidity: dollarLiquidity ?? 0n,
    dailyVolume: address,
    graduationThreshold: 0n,
    graduationBalance: 0n,
    totalFee0: 0n,
    totalFee1: 0n,
    volumeUsd: 0n,
    percentDayChange: 0,
    isToken0,
  });
};

export const updatePool = async ({
  poolAddress,
  context,
  update,
}: {
  poolAddress: Address;
  context: Context;
  update?: Partial<typeof pool.$inferInsert>;
}) => {
  const { db, network } = context;
  const address = poolAddress.toLowerCase() as `0x${string}`;

  // First check if the pool exists before attempting to update
  const existingPool = await db.find(pool, {
    address,
    chainId: BigInt(network.chainId),
  });

  if (!existingPool) {
    console.warn(
      `Pool ${address} not found in chain ${network.chainId}, skipping update`
    );
    return;
  }

  await db
    .update(pool, {
      address,
      chainId: BigInt(network.chainId),
    })
    .set({
      ...update,
    });
};

export const insertZoraPoolIfNotExists = async ({
  poolAddress,
  assetAddress,
  numeraireAddress,
  timestamp,
  context,
  ethPrice,
}: {
  poolAddress: Address;
  assetAddress: Address;
  numeraireAddress: Address;
  timestamp: bigint;
  context: Context;
  ethPrice: bigint;
}): Promise<typeof pool.$inferSelect> => {
  const { db, network } = context;
  const address = poolAddress.toLowerCase() as `0x${string}`;

  const existingPool = await db.find(pool, {
    address,
    chainId: BigInt(network.chainId),
  });

  if (existingPool) {
    return existingPool;
  }

  const poolState: PoolState = {
    asset: assetAddress,
    numeraire: numeraireAddress,
    tickLower: 0,
    tickUpper: 0,
    numPositions: 0,
    isInitialized: true,
    isExited: false,
    maxShareToBeSold: 0n,
    maxShareToBond: 0n,
    initializer: zeroAddress,
  };

  const poolData = await getZoraPoolData({
    address: poolAddress,
    context,
    assetAddress,
    numeraireAddress,
  });

  const { slot0Data, liquidity, price, fee, reserve0, reserve1, token0 } =
    poolData;

  const isToken0 = token0.toLowerCase() === poolState.asset.toLowerCase();

  const assetAddr = poolState.asset.toLowerCase() as `0x${string}`;
  const numeraireAddr = poolState.numeraire.toLowerCase() as `0x${string}`;

  let dollarLiquidity;
  if (ethPrice) {
    dollarLiquidity = await computeDollarLiquidity({
      assetBalance: isToken0 ? reserve0 : reserve1,
      quoteBalance: isToken0 ? reserve1 : reserve0,
      price,
      ethPrice,
    });
  }

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
    chainId: BigInt(network.chainId),
    fee,
    dollarLiquidity: dollarLiquidity ?? 0n,
    dailyVolume: address,
    graduationThreshold: 0n,
    graduationBalance: 0n,
    totalFee0: 0n,
    totalFee1: 0n,
    volumeUsd: 0n,
    percentDayChange: 0,
    isToken0,
  });
};

export const insertPoolIfNotExistsV4 = async ({
  poolAddress,
  timestamp,
  poolData,
  context,
}: {
  poolAddress: Address;
  timestamp: bigint;
  poolData?: V4PoolData;
  context: Context;
}): Promise<typeof pool.$inferSelect> => {
  const { db, network } = context;
  const address = poolAddress.toLowerCase() as `0x${string}`;

  const existingPool = await db.find(pool, {
    address,
    chainId: BigInt(network.chainId),
  });

  if (existingPool) {
    return existingPool;
  }

  if (!poolData) {
    poolData = await getV4PoolData({
      hook: address,
      context,
    });
  }

  const { poolKey, slot0Data, liquidity, price, poolConfig } = poolData;
  const { fee } = poolKey;

  const { token0Reserve, token1Reserve } = await getReservesV4({
    hook: address,
    context,
  });

  const assetAddr = poolConfig.isToken0 ? poolKey.currency0 : poolKey.currency1;
  const numeraireAddr = poolConfig.isToken0
    ? poolKey.currency1
    : poolKey.currency0;

  const ethPrice = await fetchEthPrice(timestamp, context);

  const assetBalance = poolConfig.isToken0 ? token0Reserve : token1Reserve;
  const quoteBalance = poolConfig.isToken0 ? token1Reserve : token0Reserve;

  const dollarLiquidity = await computeDollarLiquidity({
    assetBalance,
    quoteBalance,
    price,
    ethPrice,
  });

  return await db.insert(pool).values({
    ...poolData,
    ...slot0Data,
    address,
    chainId: BigInt(network.chainId),
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
    graduationThreshold: 0n,
    graduationBalance: 0n,
    isToken0: poolConfig.isToken0,
    reserves0: token0Reserve,
    reserves1: token1Reserve,
    poolKey: JSON.stringify(poolKey),
  });
};
