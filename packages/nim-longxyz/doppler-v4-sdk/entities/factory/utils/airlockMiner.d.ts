import { Address, Hash } from 'viem';
export interface MineParams {
    poolManager: Address;
    numTokensToSell: bigint;
    minTick: number;
    maxTick: number;
    airlock: Address;
    name: string;
    symbol: string;
    initialSupply: bigint;
    numeraire: Address;
    startingTime: bigint;
    endingTime: bigint;
    minimumProceeds: bigint;
    maximumProceeds: bigint;
    epochLength: bigint;
    gamma: number;
    numPDSlugs: bigint;
}
export declare function mine(tokenFactory: Address, hookFactory: Address, params: MineParams): [Hash, Address, Address];
