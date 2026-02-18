import {
  type Address,
  type Hash,
  type PublicClient,
  type WalletClient,
} from 'viem';
import type { SupportedPublicClient } from '../../types';

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
        number,
        number,
        bigint,
        bigint,
        boolean,
      ];

      return {
        owner,
        tickLower,
        tickUpper,
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

  async isInRange(positionId: bigint): Promise<boolean> {
    return await this.rpc.readContract({
      address: this.hookAddress,
      abi: openingAuctionEntityAbi,
      functionName: 'isInRange',
      args: [positionId],
    });
  }

  async calculateIncentives(positionId: bigint): Promise<bigint> {
    return await this.rpc.readContract({
      address: this.hookAddress,
      abi: openingAuctionEntityAbi,
      functionName: 'calculateIncentives',
      args: [positionId],
    });
  }

  async getPositionId(args: {
    owner: Address;
    tickLower: number;
    tickUpper: number;
    salt: Hash;
  }): Promise<bigint> {
    return await this.rpc.readContract({
      address: this.hookAddress,
      abi: openingAuctionEntityAbi,
      functionName: 'getPositionId',
      args: [args.owner, args.tickLower, args.tickUpper, args.salt],
    });
  }

  async getPositionIdFromKey(positionKey: Hash): Promise<bigint> {
    return await this.rpc.readContract({
      address: this.hookAddress,
      abi: openingAuctionEntityAbi,
      functionName: 'positionKeyToId',
      args: [positionKey],
    });
  }

  async settleAuction(): Promise<Hash> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }

    const { request } = await this.rpc.simulateContract({
      address: this.hookAddress,
      abi: openingAuctionEntityAbi,
      functionName: 'settleAuction',
      account: this.walletClient.account,
    });

    return await this.walletClient.writeContract(request);
  }

  async claimIncentives(positionId: bigint): Promise<Hash> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }

    const { request } = await this.rpc.simulateContract({
      address: this.hookAddress,
      abi: openingAuctionEntityAbi,
      functionName: 'claimIncentives',
      args: [positionId],
      account: this.walletClient.account,
    });

    return await this.walletClient.writeContract(request);
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
}
