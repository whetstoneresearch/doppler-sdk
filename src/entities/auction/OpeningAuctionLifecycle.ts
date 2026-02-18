import {
  type Address,
  type Hash,
  type PublicClient,
  type WalletClient,
  type Account,
} from 'viem';
import { openingAuctionInitializerAbi } from '../../abis';
import type { OpeningAuctionState, SupportedPublicClient, V4PoolKey } from '../../types';

function normalizePoolKey(value: unknown): V4PoolKey {
  if (Array.isArray(value)) {
    const [currency0, currency1, feeRaw, tickSpacingRaw, hooks] = value as [
      Address,
      Address,
      number | bigint,
      number | bigint,
      Address,
    ];
    return {
      currency0,
      currency1,
      fee: Number(feeRaw),
      tickSpacing: Number(tickSpacingRaw),
      hooks,
    };
  }

  const obj = value as Record<string, unknown>;
  return {
    currency0: obj.currency0 as Address,
    currency1: obj.currency1 as Address,
    fee: Number(obj.fee),
    tickSpacing: Number(obj.tickSpacing),
    hooks: obj.hooks as Address,
  };
}

export class OpeningAuctionLifecycle {
  private publicClient: SupportedPublicClient;
  private walletClient?: WalletClient;
  private initializerAddress: Address;

  private get rpc(): PublicClient {
    return this.publicClient as PublicClient;
  }

  constructor(
    publicClient: SupportedPublicClient,
    walletClient: WalletClient | undefined,
    initializerAddress: Address,
  ) {
    this.publicClient = publicClient;
    this.walletClient = walletClient;
    this.initializerAddress = initializerAddress;
  }

  getAddress(): Address {
    return this.initializerAddress;
  }

  async getState(asset: Address): Promise<OpeningAuctionState> {
    const raw = await this.rpc.readContract({
      address: this.initializerAddress,
      abi: openingAuctionInitializerAbi,
      functionName: 'getState',
      args: [asset],
    });

    if (Array.isArray(raw)) {
      const [
        numeraire,
        auctionStartTime,
        auctionEndTime,
        auctionTokens,
        dopplerTokens,
        status,
        openingAuctionHook,
        dopplerHook,
        openingAuctionPoolKey,
        dopplerInitData,
        isToken0,
      ] = raw as unknown as [
        Address,
        bigint,
        bigint,
        bigint,
        bigint,
        number,
        Address,
        Address,
        unknown,
        `0x${string}`,
        boolean,
      ];

      return {
        numeraire,
        auctionStartTime,
        auctionEndTime,
        auctionTokens,
        dopplerTokens,
        status,
        openingAuctionHook,
        dopplerHook,
        openingAuctionPoolKey: normalizePoolKey(openingAuctionPoolKey),
        dopplerInitData,
        isToken0,
      };
    }

    const obj = raw as unknown as Record<string, unknown>;
    return {
      numeraire: obj.numeraire as Address,
      auctionStartTime: obj.auctionStartTime as bigint,
      auctionEndTime: obj.auctionEndTime as bigint,
      auctionTokens: obj.auctionTokens as bigint,
      dopplerTokens: obj.dopplerTokens as bigint,
      status: Number(obj.status),
      openingAuctionHook: obj.openingAuctionHook as Address,
      dopplerHook: obj.dopplerHook as Address,
      openingAuctionPoolKey: normalizePoolKey(obj.openingAuctionPoolKey),
      dopplerInitData: obj.dopplerInitData as `0x${string}`,
      isToken0: Boolean(obj.isToken0),
    };
  }

  async getOpeningAuctionHook(asset: Address): Promise<Address> {
    return await this.rpc.readContract({
      address: this.initializerAddress,
      abi: openingAuctionInitializerAbi,
      functionName: 'getOpeningAuctionHook',
      args: [asset],
    });
  }

  async getDopplerHook(asset: Address): Promise<Address> {
    return await this.rpc.readContract({
      address: this.initializerAddress,
      abi: openingAuctionInitializerAbi,
      functionName: 'getDopplerHook',
      args: [asset],
    });
  }

  async getPositionManager(): Promise<Address> {
    return await this.rpc.readContract({
      address: this.initializerAddress,
      abi: openingAuctionInitializerAbi,
      functionName: 'positionManager',
      args: [],
    });
  }

  async simulateCompleteAuction(
    asset: Address,
    dopplerSalt: `0x${string}`,
    account?: Address | Account,
  ): Promise<{ request: unknown }> {
    const { request } = await this.rpc.simulateContract({
      address: this.initializerAddress,
      abi: openingAuctionInitializerAbi,
      functionName: 'completeAuction',
      args: [asset, dopplerSalt],
      account: account ?? this.walletClient?.account,
    });
    return { request };
  }

  async completeAuction(
    asset: Address,
    dopplerSalt: `0x${string}`,
  ): Promise<Hash> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }

    const { request } = await this.simulateCompleteAuction(
      asset,
      dopplerSalt,
      this.walletClient.account,
    );

    return await this.walletClient.writeContract(request as any);
  }

  async simulateRecoverOpeningAuctionIncentives(
    asset: Address,
    account?: Address | Account,
  ): Promise<{ request: unknown }> {
    const { request } = await this.rpc.simulateContract({
      address: this.initializerAddress,
      abi: openingAuctionInitializerAbi,
      functionName: 'recoverOpeningAuctionIncentives',
      args: [asset],
      account: account ?? this.walletClient?.account,
    });
    return { request };
  }

  async recoverOpeningAuctionIncentives(asset: Address): Promise<Hash> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }

    const { request } = await this.simulateRecoverOpeningAuctionIncentives(
      asset,
      this.walletClient.account,
    );

    return await this.walletClient.writeContract(request as any);
  }

  async simulateSweepOpeningAuctionIncentives(
    asset: Address,
    account?: Address | Account,
  ): Promise<{ request: unknown }> {
    const { request } = await this.rpc.simulateContract({
      address: this.initializerAddress,
      abi: openingAuctionInitializerAbi,
      functionName: 'sweepOpeningAuctionIncentives',
      args: [asset],
      account: account ?? this.walletClient?.account,
    });
    return { request };
  }

  async sweepOpeningAuctionIncentives(asset: Address): Promise<Hash> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }

    const { request } = await this.simulateSweepOpeningAuctionIncentives(
      asset,
      this.walletClient.account,
    );

    return await this.walletClient.writeContract(request as any);
  }
}
