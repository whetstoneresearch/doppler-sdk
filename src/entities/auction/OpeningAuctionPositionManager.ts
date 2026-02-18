import {
  type Account,
  type Address,
  type Hash,
  type Hex,
  type PublicClient,
  type WalletClient,
  encodeAbiParameters,
  encodePacked,
  keccak256,
  zeroHash,
} from 'viem';
import { openingAuctionPositionManagerAbi } from '../../abis';
import type { SupportedPublicClient, V4PoolKey } from '../../types';
import { decodeBalanceDelta } from '../../utils';
import { OpeningAuction } from './OpeningAuction';

export interface OpeningAuctionModifyLiquidityParams {
  tickLower: number;
  tickUpper: number;
  liquidityDelta: bigint;
  salt: Hash; // bytes32
}

export interface OpeningAuctionModifyLiquiditySimulationResult {
  request: unknown;
  delta: bigint;
  decoded: {
    amount0: bigint;
    amount1: bigint;
  };
}

export interface OpeningAuctionWithdrawFullBidSimulationResult {
  positionId: bigint;
  liquidity: bigint;
  simulation: OpeningAuctionModifyLiquiditySimulationResult;
}

export interface OpeningAuctionWithdrawFullBidResult {
  positionId: bigint;
  liquidity: bigint;
  transactionHash: Hash;
}

/**
 * Minimal wrapper around the onchain OpeningAuctionPositionManager.
 *
 * This contract is the intended entrypoint for users to add/remove liquidity
 * during the OpeningAuction, enforcing that the owner encoded in `hookData`
 * matches `msg.sender` to prevent unauthorized removals.
 */
export class OpeningAuctionPositionManager {
  private publicClient: SupportedPublicClient;
  private walletClient?: WalletClient;
  private positionManagerAddress: Address;

  private get rpc(): PublicClient {
    return this.publicClient as PublicClient;
  }

  constructor(
    publicClient: SupportedPublicClient,
    walletClient: WalletClient | undefined,
    positionManagerAddress: Address,
  ) {
    this.publicClient = publicClient;
    this.walletClient = walletClient;
    this.positionManagerAddress = positionManagerAddress;
  }

  getAddress(): Address {
    return this.positionManagerAddress;
  }

  async getPoolManager(): Promise<Address> {
    return await this.rpc.readContract({
      address: this.positionManagerAddress,
      abi: openingAuctionPositionManagerAbi,
      functionName: 'poolManager',
    });
  }

  static encodeOwnerHookData(
    owner: Address,
    format: 'packed' | 'abi' = 'abi',
  ): Hex {
    // The hook accepts either 20-byte packed address or ABI-encoded address.
    if (format === 'packed') return owner as unknown as Hex;
    return encodeAbiParameters([{ type: 'address' }], [owner]);
  }

  static decodeDelta(delta: bigint): { amount0: bigint; amount1: bigint } {
    return decodeBalanceDelta(delta);
  }

  static computePositionKey(args: {
    owner: Address;
    tickLower: number;
    tickUpper: number;
    salt: Hash;
  }): Hash {
    // Mirrors `keccak256(abi.encodePacked(owner, tickLower, tickUpper, salt))`.
    return keccak256(
      encodePacked(
        ['address', 'int24', 'int24', 'bytes32'],
        [args.owner, args.tickLower, args.tickUpper, args.salt],
      ),
    );
  }

  static buildSingleTickParams(args: {
    key: V4PoolKey;
    tickLower: number;
    liquidityDelta: bigint;
    salt?: Hash;
  }): OpeningAuctionModifyLiquidityParams {
    return {
      tickLower: args.tickLower,
      tickUpper: args.tickLower + args.key.tickSpacing,
      liquidityDelta: args.liquidityDelta,
      salt: args.salt ?? zeroHash,
    };
  }

  async simulateModifyLiquidity(
    key: V4PoolKey,
    params: OpeningAuctionModifyLiquidityParams,
    account?: Address | Account,
  ): Promise<OpeningAuctionModifyLiquiditySimulationResult> {
    const { request, result } = await this.rpc.simulateContract({
      address: this.positionManagerAddress,
      abi: openingAuctionPositionManagerAbi,
      functionName: 'modifyLiquidity',
      args: [key, params],
      account: account ?? this.walletClient?.account,
    } as any);

    const delta = result as unknown as bigint;
    return {
      request,
      delta,
      decoded: decodeBalanceDelta(delta),
    };
  }

