import { ReadWriteContract, ReadWriteAdapter, Drift } from '@delvtech/drift';
import { Address, Hex } from 'viem';
import { Derc20ABI, ReadDerc20 } from './ReadDerc20';
export declare class ReadWriteDerc20 extends ReadDerc20 {
    contract: ReadWriteContract<Derc20ABI>;
    constructor(address: Address, drift?: Drift<ReadWriteAdapter>);
    approve(spender: Address, value: bigint): Promise<Hex>;
}
