import { useQuery } from "@tanstack/react-query";
import { Address } from "viem";
import { AssetData, ReadFactory } from "doppler-v3-sdk";
import { getDrift } from "../utils/drift";

export const fetchAssetData = async (
  airlock: Address | undefined,
  assetAddress: Address | undefined
): Promise<AssetData> => {
  if (!airlock || !assetAddress) {
    throw "Airlock or asset address is undefined";
  }

  const drift = getDrift();
  const readFactory = new ReadFactory(airlock, drift);
  const assetData = await readFactory.getAssetData(assetAddress);

  return assetData;
};

export function useAssetData(
  airlock: Address | undefined,
  assetAddress: Address | undefined
) {
  const assetDataQuery = useQuery({
    queryKey: ["asset-data", assetAddress],
    queryFn: async () => {
      return fetchAssetData(airlock, assetAddress);
    },
    enabled: Boolean(airlock) && Boolean(assetAddress),
  });

  return assetDataQuery;
}
