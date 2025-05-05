import { Address } from 'viem';

export interface DopplerData {
  minimumProceeds: bigint;
  maximumProceeds: bigint;
  startingTime: bigint;
  endingTime: bigint;
  startingTick: number;
  endingTick: number;
  epochLength: bigint;
  gamma: number;
  isToken0: boolean;
  numPDSlugs: bigint;
  fee: number;
  tickSpacing: number;
}

export interface TokenFactoryData {
  name: string;
  symbol: string;
  airlock: Address;
  initialSupply: bigint;
  yearlyMintRate: bigint;
  vestingDuration: bigint;
  recipients: Address[];
  amounts: bigint[];
  tokenURI: string;
}
