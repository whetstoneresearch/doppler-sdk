import { useQuery } from "@tanstack/react-query";
import { Address } from "viem";
import {
  AssetData,
  ReadUniswapV3Pool,
  Slot0,
  ReadUniswapV3Initializer,
  PoolState,
  ReadDerc20,
} from "doppler-v3-sdk";
import { getDrift } from "../utils/drift";
import { useAssetData } from "./useMarketDetails";
import { useTokenData } from "./useToken";

interface PoolData {
  poolBalance: bigint;
  initializerState: PoolState;
  slot0: Slot0;
  positions: Position[];
}

interface Position {
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
}

const fetchPositionData = async (
  assetData?: AssetData,
  assetAddress?: Address,
  initializerAddress?: Address
): Promise<PoolData> => {
  if (!assetData) {
    throw "Asset data not found";
  }

  if (!initializerAddress) {
    throw "Initializer address not found";
  }

  if (!assetAddress) {
    throw "Asset address not found";
  }

  const drift = getDrift();
  const pool = new ReadUniswapV3Pool(assetData.pool, drift);
  const initializer = new ReadUniswapV3Initializer(initializerAddress, drift);
  const asset = new ReadDerc20(assetAddress, drift);

  const poolBalance = await asset.getBalanceOf(assetData.pool);
  const initializerState = await initializer.getState(assetData.pool);
  const slot0 = await pool.getSlot0();
  const mintEvents = await pool.getMintEvents({
    fromBlock: 0n,
    toBlock: "latest",
    filter: {
      owner: assetData.poolInitializer,
    },
  });

  const positions: Position[] = mintEvents.map((event) => ({
    tickLower: event.args?.tickLower ?? 0,
    tickUpper: event.args?.tickUpper ?? 0,
    liquidity: event.args?.amount ?? 0n,
  }));

  return {
    poolBalance,
    initializerState,
    slot0,
    positions,
  };
};

export function usePoolData(
  airlock: Address | undefined,
  initializerAddress: Address | undefined,
  assetAddress: Address | undefined
) {
  const assetDataQuery = useAssetData(airlock, assetAddress);
  const numeraireQuery = useTokenData(assetDataQuery.data?.numeraire);
  const assetQuery = useTokenData(assetAddress);

  const poolDataQuery = useQuery({
    queryKey: ["pool-data", assetDataQuery.data?.pool],
    queryFn: async () => {
      if (!assetDataQuery.data) {
        throw new Error("Market details not found");
      }

      const poolDatas = await fetchPositionData(
        assetDataQuery.data,
        assetAddress,
        initializerAddress
      );

      return poolDatas;
    },
    enabled:
      Boolean(assetDataQuery.data) &&
      Boolean(numeraireQuery.data) &&
      Boolean(assetQuery.data),
  });

  return {
    isLoading:
      assetDataQuery.isLoading ||
      assetQuery.isLoading ||
      numeraireQuery.isLoading ||
      poolDataQuery.isLoading,
    error:
      assetDataQuery.error ||
      assetQuery.error ||
      numeraireQuery.error ||
      poolDataQuery.error,
    data: {
      assetData: assetDataQuery.data,
      numeraire: numeraireQuery.data,
      asset: assetQuery.data,
      poolData: poolDataQuery.data,
    },
  };
}
