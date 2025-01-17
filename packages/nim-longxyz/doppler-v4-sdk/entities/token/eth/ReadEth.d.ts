import { ReadAdapter, Drift } from '@delvtech/drift';
import { Address } from 'abitype';
export declare class ReadEth {
    drift: Drift<ReadAdapter>;
    static address: string;
    constructor(drift?: Drift<ReadAdapter>);
    getName(): Promise<string>;
    getSymbol(): Promise<string>;
    getDecimals(): Promise<number>;
    getAllowance(): Promise<bigint>;
    getBalanceOf(account: Address): Promise<bigint>;
}
