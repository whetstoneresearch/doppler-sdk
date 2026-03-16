import {
  type Account,
  type Address,
  type Hash,
  type PublicClient,
  type WalletClient,
  zeroAddress,
  zeroHash,
} from 'viem';
import type { SupportedPublicClient, V4PoolKey } from '../../types';
import { normalizePoolKey } from '../../utils/poolKey';
import { resolveGasEstimate } from '../../utils/gasEstimate';
import { OpeningAuctionPositionManager } from './OpeningAuctionPositionManager';

const openingAuctionEntityAbi = [
  {
    type: 'function',
    name: 'positionManager',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'phase',
    inputs: [],
    outputs: [{ type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'auctionStartTime',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'auctionEndTime',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'incentivesClaimDeadline',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'clearingTick',
    inputs: [],
    outputs: [{ type: 'int24' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalTokensSold',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalProceeds',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalAuctionTokens',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'incentiveTokensTotal',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalIncentivesClaimed',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'cachedTotalWeightedTimeX128',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'positionHarvestedTimeX128',
    inputs: [{ name: 'positionId', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'positions',
    inputs: [{ name: 'positionId', type: 'uint256' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'owner', type: 'address' },
          { name: 'tickLower', type: 'int24' },
          { name: 'tickUpper', type: 'int24' },
          { name: 'liquidity', type: 'uint128' },
          { name: 'rewardDebtX128', type: 'uint256' },
          { name: 'hasClaimedIncentives', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isInRange',
    inputs: [{ name: 'positionId', type: 'uint256' }],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'calculateIncentives',
    inputs: [{ name: 'positionId', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPositionId',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'tickLower', type: 'int24' },
      { name: 'tickUpper', type: 'int24' },
      { name: 'salt', type: 'bytes32' },
    ],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'positionKeyToId',
    inputs: [{ name: 'positionKey', type: 'bytes32' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'settleAuction',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'claimIncentives',
    inputs: [{ name: 'positionId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'estimatedClearingTick',
    inputs: [],
    outputs: [{ type: 'int24' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'liquidityAtTick',
    inputs: [{ name: 'tick', type: 'int24' }],
    outputs: [{ type: 'uint128' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'nextPositionId',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'ownerPositions',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'index', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isToken0',
    inputs: [],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'poolKey',
    inputs: [],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'currency0', type: 'address' },
          { name: 'currency1', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'tickSpacing', type: 'int24' },
          { name: 'hooks', type: 'address' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'minLiquidity',
    inputs: [],
    outputs: [{ type: 'uint128' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'minAcceptableTickToken0',
    inputs: [],
    outputs: [{ type: 'int24' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'minAcceptableTickToken1',
    inputs: [],
    outputs: [{ type: 'int24' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'AuctionSettled',
    inputs: [
      { name: 'clearingTick', type: 'int24', indexed: false },
      { name: 'tokensSold', type: 'uint256', indexed: false },
      { name: 'proceeds', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'BidPlaced',
    inputs: [
      { name: 'positionId', type: 'uint256', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'tickLower', type: 'int24', indexed: false },
      { name: 'liquidity', type: 'uint128', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'BidWithdrawn',
    inputs: [
      { name: 'positionId', type: 'uint256', indexed: true },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'IncentivesClaimed',
    inputs: [
      { name: 'positionId', type: 'uint256', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'EstimatedClearingTickUpdated',
    inputs: [
      { name: 'newEstimatedClearingTick', type: 'int24', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'PhaseChanged',
    inputs: [
      { name: 'oldPhase', type: 'uint8', indexed: true },
      { name: 'newPhase', type: 'uint8', indexed: true },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'AuctionStarted',
    inputs: [
      { name: 'auctionStartTime', type: 'uint256', indexed: false },
      { name: 'auctionEndTime', type: 'uint256', indexed: false },
      { name: 'totalAuctionTokens', type: 'uint256', indexed: false },
      { name: 'incentiveTokensTotal', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'TickEnteredRange',
    inputs: [
      { name: 'tick', type: 'int24', indexed: true },
      { name: 'liquidity', type: 'uint128', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'TickExitedRange',
    inputs: [
      { name: 'tick', type: 'int24', indexed: true },
      { name: 'liquidity', type: 'uint128', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'LiquidityAddedToTick',
    inputs: [
      { name: 'tick', type: 'int24', indexed: true },
      { name: 'liquidityAdded', type: 'uint128', indexed: false },
      { name: 'totalLiquidity', type: 'uint128', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'LiquidityRemovedFromTick',
    inputs: [
      { name: 'tick', type: 'int24', indexed: true },
      { name: 'liquidityRemoved', type: 'uint128', indexed: false },
      { name: 'remainingLiquidity', type: 'uint128', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'TimeHarvested',
    inputs: [
      { name: 'positionId', type: 'uint256', indexed: true },
      { name: 'harvestedTimeX128', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'IncentivesRecovered',
    inputs: [
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
] as const;

export interface OpeningAuctionPosition {
  owner: Address;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  rewardDebtX128: bigint;
  hasClaimedIncentives: boolean;
}

export interface OpeningAuctionSettlementData {
  clearingTick: number;
  totalTokensSold: bigint;
  totalProceeds: bigint;
  totalAuctionTokens: bigint;
  incentiveTokensTotal: bigint;
}

export interface OpeningAuctionIncentiveData {
  incentiveTokensTotal: bigint;
  totalIncentivesClaimed: bigint;
  cachedTotalWeightedTimeX128: bigint;
  incentivesClaimDeadline: bigint;
}

export interface OpeningAuctionBidConstraints {
  minLiquidity: bigint;
  minAcceptableTickToken0: number;
  minAcceptableTickToken1: number;
}

export interface OpeningAuctionAuctionSettledEvent {
  clearingTick: number;
  tokensSold: bigint;
  proceeds: bigint;
  transactionHash: Hash;
  blockNumber: bigint;
  logIndex: number;
}

export interface OpeningAuctionWatchSettlementOptions {
  fromBlock?: bigint;
  poll?: boolean;
  pollingInterval?: number;
  strict?: boolean;
  onError?: (error: Error) => void;
  onSettled: (event: OpeningAuctionAuctionSettledEvent) => void;
}

import {
  OPENING_AUCTION_PHASE_NOT_STARTED,
  OPENING_AUCTION_PHASE_SETTLED,
} from '../../constants';

export class OpeningAuction {
  private publicClient: SupportedPublicClient;
  private walletClient?: WalletClient;
  private hookAddress: Address;

  private get rpc(): PublicClient {
    return this.publicClient as PublicClient;
  }

  constructor(
    publicClient: SupportedPublicClient,
    walletClient: WalletClient | undefined,
    hookAddress: Address,
  ) {
    this.publicClient = publicClient;
    this.walletClient = walletClient;
    this.hookAddress = hookAddress;
  }

  getAddress(): Address {
    return this.hookAddress;
  }

  async getPositionManager(): Promise<Address> {
    return await this.rpc.readContract({
      address: this.hookAddress,
      abi: openingAuctionEntityAbi,
      functionName: 'positionManager',
    });
  }

  async getPhase(): Promise<number> {
    const phase = await this.rpc.readContract({
      address: this.hookAddress,
      abi: openingAuctionEntityAbi,
      functionName: 'phase',
    });
    return Number(phase);
  }

  async getAuctionTimes(): Promise<{
    auctionStartTime: bigint;
    auctionEndTime: bigint;
    incentivesClaimDeadline: bigint;
  }> {
    const [auctionStartTime, auctionEndTime, incentivesClaimDeadline] =
      await Promise.all([
        this.rpc.readContract({
          address: this.hookAddress,
          abi: openingAuctionEntityAbi,
          functionName: 'auctionStartTime',
        }),
        this.rpc.readContract({
          address: this.hookAddress,
          abi: openingAuctionEntityAbi,
          functionName: 'auctionEndTime',
        }),
        this.rpc.readContract({
          address: this.hookAddress,
          abi: openingAuctionEntityAbi,
          functionName: 'incentivesClaimDeadline',
        }),
      ]);

    return {
      auctionStartTime,
      auctionEndTime,
      incentivesClaimDeadline,
    };
  }

  async getSettlementData(): Promise<OpeningAuctionSettlementData> {
    const [
      clearingTick,
      totalTokensSold,
      totalProceeds,
      totalAuctionTokens,
      incentiveTokensTotal,
    ] = await Promise.all([
      this.rpc.readContract({
        address: this.hookAddress,
        abi: openingAuctionEntityAbi,
        functionName: 'clearingTick',
      }),
      this.rpc.readContract({
        address: this.hookAddress,
        abi: openingAuctionEntityAbi,
        functionName: 'totalTokensSold',
      }),
      this.rpc.readContract({
        address: this.hookAddress,
        abi: openingAuctionEntityAbi,
        functionName: 'totalProceeds',
      }),
      this.rpc.readContract({
        address: this.hookAddress,
        abi: openingAuctionEntityAbi,
        functionName: 'totalAuctionTokens',
      }),
      this.rpc.readContract({
        address: this.hookAddress,
        abi: openingAuctionEntityAbi,
        functionName: 'incentiveTokensTotal',
      }),
    ]);

    return {
      clearingTick: Number(clearingTick),
      totalTokensSold,
      totalProceeds,
      totalAuctionTokens,
      incentiveTokensTotal,
    };
  }

  async getIncentiveData(): Promise<OpeningAuctionIncentiveData> {
    const [
      incentiveTokensTotal,
      totalIncentivesClaimed,
      cachedTotalWeightedTimeX128,
      incentivesClaimDeadline,
    ] = await Promise.all([
      this.rpc.readContract({
        address: this.hookAddress,
        abi: openingAuctionEntityAbi,
        functionName: 'incentiveTokensTotal',
      }),
      this.rpc.readContract({
        address: this.hookAddress,
        abi: openingAuctionEntityAbi,
        functionName: 'totalIncentivesClaimed',
      }),
      this.rpc.readContract({
        address: this.hookAddress,
        abi: openingAuctionEntityAbi,
        functionName: 'cachedTotalWeightedTimeX128',
      }),
      this.rpc.readContract({
        address: this.hookAddress,
        abi: openingAuctionEntityAbi,
        functionName: 'incentivesClaimDeadline',
      }),
    ]);

    return {
      incentiveTokensTotal,
      totalIncentivesClaimed,
      cachedTotalWeightedTimeX128,
      incentivesClaimDeadline,
    };
  }

  async getPositionHarvestedTime(positionId: bigint): Promise<bigint> {
    return await this.rpc.readContract({
      address: this.hookAddress,
      abi: openingAuctionEntityAbi,
      functionName: 'positionHarvestedTimeX128',
      args: [positionId],
    });
  }

  async getPosition(positionId: bigint): Promise<OpeningAuctionPosition> {
    const position = await this.rpc.readContract({
      address: this.hookAddress,
      abi: openingAuctionEntityAbi,
      functionName: 'positions',
      args: [positionId],
    });

    if (Array.isArray(position)) {
      const [
        owner,
        tickLower,
        tickUpper,
        liquidity,
        rewardDebtX128,
        hasClaimedIncentives,
      ] = position as unknown as readonly [
        Address,
        number | bigint,
        number | bigint,
        bigint,
        bigint,
        boolean,
      ];

      return {
        owner,
        tickLower: Number(tickLower),
        tickUpper: Number(tickUpper),
        liquidity,
        rewardDebtX128,
        hasClaimedIncentives,
      };
    }

    const tuple = position as {
      owner: Address;
      tickLower: number;
      tickUpper: number;
      liquidity: bigint;
      rewardDebtX128: bigint;
      hasClaimedIncentives: boolean;
    };

    return {
      owner: tuple.owner,
      tickLower: Number(tuple.tickLower),
      tickUpper: Number(tuple.tickUpper),
      liquidity: tuple.liquidity,
      rewardDebtX128: tuple.rewardDebtX128,
      hasClaimedIncentives: tuple.hasClaimedIncentives,
    };
  }

  async getEstimatedClearingTick(): Promise<number> {
    const tick = await this.rpc.readContract({
      address: this.hookAddress,
      abi: openingAuctionEntityAbi,
      functionName: 'estimatedClearingTick',
    });
    return Number(tick);
  }

  async getLiquidityAtTick(tick: number): Promise<bigint> {
    if (!Number.isInteger(tick)) {
      throw new Error('tick must be an integer');
    }
    if (tick < -8_388_608 || tick > 8_388_607) {
      throw new Error('tick out of int24 bounds (-8388608..8388607)');
    }
    return await this.rpc.readContract({
      address: this.hookAddress,
      abi: openingAuctionEntityAbi,
      functionName: 'liquidityAtTick',
      args: [tick],
    });
  }

  async getNextPositionId(): Promise<bigint> {
    const result = await this.rpc.readContract({
      address: this.hookAddress,
      abi: openingAuctionEntityAbi,
      functionName: 'nextPositionId',
    });
    if (result === 0n) {
      throw new Error('nextPositionId returned 0, which indicates malformed contract state');
    }
    return result;
  }

  async getOwnerPositionIdAt(owner: Address, index: bigint): Promise<bigint> {
    return await this.rpc.readContract({
      address: this.hookAddress,
      abi: openingAuctionEntityAbi,
      functionName: 'ownerPositions',
      args: [owner, index],
    });
  }

  async getIsToken0(): Promise<boolean> {
    return await this.rpc.readContract({
      address: this.hookAddress,
      abi: openingAuctionEntityAbi,
      functionName: 'isToken0',
    });
  }

  async getPoolKey(): Promise<V4PoolKey> {
    const result = await this.rpc.readContract({
      address: this.hookAddress,
      abi: openingAuctionEntityAbi,
      functionName: 'poolKey',
    });

    return normalizePoolKey(result);
  }

  async getMinLiquidity(): Promise<bigint> {
    return await this.rpc.readContract({
      address: this.hookAddress,
      abi: openingAuctionEntityAbi,
      functionName: 'minLiquidity',
    });
  }

  async getMinAcceptableTickToken0(): Promise<number> {
    const tick = await this.rpc.readContract({
      address: this.hookAddress,
      abi: openingAuctionEntityAbi,
      functionName: 'minAcceptableTickToken0',
    });
    return Number(tick);
  }

  async getMinAcceptableTickToken1(): Promise<number> {
    const tick = await this.rpc.readContract({
      address: this.hookAddress,
      abi: openingAuctionEntityAbi,
      functionName: 'minAcceptableTickToken1',
    });
    return Number(tick);
  }

  async getBidConstraints(): Promise<OpeningAuctionBidConstraints> {
    const [minLiquidity, minAcceptableTickToken0, minAcceptableTickToken1] =
      await Promise.all([
        this.getMinLiquidity(),
        this.getMinAcceptableTickToken0(),
        this.getMinAcceptableTickToken1(),
      ]);

    return {
      minLiquidity,
      minAcceptableTickToken0,
      minAcceptableTickToken1,
    };
  }

  /**
   * Return position IDs owned by the given address with non-zero liquidity.
   *
   * Strategy:
   * 1) Enumerate owner-indexed positions via `ownerPositions(owner, index)`.
   * 2) Stop when the first out-of-bounds index is reached.
   */
  async getOwnerPositions(owner: Address): Promise<bigint[]> {
    const ownerLower = owner.toLowerCase();
    const indexedIds = await this.getOwnerPositionIdsIndexed(owner);
    if (indexedIds.length === 0) {
      return [];
    }

    const positions = await Promise.all(
      indexedIds.map((positionId) => this.getPosition(positionId)),
    );

    return indexedIds.filter((positionId, i) => {
      const pos = positions[i];
      return pos.owner.toLowerCase() === ownerLower && pos.liquidity > 0n;
    });
  }

  private async getOwnerPositionIdsIndexed(owner: Address): Promise<bigint[]> {
    const MAX_INDEXED_SCAN = 10_000;
    const BATCH = 50;
    const ids: bigint[] = [];

    for (let index = 0; index < MAX_INDEXED_SCAN; index += BATCH) {
      const contracts = Array.from({ length: BATCH }, (_, i) => ({
        address: this.hookAddress,
        abi: openingAuctionEntityAbi,
        functionName: 'ownerPositions' as const,
        args: [owner, BigInt(index + i)] as const,
      }));

      const results = await this.rpc.multicall({
        contracts,
        allowFailure: true,
      });

      let firstFailureOffset: number | null = null;
      for (let i = 0; i < results.length; i++) {
        const res = results[i];
        if (res.status === 'success') {
          if (firstFailureOffset !== null) {
            throw new Error('ownerPositions indexed enumeration inconsistent');
          }
          const id = res.result as bigint;
          if (id > 0n) ids.push(id);
        } else if (firstFailureOffset === null) {
          firstFailureOffset = i;
        }
      }

      // Entire batch succeeded — keep scanning.
      if (firstFailureOffset === null) {
        continue;
      }

      // Hit end of list (or owner has no positions).
      return ids;
    }

    return ids;
  }

  /**
   * Return whether a position is in range.
   *
   * Prefers contract-native `isInRange` when available, and falls back to
   * client-side reconstruction for compatibility.
   */
  async isInRange(positionId: bigint): Promise<boolean> {
    try {
      const nativeResult = await this.rpc.readContract({
        address: this.hookAddress,
        abi: openingAuctionEntityAbi,
        functionName: 'isInRange',
        args: [positionId],
      });

      if (typeof nativeResult === 'boolean') {
        return nativeResult;
      }
    } catch {
      // fallback below
    }

    // Fallback: client-side reconstruction.
    const [position, phase, isToken0] = await Promise.all([
      this.getPosition(positionId),
      this.getPhase(),
      this.getIsToken0(),
    ]);

    if (position.owner === zeroAddress) {
      return false;
    }

    if (phase === OPENING_AUCTION_PHASE_NOT_STARTED) {
      return false;
    }

    let refTick: number;
    if (phase === OPENING_AUCTION_PHASE_SETTLED) {
      const settlement = await this.getSettlementData();
      refTick = settlement.clearingTick;
    } else {
      refTick = await this.getEstimatedClearingTick();
    }

    if (isToken0) {
      return refTick < position.tickUpper;
    } else {
      return refTick >= position.tickLower;
    }
  }

  async calculateIncentives(positionId: bigint): Promise<bigint> {
    return await this.rpc.readContract({
      address: this.hookAddress,
      abi: openingAuctionEntityAbi,
      functionName: 'calculateIncentives',
      args: [positionId],
    });
  }

  /**
   * Compute position ID client-side using computePositionKey + positionKeyToId read.
   */
  async getPositionId(args: {
    owner: Address;
    tickLower: number;
    tickUpper: number;
    salt: Hash;
  }): Promise<bigint> {
    const positionKey = OpeningAuctionPositionManager.computePositionKey(args);
    return await this.getPositionIdFromKey(positionKey);
  }

  async getPositionIdFromKey(positionKey: Hash): Promise<bigint> {
    return await this.rpc.readContract({
      address: this.hookAddress,
      abi: openingAuctionEntityAbi,
      functionName: 'positionKeyToId',
      args: [positionKey],
    });
  }

  async estimateSettleAuctionGas(account?: Address | Account): Promise<bigint> {
    const simulation = await this.simulateSettleAuction(account);
    return simulation.gasEstimate;
  }

  async simulateSettleAuction(account?: Address | Account): Promise<{
    request: unknown;
    gasEstimate: bigint;
  }> {
    const resolvedAccount = account ?? this.walletClient?.account;
    const { request } = await this.rpc.simulateContract({
      address: this.hookAddress,
      abi: openingAuctionEntityAbi,
      functionName: 'settleAuction',
      account: resolvedAccount,
    } as any);

    const gasEstimate = await resolveGasEstimate(request, () =>
      this.rpc.estimateContractGas({
        address: this.hookAddress,
        abi: openingAuctionEntityAbi,
        functionName: 'settleAuction',
        account: resolvedAccount,
      } as any),
    );

    return { request, gasEstimate };
  }

  async settleAuction(options?: { gas?: bigint }): Promise<Hash> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }

    const { request } = await this.simulateSettleAuction(this.walletClient.account);
    return await this.walletClient.writeContract(
      options?.gas ? { ...(request as any), gas: options.gas } : (request as any),
    );
  }

  async estimateClaimIncentivesGas(
    positionId: bigint,
    account?: Address | Account,
  ): Promise<bigint> {
    const simulation = await this.simulateClaimIncentives(positionId, account);
    return simulation.gasEstimate;
  }

  async simulateClaimIncentives(
    positionId: bigint,
    account?: Address | Account,
  ): Promise<{
    request: unknown;
    gasEstimate: bigint;
  }> {
    const resolvedAccount = account ?? this.walletClient?.account;
    const { request } = await this.rpc.simulateContract({
      address: this.hookAddress,
      abi: openingAuctionEntityAbi,
      functionName: 'claimIncentives',
      args: [positionId],
      account: resolvedAccount,
    } as any);

    const gasEstimate = await resolveGasEstimate(request, () =>
      this.rpc.estimateContractGas({
        address: this.hookAddress,
        abi: openingAuctionEntityAbi,
        functionName: 'claimIncentives',
        args: [positionId],
        account: resolvedAccount,
      } as any),
    );

    return { request, gasEstimate };
  }

  async claimIncentives(
    positionId: bigint,
    options?: { gas?: bigint },
  ): Promise<Hash> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }

    const { request } = await this.simulateClaimIncentives(
      positionId,
      this.walletClient.account,
    );
    return await this.walletClient.writeContract(
      options?.gas ? { ...(request as any), gas: options.gas } : (request as any),
    );
  }

  async claimIncentivesByPositionKey(args: {
    owner: Address;
    tickLower: number;
    tickUpper: number;
    salt: Hash;
  }): Promise<Hash> {
    const positionId = await this.getPositionId(args);
    if (positionId === 0n) {
      throw new Error('Position not found for the given (owner,ticks,salt)');
    }

    return await this.claimIncentives(positionId);
  }

  watchAuctionSettled(options: OpeningAuctionWatchSettlementOptions): () => void {
    return this.rpc.watchContractEvent({
      address: this.hookAddress,
      abi: openingAuctionEntityAbi,
      eventName: 'AuctionSettled',
      fromBlock: options.fromBlock,
      poll: options.poll,
      pollingInterval: options.pollingInterval,
      strict: options.strict ?? false,
      onError: options.onError,
      onLogs: (logs: any[]) => {
        for (const log of logs) {
          const args = (log?.args ?? {}) as {
            clearingTick?: number | bigint;
            tokensSold?: bigint;
            proceeds?: bigint;
          };

          options.onSettled({
            clearingTick: Number(args.clearingTick ?? 0),
            tokensSold: args.tokensSold ?? 0n,
            proceeds: args.proceeds ?? 0n,
            transactionHash: (log.transactionHash ?? zeroHash) as Hash,
            blockNumber: (log.blockNumber ?? 0n) as bigint,
            logIndex: Number(log.logIndex ?? 0),
          });
        }
      },
    } as any);
  }
}
