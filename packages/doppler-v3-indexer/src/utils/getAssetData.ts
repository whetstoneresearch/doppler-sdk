import { Hex } from "viem";
import { Context } from "ponder:registry";
import { AirlockABI } from "@app/abis";
import { AssetData } from "@app/types/shared";
import { chainConfigs } from "@app/config";

export const getAssetData = async (
  assetTokenAddr: Hex,
  context: Context
): Promise<AssetData> => {
  const { chain } = context;
  const assetData = await context.client.readContract({
    abi: AirlockABI,
    address: chainConfigs[chain.name].addresses.shared.airlock,
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