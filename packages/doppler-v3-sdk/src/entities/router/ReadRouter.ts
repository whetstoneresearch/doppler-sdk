import { ReadContract, ReadAdapter, Drift } from '@delvtech/drift';
import { Address } from 'viem';
import { onchainRouterAbi } from '@/abis/abis';

type OnchainRouterABI = typeof onchainRouterAbi;

export interface SwapParams {
  tokenIn: Address;
  tokenOut: Address;
  amountSpecified: bigint;
}

export interface Pool {
  tokenIn: Address;
  tokenOut: Address;
  fee: number;
  pool: Address;
  version: boolean;
}

export interface Quote {
  path: readonly Pool[];
  amountIn: bigint;
  amountOut: bigint;
}

export class ReadRouter {
  contract: ReadContract<OnchainRouterABI>;

  constructor(address: Address, drift: Drift<ReadAdapter> = new Drift()) {
    this.contract = drift.contract({
      abi: onchainRouterAbi,
      address,
    });
  }

  async routeExactInput(params: SwapParams): Promise<Quote> {
    return this.contract.read('routeExactInput', { params });
  }

  async routeExactOutput(params: SwapParams): Promise<Quote> {
    return this.contract.read('routeExactOutput', { params });
  }
}
