import type { Address, Hash, Hex, PublicClient, WalletClient } from 'viem';
import type {
  RehypeFeeDistributionInfo,
  SupportedPublicClient,
} from '../../types';
import { rehypeDopplerHookAbi } from '../../abis';
import { decodeBalanceDelta } from '../../utils';
import {
  normalizeRehypeFeeDistributionInfo,
  normalizeRehypeFeeSchedule,
  normalizeRehypeHookFees,
  normalizeRehypePoolInfo,
  type RehypeFeeSchedule,
  type RehypeHookFees,
  type RehypePoolInfo,
} from './contractResults';

export class RehypeDopplerHook {
  private client: SupportedPublicClient;
  private walletClient?: WalletClient;
  private hookAddress: Address;
  private get rpc(): PublicClient {
    return this.client as PublicClient;
  }

  constructor(
    client: SupportedPublicClient,
    walletClient: WalletClient | undefined,
    hookAddress: Address,
  ) {
    this.client = client;
    this.walletClient = walletClient;
    this.hookAddress = hookAddress;
  }

  getAddress(): Address {
    return this.hookAddress;
  }

  async collectFees(asset: Address): Promise<{
    amount0: bigint;
    amount1: bigint;
    transactionHash: Hash;
  }> {
    if (!this.walletClient) {
      throw new Error('Wallet client required to collect rehype fees');
    }

    const { request, result } = await this.rpc.simulateContract({
      address: this.hookAddress,
      abi: rehypeDopplerHookAbi,
      functionName: 'collectFees',
      args: [asset],
      account: this.walletClient.account,
    });

    const hash = await this.walletClient.writeContract(request);
    await this.rpc.waitForTransactionReceipt({ hash, confirmations: 1 });

    const decoded = decodeBalanceDelta(result as bigint);
    return {
      amount0: decoded.amount0,
      amount1: decoded.amount1,
      transactionHash: hash,
    };
  }

  async claimAirlockOwnerFees(asset: Address): Promise<{
    fees0: bigint;
    fees1: bigint;
    transactionHash: Hash;
  }> {
    if (!this.walletClient) {
      throw new Error('Wallet client required to claim rehype owner fees');
    }

    const { request, result } = await this.rpc.simulateContract({
      address: this.hookAddress,
      abi: rehypeDopplerHookAbi,
      functionName: 'claimAirlockOwnerFees',
      args: [asset],
      account: this.walletClient.account,
    });

    const hash = await this.walletClient.writeContract(request);
    await this.rpc.waitForTransactionReceipt({ hash, confirmations: 1 });

    const [fees0, fees1] = result as readonly [bigint, bigint];
    return { fees0, fees1, transactionHash: hash };
  }

  async getFeeDistributionInfo(
    poolId: Hex,
  ): Promise<RehypeFeeDistributionInfo> {
    const result = await this.rpc.readContract({
      address: this.hookAddress,
      abi: rehypeDopplerHookAbi,
      functionName: 'getFeeDistributionInfo',
      args: [poolId],
    });

    return normalizeRehypeFeeDistributionInfo(result);
  }

  async getFeeRoutingMode(poolId: Hex): Promise<number> {
    const mode = await this.rpc.readContract({
      address: this.hookAddress,
      abi: rehypeDopplerHookAbi,
      functionName: 'getFeeRoutingMode',
      args: [poolId],
    });
    return Number(mode);
  }

  async getFeeSchedule(poolId: Hex): Promise<RehypeFeeSchedule> {
    const result = await this.rpc.readContract({
      address: this.hookAddress,
      abi: rehypeDopplerHookAbi,
      functionName: 'getFeeSchedule',
      args: [poolId],
    });

    return normalizeRehypeFeeSchedule(result);
  }

  async getHookFees(poolId: Hex): Promise<RehypeHookFees> {
    const result = await this.rpc.readContract({
      address: this.hookAddress,
      abi: rehypeDopplerHookAbi,
      functionName: 'getHookFees',
      args: [poolId],
    });

    return normalizeRehypeHookFees(result);
  }

  async getPoolInfo(poolId: Hex): Promise<RehypePoolInfo> {
    const result = await this.rpc.readContract({
      address: this.hookAddress,
      abi: rehypeDopplerHookAbi,
      functionName: 'getPoolInfo',
      args: [poolId],
    });

    return normalizeRehypePoolInfo(result);
  }
}
