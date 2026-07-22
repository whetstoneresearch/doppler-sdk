import type { Address, Hash, Hex, PublicClient, WalletClient } from 'viem';
import type {
  RehypeFeeDistributionInfo,
  SupportedPublicClient,
} from '../../types';
import { feesManagerAbi, rehypeDopplerHookInitializerAbi } from '../../abis';
import { ZERO_ADDRESS } from '../../constants';
import { decodeBalanceDelta } from '../../utils';
import { callAggregate3 } from '../../utils/multicall3';
import {
  normalizeRehypeFeeDistributionInfo,
  normalizeRehypeFeeSchedule,
  normalizeRehypeHookFees,
  normalizeRehypePoolInfo,
  type RehypeFeeSchedule,
  type RehypeHookFees,
  type RehypePoolInfo,
} from './contractResults';
import {
  calculatePendingFees,
  createPendingFeePreviewCalls,
  type MulticurvePendingFees,
} from './multicurve/multicurvePendingFees';

const rehypeFeesManagerAbi = [
  ...feesManagerAbi,
  { type: 'error', name: 'FeeBeneficiariesNotConfigured', inputs: [] },
] as const;

export class RehypeDopplerHookInitializer {
  private readonly client: SupportedPublicClient;
  private readonly walletClient?: WalletClient;
  private readonly hookAddress: Address;

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
    const walletClient = this.requireWalletClient(
      'Wallet client required to collect rehype fees',
    );
    const { request, result } = await this.rpc.simulateContract({
      address: this.hookAddress,
      abi: rehypeDopplerHookInitializerAbi,
      functionName: 'collectFees',
      args: [asset],
      account: walletClient.account,
    });
    const hash = await walletClient.writeContract(request);
    await this.rpc.waitForTransactionReceipt({ hash, confirmations: 1 });
    const decoded = decodeBalanceDelta(result as bigint);
    return { ...decoded, transactionHash: hash };
  }

  /**
   * Collect fees and release the caller's pending beneficiary share.
   *
   * @returns The FeesManager `collectFees` return values and transaction hash.
   * The fee amounts are newly collected pool fees, not necessarily the caller's
   * beneficiary payout.
   */
  async claimFees(poolId: Hex): Promise<{
    fees0: bigint;
    fees1: bigint;
    transactionHash: Hash;
  }> {
    const walletClient = this.requireWalletClient(
      'Wallet client required to claim rehype beneficiary fees',
    );
    const { request, result } = await this.rpc.simulateContract({
      address: this.hookAddress,
      abi: rehypeFeesManagerAbi,
      functionName: 'collectFees',
      args: [poolId],
      account: walletClient.account,
    });
    const hash = await walletClient.writeContract(request);
    await this.rpc.waitForTransactionReceipt({ hash, confirmations: 1 });
    const [fees0, fees1] = result;
    return { fees0, fees1, transactionHash: hash };
  }

  async getPendingFees(
    poolId: Hex,
    beneficiary: Address,
  ): Promise<MulticurvePendingFees> {
    const calls = createPendingFeePreviewCalls(
      this.hookAddress,
      poolId,
      beneficiary,
    );
    return calculatePendingFees(await callAggregate3(this.rpc, calls));
  }

  async updateBeneficiary(
    poolId: Hex,
    newBeneficiary: Address,
  ): Promise<{ transactionHash: Hash }> {
    if (newBeneficiary.toLowerCase() === ZERO_ADDRESS) {
      throw new Error(
        'Rehype beneficiary cannot be updated to the zero address',
      );
    }
    const walletClient = this.requireWalletClient(
      'Wallet client required to update rehype beneficiary',
    );
    const { request } = await this.rpc.simulateContract({
      address: this.hookAddress,
      abi: feesManagerAbi,
      functionName: 'updateBeneficiary',
      args: [poolId, newBeneficiary],
      account: walletClient.account,
    });
    const hash = await walletClient.writeContract(request);
    await this.rpc.waitForTransactionReceipt({ hash, confirmations: 1 });
    return { transactionHash: hash };
  }

  async claimAirlockOwnerFees(asset: Address): Promise<{
    fees0: bigint;
    fees1: bigint;
    transactionHash: Hash;
  }> {
    const walletClient = this.requireWalletClient(
      'Wallet client required to claim rehype owner fees',
    );
    const { request, result } = await this.rpc.simulateContract({
      address: this.hookAddress,
      abi: rehypeDopplerHookInitializerAbi,
      functionName: 'claimAirlockOwnerFees',
      args: [asset],
      account: walletClient.account,
    });
    const hash = await walletClient.writeContract(request);
    await this.rpc.waitForTransactionReceipt({ hash, confirmations: 1 });
    const [fees0, fees1] = result;
    return { fees0, fees1, transactionHash: hash };
  }

  async getFeeDistributionInfo(
    poolId: Hex,
  ): Promise<RehypeFeeDistributionInfo> {
    const result = await this.rpc.readContract({
      address: this.hookAddress,
      abi: rehypeDopplerHookInitializerAbi,
      functionName: 'getFeeDistributionInfo',
      args: [poolId],
    });
    return normalizeRehypeFeeDistributionInfo(result);
  }

  async getFeeRoutingMode(poolId: Hex): Promise<number> {
    const mode = await this.rpc.readContract({
      address: this.hookAddress,
      abi: rehypeDopplerHookInitializerAbi,
      functionName: 'getFeeRoutingMode',
      args: [poolId],
    });
    return Number(mode);
  }

  async getFeeSchedule(poolId: Hex): Promise<RehypeFeeSchedule> {
    const result = await this.rpc.readContract({
      address: this.hookAddress,
      abi: rehypeDopplerHookInitializerAbi,
      functionName: 'getFeeSchedule',
      args: [poolId],
    });
    return normalizeRehypeFeeSchedule(result);
  }

  async getHookFees(poolId: Hex): Promise<RehypeHookFees> {
    const result = await this.rpc.readContract({
      address: this.hookAddress,
      abi: rehypeDopplerHookInitializerAbi,
      functionName: 'getHookFees',
      args: [poolId],
    });
    return normalizeRehypeHookFees(result);
  }

  async getPoolInfo(poolId: Hex): Promise<RehypePoolInfo> {
    const result = await this.rpc.readContract({
      address: this.hookAddress,
      abi: rehypeDopplerHookInitializerAbi,
      functionName: 'getPoolInfo',
      args: [poolId],
    });
    return normalizeRehypePoolInfo(result);
  }

  private requireWalletClient(message: string): WalletClient {
    if (!this.walletClient) {
      throw new Error(message);
    }
    return this.walletClient;
  }
}
