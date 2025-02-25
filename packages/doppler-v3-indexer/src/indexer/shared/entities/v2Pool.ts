import { v2Pool } from "ponder:schema";
import { Address } from "viem";
import { Context } from "ponder:registry";
import { getPairData } from "@app/utils/v2-utils/getPairData";
import { insertAssetIfNotExists } from "./asset";
import { computeV2Price } from "@app/utils/v2-utils/computeV2Price";
import { fetchEthPrice } from "../oracle";
import { CHAINLINK_ETH_DECIMALS } from "@app/utils/constants";

export const insertV2PoolIfNotExists = async ({
  assetAddress,
  poolAddress,
  timestamp,
  context,
}: {
  assetAddress: Address;
  poolAddress: Address;
  timestamp: bigint;
  context: Context;
}): Promise<typeof v2Pool.$inferSelect> => {
  const { db, network } = context;

  const assetAddr = assetAddress.toLowerCase() as `0x${string}`;
  const poolAddr = poolAddress.toLowerCase() as `0x${string}`;

  const asset = await insertAssetIfNotExists({
    assetAddress,
    timestamp,
    context,
  });

  const migrationPoolAddr = asset.migrationPool.toLowerCase() as `0x${string}`;
  const numeraireAddr = asset.numeraire.toLowerCase() as `0x${string}`;

  const pairData = await getPairData({
    address: migrationPoolAddr,
    context,
  });

  if (!pairData) {
    throw new Error("Pair data not found");
  }

  const { reserve0, reserve1, token0, token1 } = pairData;
  const isToken0 = token0.toLowerCase() === assetAddress.toLowerCase();

  const [price, ethPrice] = await Promise.all([
    computeV2Price({
      assetBalance: isToken0 ? reserve0 : reserve1,
      quoteBalance: isToken0 ? reserve1 : reserve0,
    }),
    fetchEthPrice(timestamp, context),
  ]);

  let dollarPrice = 0n;
  if (ethPrice) {
    dollarPrice = (price * ethPrice) / CHAINLINK_ETH_DECIMALS;
  }

  return await db.insert(v2Pool).values({
    address: migrationPoolAddr,
    chainId: BigInt(network.chainId),
    baseToken: assetAddr,
    quoteToken: numeraireAddr,
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
