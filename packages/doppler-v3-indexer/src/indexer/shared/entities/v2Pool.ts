import { v2Pool } from "ponder:schema";
import { Address } from "viem";
import { Context } from "ponder:registry";
import { getPairData } from "@app/utils/v2-utils/getPairData";
import { getPoolDataSafe } from "@app/utils/v2-utils/getPoolDataSafe";
import { insertAssetIfNotExists } from "./asset";
import { PriceService } from "@app/core";
import { fetchEthPrice } from "../oracle";
import { CHAINLINK_ETH_DECIMALS } from "@app/utils/constants";
import { insertPoolIfNotExists } from "./pool";

export const insertV2PoolIfNotExists = async ({
  assetAddress,
  timestamp,
  context,
}: {
  assetAddress: Address;
  timestamp: bigint;
  context: Context;
}): Promise<typeof v2Pool.$inferSelect> => {
  const { db, chain } = context;

  const ethPrice = await fetchEthPrice(timestamp, context);

  const { poolAddress, migrationPool, numeraire } =
    await insertAssetIfNotExists({
      assetAddress,
      timestamp,
      context,
    });

  const migrationPoolAddr = migrationPool.toLowerCase() as `0x${string}`;

  const existingV2Pool = await db.find(v2Pool, {
    address: migrationPoolAddr,
  });

  if (existingV2Pool) {
    return existingV2Pool;
  }

  const { baseToken } = await insertPoolIfNotExists({
    poolAddress,
    timestamp,
    context,
    ethPrice,
  });

  const isToken0 = baseToken === assetAddress;

  const assetId = assetAddress.toLowerCase() as `0x${string}`;
  const numeraireId = numeraire.toLowerCase() as `0x${string}`;

  const poolAddr = poolAddress.toLowerCase() as `0x${string}`;

  const { reserve0, reserve1 } = await getPairData({
    address: migrationPoolAddr,
    context,
  });


  const price = PriceService.computePriceFromReserves({
    assetBalance: reserve0,
    quoteBalance: reserve1,
  });

  const dollarPrice = (price * ethPrice) / CHAINLINK_ETH_DECIMALS;

  return await db.insert(v2Pool).values({
    address: migrationPoolAddr,
    chainId: BigInt(chain.id),
    baseToken: assetId,
    quoteToken: numeraireId,
    reserveBaseToken: isToken0 ? reserve0 : reserve1,
    reserveQuoteToken: isToken0 ? reserve1 : reserve0,
    price: dollarPrice,
    v3Pool: poolAddr,
    parentPool: poolAddr,
    totalFeeBaseToken: 0n,
    totalFeeQuoteToken: 0n,
    migratedAt: timestamp,
    migrated: true,
    isToken0,
  });
};

export const updateV2Pool = async ({
  poolAddress,
  context,
  update,
}: {
  poolAddress: Address;
  context: Context;
  update: Partial<typeof v2Pool.$inferInsert>;
}): Promise<typeof v2Pool.$inferSelect> => {
  const { db } = context;

  const address = poolAddress.toLowerCase() as `0x${string}`;

  return await db
    .update(v2Pool, {
      address,
    })
    .set(update);
};
