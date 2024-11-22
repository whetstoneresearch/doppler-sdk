import { Address, Client, Hash, Hex, PublicClient } from 'viem';
import { Token } from '@uniswap/sdk-core';
import { PoolKey } from '@uniswap/v4-sdk';
import { fetchDopplerState } from '../../fetch/doppler/DopplerState';
import { fetchPoolState } from '../../fetch/doppler/PoolState';

/**
 * Enum representing the different phases of an auction.
 */
enum AuctionPhase {
  ACTIVE = 'ACTIVE',
  PRE_AUCTION = 'PRE_AUCTION',
  POST_AUCTION = 'POST_AUCTION',
}

/**
 * Enum representing the different statuses of an auction.
 */
enum AuctionStatus {
  MAXIMUM_REACHED = 'MAXIMUM_REACHED',
  MINIMUM_REACHED = 'MINIMUM_REACHED',
  ACTIVE = 'ACTIVE',
}

/**
 * Configuration for the Doppler hook.
 */
export interface HookConfig {
  startingTime: bigint;
  endingTime: bigint;
  epochLength: bigint;
  isToken0: boolean;
  numTokensToSell: bigint;
  minimumProceeds: bigint;
  maximumProceeds: bigint;
  startingTick: number;
  endingTick: number;
  gamma: number;
  totalEpochs: number;
  numPDSlugs: number;
}

/**
 * State of the Doppler hook.
 */
export interface HookState {
  lastEpoch: number;
  tickAccumulator: bigint;
  totalTokensSold: bigint;
  totalProceeds: bigint;
  totalTokensSoldLastEpoch: bigint;
  feesAccrued: {
    amount0: bigint;
    amount1: bigint;
  };
}

/**
 * Represents a position in the pool.
 */
export interface Position {
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  salt: Hash;
  type: 'lowerSlug' | 'upperSlug' | 'pdSlug';
}

/**
 * State of the pool.
 */
export interface PoolState {
  positions: Position[];
  currentTick: number;
  currentPrice: bigint;
  lastSyncedTimestamp: bigint;
}

/**
 * Represents a Doppler instance with its configuration, state, and methods.
 */
export class Doppler {
  public readonly address: Address;
  public readonly stateView: Address;
  public readonly assetToken: Token;
  public readonly quoteToken: Token;
  public readonly poolKey: PoolKey;
  public readonly poolId: Hex;
  public readonly config: HookConfig;

  public state: HookState;
  public poolState: PoolState;
  public lastSyncedTimestamp: bigint;
  public auctionPhase: AuctionPhase;
  public auctionStatus: AuctionStatus;
  public assetsRemaining: bigint;
  public proceedsFromMaximum: bigint;
  public proceedsFromMinimum: bigint;
  public epochsRemaining: number;

  constructor(params: {
    address: Address;
    stateView: Address;
    assetToken: Token;
    quoteToken: Token;
    poolKey: PoolKey;
    poolId: Hex;
    config: HookConfig;
    state: HookState;
    poolState: PoolState;
    timestamp: bigint;
  }) {
    this.address = params.address;
    this.stateView = params.stateView;
    this.assetToken = params.assetToken;
    this.quoteToken = params.quoteToken;
    this.poolKey = params.poolKey;
    this.poolId = params.poolId;
    this.config = params.config;
    this.state = params.state;
    this.poolState = params.poolState;
    this.lastSyncedTimestamp = params.timestamp;

    this.auctionPhase = this.getAuctionPhase();
    this.auctionStatus = this.getAuctionStatus();
    this.assetsRemaining = this.getAssetsRemaining();
    this.proceedsFromMaximum = this.getProceedsDistanceFromMaximum();
    this.proceedsFromMinimum = this.getProceedsDistanceFromMinimum();
    this.epochsRemaining = this.getEpochsRemaining();
  }

  /**
   * Watches for state changes and updates the Doppler instance accordingly.
   * @param client The public client for interacting with the blockchain.
   * @returns A function to unwatch the state changes.
   */
  public watch(client: PublicClient): () => void {
    const unwatch = client.watchBlocks({
      onBlock: async block => {
        await this.getHookState(client);
        await this.getPoolState(client);
        this.lastSyncedTimestamp = block.timestamp;
      },
    });
    return unwatch;
  }

  /**
   * Fetches and updates the pool state.
   * @param client The client for interacting with the blockchain.
   */
  public async getPoolState(client: Client): Promise<void> {
    this.poolState = await fetchPoolState(
      this.address,
      this.stateView,
      client,
      this.poolId
    );
  }

  /**
   * Fetches and updates the hook state.
   * @param client The client for interacting with the blockchain.
   */
  public async getHookState(client: Client): Promise<void> {
    this.state = await fetchDopplerState(this.address, client);
  }

  /**
   * Calculates the remaining assets to be sold.
   * @returns The remaining assets.
   */
  public getAssetsRemaining(): bigint {
    return this.config.numTokensToSell - this.state.totalTokensSold;
  }

  /**
   * Calculates the remaining time for the auction.
   * @returns The remaining time in seconds.
   */
  public getTimeRemaining(): number {
    return Number(this.config.endingTime - this.lastSyncedTimestamp);
  }

  /**
   * Calculates the elapsed time since the auction started.
   * @returns The elapsed time in seconds.
   */
  public getTimeElapsed(): number {
    return Number(this.lastSyncedTimestamp - this.config.startingTime);
  }

  /**
   * Calculates the distance from the maximum proceeds.
   * @returns The distance from the maximum proceeds.
   */
  public getProceedsDistanceFromMaximum(): bigint {
    return this.config.maximumProceeds - this.state.totalProceeds;
  }

  /**
   * Calculates the distance from the minimum proceeds.
   * @returns The distance from the minimum proceeds.
   */
  public getProceedsDistanceFromMinimum(): bigint {
    return this.config.minimumProceeds - this.state.totalProceeds;
  }

  /**
   * Calculates the remaining epochs for the auction.
   * @returns The remaining epochs.
   */
  public getEpochsRemaining(): number {
    return this.config.totalEpochs - this.state.lastEpoch;
  }

  /**
   * Determines the current phase of the auction.
   * @returns The current auction phase.
   */
  public getAuctionPhase(): AuctionPhase {
    if (this.lastSyncedTimestamp < this.config.startingTime) {
      return AuctionPhase.PRE_AUCTION;
    } else if (this.lastSyncedTimestamp < this.config.endingTime) {
      return AuctionPhase.ACTIVE;
    } else {
      return AuctionPhase.POST_AUCTION;
    }
  }

  /**
   * Determines the current status of the auction.
   * @returns The current auction status.
   */
  public getAuctionStatus(): AuctionStatus {
    if (this.state.totalProceeds >= this.config.maximumProceeds) {
      return AuctionStatus.MAXIMUM_REACHED;
    } else if (this.state.totalProceeds <= this.config.minimumProceeds) {
      return AuctionStatus.MINIMUM_REACHED;
    } else {
      return AuctionStatus.ACTIVE;
    }
  }
}
