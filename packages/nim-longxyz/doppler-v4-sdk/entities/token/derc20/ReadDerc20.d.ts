import { ReadContract, ReadAdapter, Drift } from '@delvtech/drift';
import { Address } from 'abitype';
import { derc20Abi } from '@/abis';
export type Derc20ABI = typeof derc20Abi;
export declare class ReadDerc20 {
    contract: ReadContract<Derc20ABI>;
    constructor(address: `0x${string}`, drift?: Drift<ReadAdapter>);
    getName(): Promise<string>;
    getSymbol(): Promise<string>;
    getDecimals(): Promise<number>;
    getAllowance(owner: Address, spender: Address): Promise<bigint>;
    getBalanceOf(account: Address): Promise<bigint>;
}
