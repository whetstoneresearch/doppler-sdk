import { ReadContract, ReadAdapter, Drift } from '@delvtech/drift';
import { Address } from 'viem';
import { airlockAbi } from '@/abis';
import { AssetData } from '@/types';
export type AirlockABI = typeof airlockAbi;

export enum ModuleState {
  NotWhitelisted = 0,
  TokenFactory = 1,
  GovernanceFactory = 2,
  HookFactory = 3,
  Migrator = 4,
}

export class ReadFactory {
  airlock: ReadContract<AirlockABI>;

  constructor(address: Address, drift: Drift<ReadAdapter> = new Drift()) {
    this.airlock = drift.contract({
      abi: airlockAbi,
      address,
    });
  }

  async getModuleState(module: Address): Promise<ModuleState> {
    return this.airlock.read('getModuleState', {
      module,
    });
  }

  async getAssetData(asset: Address): Promise<AssetData> {
    return this.airlock.read('getAssetData', {
      asset,
    });
  }

  // async getCreateEvents(): Promise<EventFilter<AirlockABI, 'Create'>> {
  //   return this.airlock.getEvents('Create');
  // }

  // async getMigrateEvents(): Promise<EventFilter<AirlockABI, 'Migrate'>> {
  //   return this.airlock.getEvents('Migrate');
  // }

  // async getSetModuleStateEvents(): Promise<
  //   EventFilter<AirlockABI, 'SetModuleState'>
  // > {
  //   return this.airlock.getEvents('SetModuleState');
  // }
}
