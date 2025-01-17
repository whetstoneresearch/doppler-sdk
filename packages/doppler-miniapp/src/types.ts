import {
  UseSuspenseQueryOptions,
  UseQueryOptions,
} from "@tanstack/react-query";
import { AssetData, ReadDerc20 } from "doppler-v3-sdk";

export type QueryOptions =
  | UseSuspenseQueryOptions
  | UseQueryOptions
  | {
      enabled?: boolean;
    };

export interface MarketDetails {
  assetData: AssetData;
  asset: TokenData;
  numeraire: TokenData;
}

export interface TokenData {
  token: ReadDerc20;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply?: bigint;
}
