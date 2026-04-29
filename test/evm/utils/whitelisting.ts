import type { Address } from 'viem';

export const ZERO_ADDRESS =
  '0x0000000000000000000000000000000000000000' as Address;

export enum ModuleState {
  NotWhitelisted = 0,
  TokenFactory = 1,
  GovernanceFactory = 2,
  PoolInitializer = 3,
  LiquidityMigrator = 4,
}

export const MODULE_STATE_NAMES: Record<number, string> = {
  [ModuleState.NotWhitelisted]: 'NotWhitelisted',
  [ModuleState.TokenFactory]: 'TokenFactory',
  [ModuleState.GovernanceFactory]: 'GovernanceFactory',
  [ModuleState.PoolInitializer]: 'PoolInitializer',
  [ModuleState.LiquidityMigrator]: 'LiquidityMigrator',
};

export const dopplerHookWhitelistAbi = [
  {
    name: 'isDopplerHookEnabled',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'dopplerHook', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export function isConfiguredAddress(address?: Address): address is Address {
  return Boolean(address) && address !== ZERO_ADDRESS;
}
