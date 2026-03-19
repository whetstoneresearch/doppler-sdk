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
import { INT24_MIN, INT24_MAX } from '../../constants';
import { decodeBalanceDelta } from '../../utils';
import { resolveGasEstimate } from '../../utils/gasEstimate';
import { OpeningAuction } from './OpeningAuction';

export interface OpeningAuctionModifyLiquidityParams {
  tickLower: number;
  tickUpper: number;
  liquidityDelta: bigint;
  salt: Hash; // bytes32
}

export interface OpeningAuctionModifyLiquiditySimulationResult {
  request: unknown;
  gasEstimate: bigint;
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
    format: 'packed' | 'abi' = 'packed',
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
    const { tickLower, tickUpper } =
      OpeningAuctionPositionManager.validateSingleTick({
        key: args.key,
        tickLower: args.tickLower,
      });

    return {
      tickLower,
      tickUpper,
      liquidityDelta: args.liquidityDelta,
      salt: args.salt ?? zeroHash,
    };
  }

  static validateSingleTick(args: {
    key: V4PoolKey;
    tickLower: number;
    tickUpper?: number;
  }): { tickLower: number; tickUpper: number } {
    if (!Number.isInteger(args.tickLower)) {
      throw new Error('tickLower must be an integer int24');
    }
    if (args.tickLower < INT24_MIN || args.tickLower > INT24_MAX) {
      throw new Error(
        `tickLower out of int24 bounds (${INT24_MIN}..${INT24_MAX})`,
      );
    }
    if (!Number.isInteger(args.key.tickSpacing) || args.key.tickSpacing <= 0) {
      throw new Error('tickSpacing must be a positive integer');
    }
    if (args.tickLower % args.key.tickSpacing !== 0) {
      throw new Error(
        `tickLower (${args.tickLower}) must align to tickSpacing (${args.key.tickSpacing})`,
      );
    }

    const tickUpper = args.tickUpper ?? args.tickLower + args.key.tickSpacing;
    if (!Number.isInteger(tickUpper)) {
      throw new Error('tickUpper must be an integer int24');
    }
    if (tickUpper < INT24_MIN || tickUpper > INT24_MAX) {
      throw new Error(
        `tickUpper out of int24 bounds (${INT24_MIN}..${INT24_MAX})`,
      );
    }
    if (tickUpper - args.tickLower !== args.key.tickSpacing) {
      throw new Error(
        `single-tick bids require tickUpper - tickLower == tickSpacing (${args.key.tickSpacing})`,
      );
    }

    return {
      tickLower: args.tickLower,
      tickUpper,
    };
  }

  private static assertPositiveLiquidity(
    liquidity: bigint,
    operation: 'placeBid' | 'withdrawBid',
  ): void {
    if (liquidity <= 0n) {
      throw new Error(`${operation} requires liquidity > 0`);
    }
  }

  private async estimateModifyLiquidityGas(
    args:
      | {
          key: V4PoolKey;
          params: OpeningAuctionModifyLiquidityParams;
          account?: Address | Account;
        }
      | {
          key: V4PoolKey;
          params: OpeningAuctionModifyLiquidityParams;
          hookData: Hex;
          account?: Address | Account;
        },
  ): Promise<bigint> {
    if ('hookData' in args) {
      return await this.rpc.estimateContractGas({
        address: this.positionManagerAddress,
        abi: openingAuctionPositionManagerAbi,
        functionName: 'modifyLiquidity',
        args: [args.key, args.params, args.hookData],
        account: args.account ?? this.walletClient?.account,
      } as any);
    }

    return await this.rpc.estimateContractGas({
      address: this.positionManagerAddress,
      abi: openingAuctionPositionManagerAbi,
      functionName: 'modifyLiquidity',
      args: [args.key, args.params],
      account: args.account ?? this.walletClient?.account,
    } as any);
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

    const gasEstimate = await resolveGasEstimate(request, () =>
      this.estimateModifyLiquidityGas({ key, params, account }),
    );

    const delta = result as unknown as bigint;
    return {
      request,
      gasEstimate,
      delta,
      decoded: decodeBalanceDelta(delta),
    };
  }

  async estimateModifyLiquidityGasWithoutHookData(
    key: V4PoolKey,
    params: OpeningAuctionModifyLiquidityParams,
    account?: Address | Account,
  ): Promise<bigint> {
    return await this.estimateModifyLiquidityGas({ key, params, account });
  }

  async estimateModifyLiquidityGasWithHookData(
    key: V4PoolKey,
    params: OpeningAuctionModifyLiquidityParams,
    hookData: Hex,
    account?: Address | Account,
  ): Promise<bigint> {
    return await this.estimateModifyLiquidityGas({
      key,
      params,
      hookData,
      account,
    });
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

    const gasEstimate = await resolveGasEstimate(request, () =>
      this.estimateModifyLiquidityGas({ key, params, hookData, account }),
    );

    const delta = result as unknown as bigint;
    return {
      request,
      gasEstimate,
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
    OpeningAuctionPositionManager.assertPositiveLiquidity(
      args.liquidity,
      'placeBid',
    );

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

  async estimatePlaceBidGas(args: {
    key: V4PoolKey;
    tickLower: number;
    liquidity: bigint;
    salt?: Hash;
    hookData?: Hex;
    account?: Address | Account;
  }): Promise<bigint> {
    const simulation = await this.simulatePlaceBid(args);
    return simulation.gasEstimate;
  }

  async placeBid(args: {
    key: V4PoolKey;
    tickLower: number;
    liquidity: bigint;
    salt?: Hash;
    hookData?: Hex;
  }): Promise<Hash> {
    OpeningAuctionPositionManager.assertPositiveLiquidity(
      args.liquidity,
      'placeBid',
    );

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
    OpeningAuctionPositionManager.assertPositiveLiquidity(
      args.liquidity,
      'withdrawBid',
    );

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

  async estimateWithdrawBidGas(args: {
    key: V4PoolKey;
    tickLower: number;
    liquidity: bigint;
    salt?: Hash;
    hookData?: Hex;
    account?: Address | Account;
  }): Promise<bigint> {
    const simulation = await this.simulateWithdrawBid(args);
    return simulation.gasEstimate;
  }

  async withdrawBid(args: {
    key: V4PoolKey;
    tickLower: number;
    liquidity: bigint;
    salt?: Hash;
    hookData?: Hex;
  }): Promise<Hash> {
    OpeningAuctionPositionManager.assertPositiveLiquidity(
      args.liquidity,
      'withdrawBid',
    );

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
        : (args.account?.address ??
          (typeof this.walletClient?.account === 'string'
            ? this.walletClient.account
            : this.walletClient?.account?.address));
    const owner = args.owner ?? accountAddress;
    if (!owner) {
      throw new Error(
        'owner (or account/walletClient) is required to resolve positionId',
      );
    }

    const { tickLower, tickUpper } =
      OpeningAuctionPositionManager.validateSingleTick({
        key: args.key,
        tickLower: args.tickLower,
      });
    const salt = args.salt ?? zeroHash;

    const positionId = await opening.getPositionId({
      owner,
      tickLower,
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
      tickLower,
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
      typeof walletAccount === 'string'
        ? walletAccount
        : walletAccount?.address;
    if (!walletAddress) {
      throw new Error('Wallet client must have an account configured');
    }

    const opening = new OpeningAuction(
      this.publicClient,
      this.walletClient,
      args.openingAuctionHookAddress,
    );
    const owner = args.owner ?? walletAddress;
    const { tickLower, tickUpper } =
      OpeningAuctionPositionManager.validateSingleTick({
        key: args.key,
        tickLower: args.tickLower,
      });
    const salt = args.salt ?? zeroHash;

    const positionId = await opening.getPositionId({
      owner,
      tickLower,
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
      tickLower,
      liquidity,
      salt,
      hookData: args.hookData,
    });

    return { positionId, liquidity, transactionHash };
  }
}
