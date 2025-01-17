import { ReadContract, ReadAdapter, Drift } from '@delvtech/drift';
import { Address } from 'viem';
import { airlockAbi } from '@/abis';
import { AssetData } from '@/types';
export type AirlockABI = typeof airlockAbi;
export declare enum ModuleState {
    NotWhitelisted = 0,
    TokenFactory = 1,
    GovernanceFactory = 2,
    HookFactory = 3,
    Migrator = 4
}
export declare class ReadFactory {
    airlock: ReadContract<AirlockABI>;
    constructor(address: Address, drift?: Drift<ReadAdapter>);
    getModuleState(module: Address): Promise<ModuleState>;
    getAssetData(asset: Address): Promise<AssetData>;
}
