import type { Account, Address, Hash, PublicClient, WalletClient } from 'viem';
import { bundlerAbi } from '../abis';
import type { SupportedPublicClient } from '../types';

/**
 * A token position held by Bundler for linear vesting.
 *
 * All timestamps and durations are expressed in seconds. Claims always pay the
 * recorded `recipient`; `permissionlessClaim` only controls who may trigger
 * the claim.
 */
export interface BundlerVestingPosition {
  recipient: Address;
  permissionlessClaim: boolean;
  start: bigint;
  cliffDuration: bigint;
  vestingDuration: bigint;
  totalAmount: bigint;
  claimedAmount: bigint;
}

/** Result of simulating a Bundler vesting claim. */
export interface BundlerClaimSimulation {
  amount: bigint;
  request: Parameters<WalletClient['writeContract']>[0];
}

/**
 * Client for reading and claiming token positions held by a Bundler contract.
 */
export class Bundler {
  private publicClient: SupportedPublicClient;
  private walletClient?: WalletClient;
  private bundlerAddress: Address;

  constructor(
    publicClient: SupportedPublicClient,
    walletClient: WalletClient | undefined,
    bundlerAddress: Address,
  ) {
    this.publicClient = publicClient;
    this.walletClient = walletClient;
    this.bundlerAddress = bundlerAddress;
  }

  private get rpc(): PublicClient {
    return this.publicClient as PublicClient;
  }

  /** Returns the Bundler contract address used by this client. */
  getAddress(): Address {
    return this.bundlerAddress;
  }

  /**
   * Reads the vesting position for an asset.
   *
   * @param asset Token whose Bundler position should be read.
   */
  async getVesting(asset: Address): Promise<BundlerVestingPosition> {
    const result = await this.rpc.readContract({
      address: this.bundlerAddress,
      abi: bundlerAbi,
      functionName: 'vestingOf',
      args: [asset],
    });
    const values = result as readonly [
      Address,
      boolean,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
    ];

    return {
      recipient: values[0],
      permissionlessClaim: values[1],
      start: values[2],
      cliffDuration: values[3],
      vestingDuration: values[4],
      totalAmount: values[5],
      claimedAmount: values[6],
    };
  }

  /**
   * Returns the amount currently claimable for an asset.
   *
   * @param asset Token whose claimable amount should be read.
   */
  async getClaimable(asset: Address): Promise<bigint> {
    return (await this.rpc.readContract({
      address: this.bundlerAddress,
      abi: bundlerAbi,
      functionName: 'claimable',
      args: [asset],
    })) as bigint;
  }

  /**
   * Simulates a claim and returns both the claimable amount and write request.
   *
   * The caller defaults to the configured wallet account. Pass `account` when
   * using a read-only SDK instance. For restricted positions, the caller must
   * be the recorded recipient.
   *
   * @param asset Token to claim.
   * @param account Account that will trigger the claim.
   */
  async simulateClaim(
    asset: Address,
    account?: Address | Account,
  ): Promise<BundlerClaimSimulation> {
    const resolvedAccount = account ?? this.walletClient?.account;
    if (!resolvedAccount) {
      throw new Error(
        'An account is required to simulate a Bundler vesting claim',
      );
    }

    const { request, result } = await this.rpc.simulateContract({
      address: this.bundlerAddress,
      abi: bundlerAbi,
      functionName: 'claim',
      args: [asset],
      account: resolvedAccount,
    });

    return {
      amount: result as bigint,
      request: request as Parameters<WalletClient['writeContract']>[0],
    };
  }

  /**
   * Claims the currently vested amount to the position's recorded recipient.
   *
   * Requires a configured wallet client. Permissionless callers may trigger a
   * claim but cannot redirect its proceeds.
   *
   * @param asset Token to claim.
   * @param options Optional transaction gas override.
   * @returns Submitted transaction hash.
   */
  async claim(asset: Address, options?: { gas?: bigint }): Promise<Hash> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }

    const { request } = await this.simulateClaim(
      asset,
      this.walletClient.account,
    );
    return await this.walletClient.writeContract(
      options?.gas === undefined ? request : { ...request, gas: options.gas },
    );
  }
}
