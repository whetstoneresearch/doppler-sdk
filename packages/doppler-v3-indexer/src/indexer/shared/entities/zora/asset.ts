import { Context } from "ponder:registry";
import { asset } from "ponder:schema";
import { Address, zeroAddress } from "viem";

export const insertZoraAssetIfNotExists = async ({
  assetAddress,
  poolAddress,
  numeraireAddress,
  timestamp,
  context,
  marketCapUsd,
}: {
  assetAddress: Address;
  poolAddress: Address;
  numeraireAddress: Address;
  timestamp: bigint;
  context: Context;
  marketCapUsd?: bigint;
}) => {
  const { db, chain } = context;
  const address = assetAddress.toLowerCase() as `0x${string}`;

  const existingAsset = await db.find(asset, {
    address,
    chainId: chain.id,
  });

  if (existingAsset) {
    return existingAsset;
  }

  const isToken0 = assetAddress.toLowerCase() < numeraireAddress.toLowerCase();

  return await db.insert(asset).values({
    numeraire: numeraireAddress,
    numTokensToSell: 0n,
    poolInitializer: zeroAddress,
    liquidityMigrator: zeroAddress,
    integrator: zeroAddress,
    governance: zeroAddress,
    timelock: zeroAddress,
    migrationPool: zeroAddress,
    poolAddress,
    address,
    chainId: chain.id,
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

export const updateZoraAsset = async ({
  assetAddress,
  context,
  update,
}: {
  assetAddress: Address;
  context: Context;
  update?: Partial<typeof asset.$inferInsert>;
}) => {
  const { db, chain } = context;
  const address = assetAddress.toLowerCase() as `0x${string}`;

  await db
    .update(asset, {
      address,
      chainId: chain.id,
    })
    .set({
      ...update,
    });
};
