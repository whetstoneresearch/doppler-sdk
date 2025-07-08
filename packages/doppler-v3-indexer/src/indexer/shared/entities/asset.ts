import { Context } from "ponder:registry";
import { asset } from "ponder:schema";
import { Address } from "viem";
import { getAssetData } from "@app/utils/getAssetData";

export const insertAssetIfNotExists = async ({
  assetAddress,
  timestamp,
  context,
  marketCapUsd,
}: {
  assetAddress: Address;
  timestamp: bigint;
  context: Context;
  marketCapUsd?: bigint;
}) => {
  const { db, chain } = context;
  const address = assetAddress.toLowerCase() as `0x${string}`;

  const existingAsset = await db.find(asset, {
    address,
  });

  if (existingAsset) {
    return existingAsset;
  }

  const chainId = BigInt(chain.id);
  const assetData = await getAssetData(assetAddress, context);

  const poolAddress = assetData.pool.toLowerCase() as `0x${string}`;

  const isToken0 =
    assetAddress.toLowerCase() < assetData.numeraire.toLowerCase();

  return await db.insert(asset).values({
    ...assetData,
    poolAddress,
    address,
    chainId,
    isToken0,
    createdAt: timestamp,
    migratedAt: null,
    migrated: false,
    holderCount: 0,
    percentDayChange: 0,
    marketCapUsd: marketCapUsd ?? 0n,
    dayVolumeUsd: 0n,
    liquidityUsd: 0n,
  });
};

export const updateAsset = async ({
  assetAddress,
  context,
  update,
}: {
  assetAddress: Address;
  context: Context;
  update?: Partial<typeof asset.$inferInsert>;
}) => {
  const { db } = context;
  const address = assetAddress.toLowerCase() as `0x${string}`;

  await db
    .update(asset, {
      address,
    })
    .set({
      ...update,
    });
};
