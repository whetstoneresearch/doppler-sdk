import { migrationPool, pool, token } from "ponder:schema";
import { Address, zeroAddress } from "viem";
import { Context } from "ponder:registry";
import { getPairData } from "@app/utils/v2-utils/getPairData";
import { PriceService } from "@app/core";
import { fetchEthPrice } from "../oracle";
import { CHAINLINK_ETH_DECIMALS } from "@app/utils/constants";
import { chainConfigs } from "@app/config";
import { getV3MigrationPoolData } from "@app/utils/v3-utils/getV3PoolData";

export const insertV2MigrationPoolIfNotExists = async ({
  assetAddress,
  timestamp,
  context,
}: {
  assetAddress: Address;
  timestamp: bigint;
  context: Context;
}): Promise<typeof migrationPool.$inferSelect> => {
  const { db, chain } = context;

  const ethPrice = await fetchEthPrice(timestamp, context);

  const baseToken = await db.find(token, {
    address: assetAddress,
  });

  if (!baseToken?.pool) {
    throw new Error(`Base token pool not found for address ${assetAddress}`);
  }

  const parentPool = await db.find(pool, {
    address: baseToken.pool,
    chainId: BigInt(chain.id),
  });

  if (!parentPool) {
    throw new Error(`Pool not found for address ${baseToken.pool}`);
  }

  const migrationPoolAddr = parentPool.migrationPool?.toLowerCase() as `0x${string}`;

  if (!migrationPoolAddr) {
    throw new Error(`Migration pool not found for address ${baseToken.pool}`);
  }

  const existingV2Pool = await db.find(migrationPool, {
    address: migrationPoolAddr,
  });

  if (existingV2Pool) {
    return existingV2Pool;
  }

  const assetId = baseToken.address.toLowerCase() as `0x${string}`;
  const numeraireId = parentPool.quoteToken.toLowerCase() === zeroAddress ? chainConfigs[chain.name].addresses.shared.weth : parentPool.quoteToken;

  const isToken0 = assetId < numeraireId;

  const { reserve0, reserve1 } = await getPairData({
    address: migrationPoolAddr,
    context,
  });

  const price = PriceService.computePriceFromReserves({
    assetBalance: reserve0,
    quoteBalance: reserve1,
  });

  const dollarPrice = (price * ethPrice) / CHAINLINK_ETH_DECIMALS;

  return await db.insert(migrationPool).values({
    address: migrationPoolAddr,
    chainId: BigInt(chain.id),
    baseToken: assetId,
    quoteToken: numeraireId,
    reserveBaseToken: isToken0 ? reserve0 : reserve1,
    reserveQuoteToken: isToken0 ? reserve1 : reserve0,
    price: dollarPrice,
    parentPool: parentPool.address,
    fee: parentPool.fee,
    type: parentPool.type,
    migratedAt: timestamp,
    migrated: true,
    isToken0,
  });
};

export const updateMigrationPool = async ({
  poolAddress,
  context,
  update,
}: {
  poolAddress: Address;
  context: Context;
  update: Partial<typeof migrationPool.$inferInsert>;
}): Promise<typeof migrationPool.$inferSelect> => {
  const { db } = context;

  const address = poolAddress.toLowerCase() as `0x${string}`;

  return await db
    .update(migrationPool, {
      address,
    })
    .set(update);
};

export const insertV3MigrationPoolIfNotExists = async ({
  poolAddress,
  parentPool,
  timestamp,
  context,
}: {
  poolAddress: Address;
  parentPool: Address;
  timestamp: bigint;
  context: Context;
}): Promise<typeof migrationPool.$inferSelect> => {
  const { db, chain } = context;
  const address = poolAddress.toLowerCase() as `0x${string}`;
  const parentPoolAddress = parentPool.toLowerCase() as `0x${string}`;

  const parentPoolEntity = await db.find(pool, {
    address: parentPoolAddress,
    chainId: BigInt(chain.id),
  });

  const existingPool = await db.find(migrationPool, {
    address,
  });

  if (existingPool) {
    return existingPool;
  }

  const poolData = await getV3MigrationPoolData({
    address,
    baseToken: parentPoolEntity!.baseToken,
    context,
  });

  const { price, token0, token1, reserve0, reserve1, isToken0, fee } = poolData;

  const assetAddr = token0.toLowerCase() as `0x${string}`;
  const numeraireAddr = token1.toLowerCase() as `0x${string}`;

  const reserveBaseToken = isToken0 ? reserve0 : reserve1;
  const reserveQuoteToken = isToken0 ? reserve1 : reserve0;

  return await db.insert(migrationPool).values({
    address,
    migratedAt: timestamp,
    baseToken: assetAddr,
    quoteToken: numeraireAddr,
    reserveBaseToken,
    reserveQuoteToken,
    price,
    chainId: BigInt(chain.id),
    parentPool: parentPoolAddress,
    isToken0,
    fee,
    type: "v3",
  });
};
