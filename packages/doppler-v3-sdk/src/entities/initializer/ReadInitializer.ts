import { ReadContract, ReadAdapter, Drift } from '@delvtech/drift';
import { Address } from 'viem';
import { uniswapV3InitializerAbi } from '../../abis';

export interface PoolState {
  asset: Address;
  numeraire: Address;
  tickLower: number;
  tickUpper: number;
  numPositions: number;
  isInitialized: boolean;
  isExited: boolean;
  maxShareToBeSold: bigint;
  maxShareToBond: bigint;
}

export type UniswapV3InitializerABI = typeof uniswapV3InitializerAbi;

export class ReadUniswapV3Initializer {
  initializer: ReadContract<UniswapV3InitializerABI>;

  constructor(address: Address, drift: Drift<ReadAdapter> = new Drift()) {
    this.initializer = drift.contract({
      abi: uniswapV3InitializerAbi,
      address,
    });
  }

  async getState(pool: Address): Promise<PoolState> {
    return this.initializer.read('getState', { pool });
  }
}
