import { type Address, type PublicClient, type Hex, zeroAddress } from 'viem';
import type { HookInfo, SupportedPublicClient } from '../../types';
import { dopplerHookAbi, airlockAbi } from '../../abis';
import { getAddresses } from '../../addresses';
import { computePoolId, normalizePoolKey } from '../../utils/poolKey';
import {
  normalizeDynamicHookState,
  parseAirlockLiquidityMigrator,
  type DynamicHookState,
} from './contractResults';

/**
 * DynamicAuction class for interacting with dynamic auctions (Uniswap V4 hook based)
 *
 * Dynamic auctions use a Uniswap V4 hook to create a gradual Dutch auction
 * where the price moves dynamically over time according to set parameters.
 */
export class DynamicAuction {
  private client: SupportedPublicClient;
  private hookAddress: Address;
  private get rpc(): PublicClient {
    return this.client as PublicClient;
  }

  constructor(client: SupportedPublicClient, hookAddress: Address) {
    this.client = client;
    this.hookAddress = hookAddress;
  }

  /**
   * Wait for a transaction to be confirmed and the contract to be ready for reads
   * @param hash - Transaction hash to wait for
   * @param confirmations - Number of block confirmations to wait for (default: 2)
   */
  async waitForDeployment(hash: Hex, confirmations: number = 2): Promise<void> {
    await this.rpc.waitForTransactionReceipt({ hash, confirmations });
  }

  /**
   * Get the hook address
   */
  getAddress(): Address {
    return this.hookAddress;
  }

  /**
   * Get current hook information
   */
  async getHookInfo(): Promise<HookInfo> {
    // Fetch all hook data in parallel
    const [
      state,
      earlyExit,
      insufficientProceeds,
      poolKeyRaw,
      startingTime,
      endingTime,
      epochLength,
      minimumProceeds,
      maximumProceeds,
    ] = await Promise.all([
      this.readHookState(),
      this.rpc.readContract({
        address: this.hookAddress,
        abi: dopplerHookAbi,
        functionName: 'earlyExit',
      }),
      this.rpc.readContract({
        address: this.hookAddress,
        abi: dopplerHookAbi,
        functionName: 'insufficientProceeds',
      }),
      this.rpc.readContract({
        address: this.hookAddress,
        abi: dopplerHookAbi,
        functionName: 'poolKey',
      }),
      this.rpc.readContract({
        address: this.hookAddress,
        abi: dopplerHookAbi,
        functionName: 'startingTime',
      }),
      this.rpc.readContract({
        address: this.hookAddress,
        abi: dopplerHookAbi,
        functionName: 'endingTime',
      }),
      this.rpc.readContract({
        address: this.hookAddress,
        abi: dopplerHookAbi,
        functionName: 'epochLength',
      }),
      this.rpc.readContract({
        address: this.hookAddress,
        abi: dopplerHookAbi,
        functionName: 'minimumProceeds',
      }),
      this.rpc.readContract({
        address: this.hookAddress,
        abi: dopplerHookAbi,
        functionName: 'maximumProceeds',
      }),
    ]);

    // Calculate current epoch
    const currentTime = BigInt(Math.floor(Date.now() / 1000));
    const elapsedTime =
      currentTime > startingTime ? currentTime - startingTime : BigInt(0);
    const currentEpoch =
      epochLength > 0n ? Number(elapsedTime / epochLength) : 0;

    // Determine token addresses from poolKey
    const poolKey = normalizePoolKey(poolKeyRaw);
    const isToken0 = poolKey.currency0 !== zeroAddress;
    const tokenAddress = isToken0 ? poolKey.currency0 : poolKey.currency1;
    const numeraireAddress = isToken0 ? poolKey.currency1 : poolKey.currency0;

    // Compute pool ID
    const poolId = computePoolId(poolKey);

    return {
      hookAddress: this.hookAddress,
      tokenAddress,
      numeraireAddress,
      poolId,
      currentEpoch,
      totalProceeds: state.totalProceeds,
      totalTokensSold: state.totalTokensSold,
      earlyExit,
      insufficientProceeds,
      startingTime,
      endingTime,
      epochLength,
      minimumProceeds,
      maximumProceeds,
    };
  }

