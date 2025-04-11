import { Address, Hex, zeroAddress } from "viem";
import { Context } from "ponder:registry";
import { AirlockABI, ZoraCoinABI } from "@app/abis";

export interface AssetData {
  numeraire: Address;
  timelock: Address;
  governance: Address;
  liquidityMigrator: Address;
  poolInitializer: Address;
  pool: Address;
  migrationPool: Address;
  numTokensToSell: bigint;
  totalSupply: bigint;
  integrator: Address;
}

export const getAssetData = async (
  assetTokenAddr: Hex,
  context: Context
): Promise<AssetData> => {
  const assetData = await context.client.readContract({
    abi: AirlockABI,
    address: context.contracts.Airlock.address,
    functionName: "getAssetData",
    args: [assetTokenAddr],
  });

  if (!assetData || assetData.length !== 10) {
    console.error(`Error reading asset data for ${assetTokenAddr}`);
  }

  return {
    numeraire: assetData[0],
    timelock: assetData[1],
    governance: assetData[2],
    liquidityMigrator: assetData[3],
    poolInitializer: assetData[4],
    pool: assetData[5],
    migrationPool: assetData[6],
    numTokensToSell: BigInt(assetData[7]),
    totalSupply: BigInt(assetData[8]),
    integrator: assetData[9],
  };
};

export const getZoraAssetData = async (
  assetTokenAddr: Hex,
  context: Context
): Promise<AssetData> => {
  const { client } = context;
  const numeraireAddr = await client.readContract({
    abi: ZoraCoinABI,
    address: assetTokenAddr,
    functionName: "currency",
  });

  const poolAddr = await client.readContract({
    abi: ZoraCoinABI,
    address: assetTokenAddr,
    functionName: "poolAddress",
  });

  const totalSupply = await client.readContract({
    abi: ZoraCoinABI,
    address: assetTokenAddr,
    functionName: "totalSupply",
  });

  const zoraAssetData = {
    numeraire: numeraireAddr,
    pool: poolAddr,
    timelock: zeroAddress,
    governance: zeroAddress,
    liquidityMigrator: zeroAddress,
    poolInitializer: zeroAddress,
    migrationPool: zeroAddress,
    numTokensToSell: BigInt(0),
    totalSupply: totalSupply,
    integrator: zeroAddress,
  };

  return zoraAssetData;
};
