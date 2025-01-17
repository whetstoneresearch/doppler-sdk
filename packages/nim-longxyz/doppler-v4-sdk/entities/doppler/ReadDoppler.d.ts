import { ReadContract, ReadAdapter, Drift } from '@delvtech/drift';
import { Address } from 'abitype';
import { dopplerAbi, stateViewAbi } from '@/abis';
import { Hex } from 'viem';
import { PoolKey } from '@/types';
import { ReadDerc20 } from '../token/derc20/ReadDerc20';
import { ReadEth } from '../token/eth/ReadEth';
type DopplerABI = typeof dopplerAbi;
type StateViewABI = typeof stateViewAbi;
export declare class ReadDoppler {
    drift: Drift<ReadAdapter>;
    address: Address;
    doppler: ReadContract<DopplerABI>;
    stateView: ReadContract<StateViewABI>;
    poolId: Hex;
    constructor(dopplerAddress: `0x${string}`, stateViewAddress: `0x${string}`, drift?: Drift<ReadAdapter>);
    getState(): Promise<{
        lastEpoch: number;
        tickAccumulator: bigint;
        totalTokensSold: bigint;
        totalProceeds: bigint;
        totalTokensSoldLastEpoch: bigint;
        feesAccrued: bigint;
    }>;
    getPosition(salt: Hex): Promise<{
        tickLower: number;
        tickUpper: number;
    }>;
    getSlot0(id: Hex): Promise<{
        tick: number;
        sqrtPriceX96: bigint;
        protocolFee: number;
        lpFee: number;
    }>;
    getCurrentPrice(): Promise<bigint>;
    getPoolKey(): Promise<PoolKey>;
    getPoolId(): Promise<Hex>;
    getAssetToken(): Promise<ReadDerc20>;
    getQuoteToken(): Promise<ReadDerc20 | ReadEth>;
    getInsufficientProceeds(): Promise<boolean>;
    getEarlyExit(): Promise<boolean>;
}
export {};