  /**
   * Get the token address for this auction
   */
  async getTokenAddress(): Promise<Address> {
    const poolKeyRaw = await this.rpc.readContract({
      address: this.hookAddress,
      abi: dopplerHookAbi,
      functionName: 'poolKey',
    });
    const poolKey = normalizePoolKey(poolKeyRaw);

    const isToken0 = await this.rpc.readContract({
      address: this.hookAddress,
      abi: dopplerHookAbi,
      functionName: 'isToken0',
    });

    return isToken0 ? poolKey.currency0 : poolKey.currency1;
  }

  /**
   * Get the pool ID for this auction
   */
  async getPoolId(): Promise<string> {
    const poolKeyRaw = await this.rpc.readContract({
      address: this.hookAddress,
      abi: dopplerHookAbi,
      functionName: 'poolKey',
    });
    const poolKey = normalizePoolKey(poolKeyRaw);
    return computePoolId(poolKey);
  }

  /**
   * Check if the auction has graduated (ready for migration)
   */
  async hasGraduated(): Promise<boolean> {
    const tokenAddress = await this.getTokenAddress();
    const chainId = await this.rpc.getChainId();
    const addresses = getAddresses(chainId);

    const assetData = await this.rpc.readContract({
      address: addresses.airlock,
      abi: airlockAbi,
      functionName: 'getAssetData',
      args: [tokenAddress],
    });
    const liquidityMigrator = parseAirlockLiquidityMigrator(assetData);
    return liquidityMigrator === zeroAddress;
  }

  /**
   * Get the current epoch
   */
  async getCurrentEpoch(): Promise<number> {
    const [startingTime, epochLength] = await Promise.all([
      this.rpc.readContract({
        address: this.hookAddress,
        abi: dopplerHookAbi,
        functionName: 'startingTime',
      }),
      this.rpc.readContract({
        address: this.hookAddress,
        abi: dopplerHookAbi,
        functionName: 'epochLength',
      }),
    ]);

    const currentTime = BigInt(Math.floor(Date.now() / 1000));
    const elapsedTime =
      currentTime > startingTime ? currentTime - startingTime : BigInt(0);

    return Number(elapsedTime / epochLength);
  }

  /**
   * Get the current price in the auction
   * Returns the current tick based on the epoch and gamma parameters
   */
  async getCurrentPrice(): Promise<bigint> {
    const [_state, startingTick, endingTick, gamma, startingTime, epochLength] =
      await Promise.all([
        this.readHookState(),
        this.rpc.readContract({
          address: this.hookAddress,
          abi: dopplerHookAbi,
          functionName: 'startingTick',
        }),
        this.rpc.readContract({
          address: this.hookAddress,
          abi: dopplerHookAbi,
          functionName: 'endingTick',
        }),
        this.rpc.readContract({
          address: this.hookAddress,
          abi: dopplerHookAbi,
          functionName: 'gamma',
        }),
        this.rpc.readContract({
          address: this.hookAddress,
          abi: dopplerHookAbi,
          functionName: 'startingTime',
        }),
        this.rpc.readContract({
          address: this.hookAddress,
          abi: dopplerHookAbi,
          functionName: 'epochLength',
        }),
      ]);

    // Calculate current epoch
    const currentTime = BigInt(Math.floor(Date.now() / 1000));
    const elapsedTime =
      currentTime > startingTime ? currentTime - startingTime : BigInt(0);
    const currentEpoch =
      epochLength > 0n ? Number(elapsedTime / epochLength) : 0;

    // Calculate current tick based on the auction progression
    // The tick moves from startingTick towards endingTick based on epochs and gamma
    const direction = endingTick > startingTick ? 1 : -1;
    const tickMovement = Math.floor(currentEpoch * gamma * direction);
    const currentTick = Math.floor(startingTick + tickMovement);

    // Convert tick to price
    // price = 1.0001^tick
    // For simplicity, returning the tick as bigint for now
    // In production, you'd convert this to actual price using TickMath
    return BigInt(currentTick);
  }

  /**
   * Get total proceeds collected so far
   */
  async getTotalProceeds(): Promise<bigint> {
    const state = await this.readHookState();

    return state.totalProceeds;
  }

  /**
   * Check if the auction ended early due to max proceeds
   */
  async hasEndedEarly(): Promise<boolean> {
    return await this.rpc.readContract({
      address: this.hookAddress,
      abi: dopplerHookAbi,
      functionName: 'earlyExit',
    });
  }

  private async readHookState(): Promise<DynamicHookState> {
    const rawState = await this.rpc.readContract({
      address: this.hookAddress,
      abi: dopplerHookAbi,
      functionName: 'state',
    });
    return normalizeDynamicHookState(rawState);
  }
}
