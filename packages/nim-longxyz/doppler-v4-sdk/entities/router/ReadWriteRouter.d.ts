import { ReadWriteContract, ReadWriteAdapter, Drift } from '@delvtech/drift';
import { customRouterAbi } from '@/abis';
import { Address, Hex } from 'viem';
import { PoolKey } from '@/types';
interface TradeParams {
    key: PoolKey;
    amount: bigint;
}
type CustomRouterABI = typeof customRouterAbi;
export declare class ReadWriteRouter {
    contract: ReadWriteContract<CustomRouterABI>;
    constructor(address: Address, drift?: Drift<ReadWriteAdapter>);
    buyExactIn(params: TradeParams): Promise<Hex>;
    buyExactOut(params: TradeParams): Promise<Hex>;
    sellExactIn(params: TradeParams): Promise<Hex>;
    sellExactOut(params: TradeParams): Promise<Hex>;
}
export {};
