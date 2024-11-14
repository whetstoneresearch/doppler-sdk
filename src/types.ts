import { Address, Hash, Hex } from 'viem';
import { Token } from '@uniswap/sdk-core';
import { PoolKey } from '@uniswap/v4-sdk';

// TODO: Add governance data
export interface Doppler {
  address: Address;
  assetToken: Token;
  quoteToken: Token;
  hook: Address;
  poolKey: PoolKey;
  poolId: `0x${string}`;
  deployedAt: bigint;
  deploymentTx: Hex;
}

export interface DopplerState {
  lastEpoch: number;
  tickAccumulator: bigint;
  totalTokensSold: bigint;
  totalProceeds: bigint;
  totalTokensSoldLastEpoch: bigint;
  feesAccrued: {
    amount0: bigint;
    amount1: bigint;
  };
  currentTick: number;
}

export interface PositionState {
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  salt: Hash;
}

export interface DeploymentConfig {
  salt: Hash;
  dopplerAddress: Address;
  poolKey: PoolKey;
  poolId: `0x${string}`;
  token: TokenConfig;
  hook: HookConfig;
  pool: PoolConfig;
}

export interface TokenConfig {
  name: string;
  symbol: string;
  totalSupply: bigint;
}

export interface HookConfig {
  assetToken: Token;
  quoteToken: Token;
  startTime: number; // in seconds
  endTime: number; // in seconds
  epochLength: number; // in seconds
  startTick: number;
  endTick: number;
  gamma: number;
  minProceeds: bigint;
  maxProceeds: bigint;
  numTokensToSell: bigint;
  numPdSlugs: number;
}

export interface PoolConfig {
  tickSpacing: number;
  fee: number; // In bips (e.g., 3000 for 0.3%)
}