  async modifyLiquidity(
    key: V4PoolKey,
    params: OpeningAuctionModifyLiquidityParams,
  ): Promise<Hash> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }

    const { request } = await this.simulateModifyLiquidity(
      key,
      params,
      this.walletClient.account,
    );

    return await this.walletClient.writeContract(request as any);
  }

  async simulateModifyLiquidityWithHookData(
    key: V4PoolKey,
    params: OpeningAuctionModifyLiquidityParams,
    hookData: Hex,
    account?: Address | Account,
  ): Promise<OpeningAuctionModifyLiquiditySimulationResult> {
    const { request, result } = await this.rpc.simulateContract({
      address: this.positionManagerAddress,
      abi: openingAuctionPositionManagerAbi,
      functionName: 'modifyLiquidity',
      args: [key, params, hookData],
      account: account ?? this.walletClient?.account,
    } as any);

    const delta = result as unknown as bigint;
    return {
      request,
      delta,
      decoded: decodeBalanceDelta(delta),
    };
  }

  async modifyLiquidityWithHookData(
    key: V4PoolKey,
    params: OpeningAuctionModifyLiquidityParams,
    hookData: Hex,
  ): Promise<Hash> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }

    const { request } = await this.simulateModifyLiquidityWithHookData(
      key,
      params,
      hookData,
      this.walletClient.account,
    );

    return await this.walletClient.writeContract(request as any);
  }

  async simulatePlaceBid(args: {
    key: V4PoolKey;
    tickLower: number;
    liquidity: bigint;
    salt?: Hash;
    hookData?: Hex;
    account?: Address | Account;
  }): Promise<OpeningAuctionModifyLiquiditySimulationResult> {
    const params = OpeningAuctionPositionManager.buildSingleTickParams({
      key: args.key,
      tickLower: args.tickLower,
      liquidityDelta: args.liquidity,
      salt: args.salt,
    });

    if (args.hookData) {
      return this.simulateModifyLiquidityWithHookData(
        args.key,
        params,
        args.hookData,
        args.account,
      );
    }

    return this.simulateModifyLiquidity(args.key, params, args.account);
  }

  async placeBid(args: {
    key: V4PoolKey;
    tickLower: number;
    liquidity: bigint;
    salt?: Hash;
    hookData?: Hex;
  }): Promise<Hash> {
    const params = OpeningAuctionPositionManager.buildSingleTickParams({
      key: args.key,
      tickLower: args.tickLower,
      liquidityDelta: args.liquidity,
      salt: args.salt,
    });

    if (args.hookData) {
      return this.modifyLiquidityWithHookData(args.key, params, args.hookData);
    }

    return this.modifyLiquidity(args.key, params);
  }

  async simulateWithdrawBid(args: {
    key: V4PoolKey;
    tickLower: number;
    liquidity: bigint;
    salt?: Hash;
    hookData?: Hex;
    account?: Address | Account;
  }): Promise<OpeningAuctionModifyLiquiditySimulationResult> {
    const params = OpeningAuctionPositionManager.buildSingleTickParams({
      key: args.key,
      tickLower: args.tickLower,
      liquidityDelta: -args.liquidity,
      salt: args.salt,
    });

    if (args.hookData) {
      return this.simulateModifyLiquidityWithHookData(
        args.key,
        params,
        args.hookData,
        args.account,
      );
    }

    return this.simulateModifyLiquidity(args.key, params, args.account);
  }

  async withdrawBid(args: {
    key: V4PoolKey;
    tickLower: number;
    liquidity: bigint;
    salt?: Hash;
    hookData?: Hex;
  }): Promise<Hash> {
    const params = OpeningAuctionPositionManager.buildSingleTickParams({
      key: args.key,
      tickLower: args.tickLower,
      liquidityDelta: -args.liquidity,
      salt: args.salt,
    });

    if (args.hookData) {
      return this.modifyLiquidityWithHookData(args.key, params, args.hookData);
    }

    return this.modifyLiquidity(args.key, params);
  }

  async simulateWithdrawFullBid(args: {
    openingAuctionHookAddress: Address;
    key: V4PoolKey;
    tickLower: number;
    salt?: Hash;
    hookData?: Hex;
    owner?: Address;
    account?: Address | Account;
  }): Promise<OpeningAuctionWithdrawFullBidSimulationResult> {
    const opening = new OpeningAuction(
      this.publicClient,
      this.walletClient,
      args.openingAuctionHookAddress,
    );

    const accountAddress =
      typeof args.account === 'string'
        ? args.account
        : args.account?.address ??
          (typeof this.walletClient?.account === 'string'
            ? this.walletClient.account
            : this.walletClient?.account?.address);
    const owner = args.owner ?? accountAddress;
    if (!owner) {
      throw new Error(
        'owner (or account/walletClient) is required to resolve positionId',
      );
    }

    const tickUpper = args.tickLower + args.key.tickSpacing;
    const salt = args.salt ?? zeroHash;

    const positionId = await opening.getPositionId({
      owner,
      tickLower: args.tickLower,
      tickUpper,
      salt,
    });

    if (positionId === 0n) {
      throw new Error('Position not found for the given (owner,ticks,salt)');
    }

    const position = await opening.getPosition(positionId);
    const liquidity = position.liquidity;
    if (liquidity === 0n) {
      throw new Error('Position has zero liquidity');
    }

    const simulation = await this.simulateWithdrawBid({
      key: args.key,
      tickLower: args.tickLower,
      liquidity,
      salt,
      hookData: args.hookData,
      account: args.account,
    });

    return { positionId, liquidity, simulation };
  }

  async withdrawFullBid(args: {
    openingAuctionHookAddress: Address;
    key: V4PoolKey;
    tickLower: number;
    salt?: Hash;
    hookData?: Hex;
    owner?: Address;
  }): Promise<OpeningAuctionWithdrawFullBidResult> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }

    const walletAccount = this.walletClient.account;
    const walletAddress =
      typeof walletAccount === 'string' ? walletAccount : walletAccount?.address;
    if (!walletAddress) {
      throw new Error('Wallet client must have an account configured');
    }

    const opening = new OpeningAuction(
      this.publicClient,
      this.walletClient,
      args.openingAuctionHookAddress,
    );
    const owner = args.owner ?? walletAddress;
    const tickUpper = args.tickLower + args.key.tickSpacing;
    const salt = args.salt ?? zeroHash;

    const positionId = await opening.getPositionId({
      owner,
      tickLower: args.tickLower,
      tickUpper,
      salt,
    });

    if (positionId === 0n) {
      throw new Error('Position not found for the given (owner,ticks,salt)');
    }

    const position = await opening.getPosition(positionId);
    const liquidity = position.liquidity;
    if (liquidity === 0n) {
      throw new Error('Position has zero liquidity');
    }

    const transactionHash = await this.withdrawBid({
      key: args.key,
      tickLower: args.tickLower,
      liquidity,
      salt,
      hookData: args.hookData,
    });

    return { positionId, liquidity, transactionHash };
  }
}
