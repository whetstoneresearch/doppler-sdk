import {
  encodeFunctionData,
  type Account,
  type Address,
  type Hash,
  type Hex,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { topUpDistributorAbi } from '../abis';
import { ZERO_ADDRESS } from '../constants';
import type { SupportedPublicClient } from '../types';

export interface TopUpParams {
  asset: Address;
  numeraire: Address;
  amount: bigint;
}

export interface TopUpTransaction {
  to: Address;
  data: Hex;
  value?: bigint;
}

export interface TopUpSimulationResult {
  request: Parameters<WalletClient['writeContract']>[0];
}

export class TopUpDistributor {
  private publicClient: SupportedPublicClient;
  private walletClient?: WalletClient;
  private topUpDistributorAddress: Address;

  private get rpc(): PublicClient {
    return this.publicClient as PublicClient;
  }

  constructor(
    publicClient: SupportedPublicClient,
    walletClient: WalletClient | undefined,
    topUpDistributorAddress: Address,
  ) {
    this.publicClient = publicClient;
    this.walletClient = walletClient;
    this.topUpDistributorAddress = topUpDistributorAddress;
  }

  getAddress(): Address {
    return this.topUpDistributorAddress;
  }

  buildTopUpTransaction(params: TopUpParams): TopUpTransaction {
    const tx = {
      to: this.topUpDistributorAddress,
      data: encodeFunctionData({
        abi: topUpDistributorAbi,
        functionName: 'topUp',
        args: [params.asset, params.numeraire, params.amount],
      }),
    };

    if (params.numeraire === ZERO_ADDRESS) {
      return { ...tx, value: params.amount };
    }

    return tx;
  }

  async simulateTopUp(
    params: TopUpParams,
    account?: Address | Account,
  ): Promise<TopUpSimulationResult> {
    const { request } = await this.rpc.simulateContract({
      address: this.topUpDistributorAddress,
      abi: topUpDistributorAbi,
      functionName: 'topUp',
      args: [params.asset, params.numeraire, params.amount],
      account: account ?? this.walletClient?.account,
      ...(params.numeraire === ZERO_ADDRESS ? { value: params.amount } : {}),
    });

    return {
      request: request as Parameters<WalletClient['writeContract']>[0],
    };
  }

  async topUp(params: TopUpParams, options?: { gas?: bigint }): Promise<Hash> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }

    const { request } = await this.simulateTopUp(
      params,
      this.walletClient.account,
    );

    return await this.walletClient.writeContract(
      options?.gas ? { ...request, gas: options.gas } : request,
    );
  }
}
