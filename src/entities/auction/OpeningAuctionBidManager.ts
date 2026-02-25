import {
  type Account,
  type Address,
  type Hash,
  type Hex,
  type PublicClient,
  type WalletClient,
  zeroAddress,
  zeroHash,
} from 'viem';
import type { SupportedPublicClient, V4PoolKey } from '../../types';
import {
  OPENING_AUCTION_PHASE_NOT_STARTED,
  OPENING_AUCTION_PHASE_ACTIVE,
  OPENING_AUCTION_PHASE_SETTLED,
} from '../../constants';
import { getSqrtRatioAtTick } from '../../utils/tickMath';
import {
  getLiquidityForAmount0,
  getLiquidityForAmount1,
} from '../../utils/liquidityMath';
import {
  OpeningAuction,
  type OpeningAuctionAuctionSettledEvent,
  type OpeningAuctionPosition,
  type OpeningAuctionWatchSettlementOptions,
} from './OpeningAuction';
import {
  OpeningAuctionPositionManager,
  type OpeningAuctionModifyLiquiditySimulationResult,
  type OpeningAuctionWithdrawFullBidResult,
  type OpeningAuctionWithdrawFullBidSimulationResult,
} from './OpeningAuctionPositionManager';

export interface OpeningAuctionBidManagerConfig {
  openingAuctionHookAddress: Address;
  openingAuctionPoolKey: V4PoolKey;
  positionManagerAddress: Address;
}

export interface OpeningAuctionBidArgs {
  tickLower: number;
  liquidity: bigint;
  salt?: Hash;
  owner?: Address;
  hookData?: Hex;
  account?: Address | Account;
}

export interface OpeningAuctionWithdrawFullBidArgs {
  tickLower: number;
  salt?: Hash;
  owner?: Address;
  hookData?: Hex;
  account?: Address | Account;
}

export interface OpeningAuctionBidLookupArgs {
  tickLower: number;
  salt?: Hash;
  owner?: Address;
  account?: Address | Account;
}

export interface OpeningAuctionBidSimulationResult
  extends OpeningAuctionModifyLiquiditySimulationResult {
  tickLower: number;
  tickUpper: number;
  salt: Hash;
}

export interface OpeningAuctionClaimIncentivesSimulationResult {
  positionId: bigint;
  request: unknown;
  gasEstimate: bigint;
}

export interface OpeningAuctionBidPositionInfo {
  owner: Address;
  tickLower: number;
  tickUpper: number;
  salt: Hash;
  positionKey: Hash;
  positionId: bigint;
  position: OpeningAuctionPosition;
  isInRange: boolean;
  claimableIncentives: bigint;
}

export interface OpeningAuctionBidStatus {
  exists: boolean;
  owner: Address;
  tickLower: number;
  tickUpper: number;
  salt: Hash;
  positionKey: Hash;
  positionId: bigint;
  liquidity: bigint;
  isInRange: boolean;
  claimableIncentives: bigint;
  hasClaimedIncentives: boolean;
  phase: number;
  estimatedClearingTick: number;
  wouldBeFilledAtEstimatedClearing: boolean;
  isAboveEstimatedClearing: boolean;
}

export interface OpeningAuctionWatchBidStatusOptions
  extends OpeningAuctionBidLookupArgs {
  emitOnBegin?: boolean;
  poll?: boolean;
  pollingInterval?: number;
  onError?: (error: Error) => void;
  onStatusChange: (
    status: OpeningAuctionBidStatus,
    previousStatus: OpeningAuctionBidStatus | null,
  ) => void;
}

// Owner-position types (without salt/positionKey since those are not stored on-chain)
export interface OpeningAuctionOwnerBidInfo {
  positionId: bigint;
  owner: Address;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  rewardDebtX128: bigint;
  hasClaimedIncentives: boolean;
  isInRange: boolean;
  claimableIncentives: bigint;
}

export interface OpeningAuctionOwnerBidStatus extends OpeningAuctionOwnerBidInfo {
  phase: number;
  estimatedClearingTick: number;
  wouldBeFilledAtEstimatedClearing: boolean;
  isAboveEstimatedClearing: boolean;
}

// Event watcher types
export interface OpeningAuctionBidPlacedEvent {
  positionId: bigint;
  owner: Address;
  tickLower: number;
  liquidity: bigint;
  transactionHash: Hash;
  blockNumber: bigint;
  logIndex: number;
}

export interface OpeningAuctionBidWithdrawnEvent {
  positionId: bigint;
  transactionHash: Hash;
  blockNumber: bigint;
  logIndex: number;
}

export interface OpeningAuctionIncentivesClaimedEvent {
  positionId: bigint;
  owner: Address;
  amount: bigint;
  transactionHash: Hash;
  blockNumber: bigint;
  logIndex: number;
}

export interface OpeningAuctionPhaseChangedEvent {
  oldPhase: number;
  newPhase: number;
  transactionHash: Hash;
  blockNumber: bigint;
  logIndex: number;
}

export interface OpeningAuctionEstimatedClearingTickUpdatedEvent {
  newEstimatedClearingTick: number;
  transactionHash: Hash;
  blockNumber: bigint;
  logIndex: number;
}

export interface OpeningAuctionWatchBidPlacedOptions {
  owner?: Address;
  fromBlock?: bigint;
  poll?: boolean;
  pollingInterval?: number;
  strict?: boolean;
  onError?: (error: Error) => void;
  onBidPlaced: (event: OpeningAuctionBidPlacedEvent) => void;
}

export interface OpeningAuctionWatchBidWithdrawnOptions {
  positionId?: bigint;
  fromBlock?: bigint;
  poll?: boolean;
  pollingInterval?: number;
  strict?: boolean;
  onError?: (error: Error) => void;
  onBidWithdrawn: (event: OpeningAuctionBidWithdrawnEvent) => void;
}

export interface OpeningAuctionWatchIncentivesClaimedOptions {
  owner?: Address;
  positionId?: bigint;
  fromBlock?: bigint;
  poll?: boolean;
  pollingInterval?: number;
  strict?: boolean;
  onError?: (error: Error) => void;
  onIncentivesClaimed: (event: OpeningAuctionIncentivesClaimedEvent) => void;
}

export interface OpeningAuctionWatchPhaseChangeOptions {
  fromBlock?: bigint;
  poll?: boolean;
  pollingInterval?: number;
  strict?: boolean;
  onError?: (error: Error) => void;
  onPhaseChanged: (event: OpeningAuctionPhaseChangedEvent) => void;
}

export interface OpeningAuctionWatchEstimatedClearingTickOptions {
  fromBlock?: bigint;
  poll?: boolean;
  pollingInterval?: number;
  strict?: boolean;
  onError?: (error: Error) => void;
  onEstimatedClearingTickUpdated: (event: OpeningAuctionEstimatedClearingTickUpdatedEvent) => void;
}

// --- Phase 2b types ---

export interface OpeningAuctionMoveBidArgs {
  fromTickLower: number;
  toTickLower: number;
  salt?: Hash;
  owner?: Address;
  account?: Address | Account;
}

export interface OpeningAuctionMoveBidSimulationResult {
  withdrawSimulation: OpeningAuctionBidSimulationResult;
  placeSimulation: OpeningAuctionBidSimulationResult;
  liquidity: bigint;
}

export interface OpeningAuctionMoveBidResult {
  withdrawTxHash: Hash;
  placeTxHash: Hash;
  liquidity: bigint;
}

export interface OpeningAuctionBidQuote {
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  amount0Delta: bigint;
  amount1Delta: bigint;
  tokenInAmount0: bigint;
  tokenInAmount1: bigint;
  estimatedClearingTick: number;
  wouldBeFilledAtEstimatedClearing: boolean;
  isAboveEstimatedClearing: boolean;
  estimatedIncentiveShareBps: number | null;
}

export interface OpeningAuctionClaimAllIncentivesPreview {
  claimablePositions: Array<{
    positionId: bigint;
    claimableIncentives: bigint;
  }>;
  totalClaimable: bigint;
  skippedPositions: Array<{
    positionId: bigint;
    reason: string;
  }>;
}

export interface OpeningAuctionClaimAllIncentivesResult {
  results: Array<{
    positionId: bigint;
    transactionHash?: Hash;
    error?: string;
  }>;
  totalClaimed: number;
  totalFailed: number;
}

export interface OpeningAuctionBidValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  resolved: {
    owner: Address;
    tickLower: number;
    tickUpper: number;
    salt: Hash;
  };
  constraints: {
    minLiquidity: bigint;
    minAcceptableTickToken0: number;
    minAcceptableTickToken1: number;
    phase: number;
    estimatedClearingTick: number;
    isToken0: boolean;
  };
}

export interface OpeningAuctionQuoteFromTokenAmountArgs {
  tickLower: number;
  tokenAmount: bigint;
  tokenIndex: 0 | 1;
  salt?: Hash;
  owner?: Address;
  account?: Address | Account;
}

export interface OpeningAuctionQuoteFromTokenAmountResult
  extends OpeningAuctionBidQuote {
  tokenAmount: bigint;
  tokenIndex: 0 | 1;
}

// ABI subset for event watchers (avoids importing full ABI)
const bidManagerEventAbi = [
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
    name: 'PhaseChanged',
    inputs: [
      { name: 'oldPhase', type: 'uint8', indexed: true },
      { name: 'newPhase', type: 'uint8', indexed: true },
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
] as const;

export class OpeningAuctionBidManager {
  private publicClient: SupportedPublicClient;
  private walletClient?: WalletClient;
  private openingAuction: OpeningAuction;
  private positionManager: OpeningAuctionPositionManager;
  private openingAuctionPoolKey: V4PoolKey;
  private openingAuctionHookAddress: Address;

  // Memoized snapshot for reducing redundant reads within a single call context.
  // Uses block number instead of wall-clock time for reliable cache invalidation.
  private _snapshotCache: {
    phase: number;
    isToken0: boolean;
    estimatedClearingTick: number;
    blockNumber: bigint;
  } | null = null;

  private get rpc(): PublicClient {
    return this.publicClient as PublicClient;
  }

  constructor(
    publicClient: SupportedPublicClient,
    walletClient: WalletClient | undefined,
    config: OpeningAuctionBidManagerConfig,
  ) {
    this.publicClient = publicClient;
    this.walletClient = walletClient;
    this.openingAuction = new OpeningAuction(
      publicClient,
      walletClient,
      config.openingAuctionHookAddress,
    );
    this.positionManager = new OpeningAuctionPositionManager(
      publicClient,
      walletClient,
      config.positionManagerAddress,
    );
    this.openingAuctionPoolKey = config.openingAuctionPoolKey;
    this.openingAuctionHookAddress = config.openingAuctionHookAddress;
  }

  /**
   * Construct an OpeningAuctionBidManager from just the hook address.
   * Reads `poolKey` and `positionManager` from the hook contract.
   */
  static async fromHookAddress(
    publicClient: SupportedPublicClient,
    walletClient: WalletClient | undefined,
    openingAuctionHookAddress: Address,
  ): Promise<OpeningAuctionBidManager> {
    const openingAuction = new OpeningAuction(
      publicClient,
      walletClient,
      openingAuctionHookAddress,
    );

    const [poolKey, positionManagerAddress] = await Promise.all([
      openingAuction.getPoolKey(),
      openingAuction.getPositionManager(),
    ]);

    return new OpeningAuctionBidManager(publicClient, walletClient, {
      openingAuctionHookAddress,
      openingAuctionPoolKey: poolKey,
      positionManagerAddress,
    });
  }

  getOpeningAuctionHookAddress(): Address {
    return this.openingAuctionHookAddress;
  }

  getPositionManagerAddress(): Address {
    return this.positionManager.getAddress();
  }

  getPoolKey(): V4PoolKey {
    return this.openingAuctionPoolKey;
  }

  /**
   * Preflight validation for a bid. Checks tick alignment, liquidity minimums,
   * tick acceptability, and phase gating. Returns actionable errors/warnings.
   */
  async validateBid(
    args: OpeningAuctionBidArgs,
  ): Promise<OpeningAuctionBidValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const owner = this.resolveOwner(args.owner, args.account);
    const salt = args.salt ?? zeroHash;

    // Validate tick alignment (this throws on failure, so catch)
    let tickLower: number;
    let tickUpper: number;
    try {
      const resolved = OpeningAuctionPositionManager.validateSingleTick({
        key: this.openingAuctionPoolKey,
        tickLower: args.tickLower,
      });
      tickLower = resolved.tickLower;
      tickUpper = resolved.tickUpper;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`Tick validation failed: ${msg}`);
      tickLower = args.tickLower;
      tickUpper = args.tickLower + this.openingAuctionPoolKey.tickSpacing;
    }

    // Read constraints and auction state in parallel
    const [constraints, phase, isToken0, estimatedClearingTick, blockNumber] =
      await Promise.all([
        this.openingAuction.getBidConstraints(),
        this.openingAuction.getPhase(),
        this.openingAuction.getIsToken0(),
        this.openingAuction.getEstimatedClearingTick(),
        this.rpc.getBlockNumber(),
      ]);

    const tickValidationPassed = errors.length === 0;

    // Liquidity checks
    if (args.liquidity <= 0n) {
      errors.push('Liquidity must be greater than 0');
    }
    if (args.liquidity < constraints.minLiquidity) {
      errors.push(
        `Liquidity ${args.liquidity} is below minimum ${constraints.minLiquidity}`,
      );
    }

    // Tick acceptability checks based on token side
    if (isToken0) {
      if (tickLower < constraints.minAcceptableTickToken0) {
        errors.push(
          `tickLower ${tickLower} is below minAcceptableTickToken0 ${constraints.minAcceptableTickToken0}`,
        );
      }
    } else {
      if (tickLower > constraints.minAcceptableTickToken1) {
        errors.push(
          `tickLower ${tickLower} is above minAcceptableTickToken1 ${constraints.minAcceptableTickToken1}`,
        );
      }
    }

    // Phase gating
    if (phase === OPENING_AUCTION_PHASE_NOT_STARTED) {
      errors.push('Auction has not started yet; bids cannot be placed');
    }
    if (phase === OPENING_AUCTION_PHASE_SETTLED) {
      errors.push('Auction is already settled; new bids cannot be placed');
    }

    // Update snapshot cache only when tick validation succeeded to avoid
    // storing snapshot data from malformed bid coordinates.
    if (tickValidationPassed) {
      this._snapshotCache = {
        phase,
        isToken0,
        estimatedClearingTick,
        blockNumber,
      };
    }

    // Warning: bid above estimated clearing tick (low fill likelihood)
    const isAboveEstimatedClearing = isToken0
      ? tickLower > estimatedClearingTick
      : tickLower < estimatedClearingTick;
    if (isAboveEstimatedClearing && phase !== 0) {
      warnings.push(
        `Bid at tick ${tickLower} is above the estimated clearing tick ${estimatedClearingTick} (low fill likelihood)`,
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      resolved: { owner, tickLower, tickUpper, salt },
      constraints: {
        minLiquidity: constraints.minLiquidity,
        minAcceptableTickToken0: constraints.minAcceptableTickToken0,
        minAcceptableTickToken1: constraints.minAcceptableTickToken1,
        phase,
        estimatedClearingTick,
        isToken0,
      },
    };
  }

  /**
   * Reverse-quote: given a token amount, derive liquidity and return an enriched quote.
   * The token amount must be specified on the auction token side
   * (`tokenIndex` must match `openingAuction.isToken0()`).
   */
  async quoteFromTokenAmount(
    args: OpeningAuctionQuoteFromTokenAmountArgs,
  ): Promise<OpeningAuctionQuoteFromTokenAmountResult> {
    if (args.tokenAmount <= 0n) {
      throw new Error('tokenAmount must be greater than 0');
    }

    // Enforce token-side compatibility with the auction
    const isToken0 = await this.openingAuction.getIsToken0();
    const expectedTokenIndex = isToken0 ? 0 : 1;
    if (args.tokenIndex !== expectedTokenIndex) {
      throw new Error(
        `Token index ${args.tokenIndex} does not match auction side (isToken0: ${isToken0})`,
      );
    }

    const { tickLower, tickUpper } = this.resolveBidCoordinates({
      tickLower: args.tickLower,
      salt: args.salt,
    });

    const sqrtRatioAX96 = getSqrtRatioAtTick(tickLower);
    const sqrtRatioBX96 = getSqrtRatioAtTick(tickUpper);

    // Derive liquidity from token amount based on which token
    let liquidity: bigint;
    if (args.tokenIndex === 0) {
      liquidity = getLiquidityForAmount0(
        sqrtRatioAX96,
        sqrtRatioBX96,
        args.tokenAmount,
      );
    } else {
      liquidity = getLiquidityForAmount1(
        sqrtRatioAX96,
        sqrtRatioBX96,
        args.tokenAmount,
      );
    }

    if (liquidity <= 0n) {
      throw new Error(
        'Derived liquidity is 0 for the given token amount and tick range',
      );
    }

    const quote = await this.quoteBid({
      tickLower: args.tickLower,
      liquidity,
      salt: args.salt,
      owner: args.owner,
      account: args.account,
    });

    return {
      ...quote,
      tokenAmount: args.tokenAmount,
      tokenIndex: args.tokenIndex,
    };
  }

  async estimatePlaceBidGas(args: OpeningAuctionBidArgs): Promise<bigint> {
    await this.assertValidBid(args);
    const simulation = await this.simulatePlaceBid(args);
    return simulation.gasEstimate;
  }

  async simulatePlaceBid(
    args: OpeningAuctionBidArgs,
  ): Promise<OpeningAuctionBidSimulationResult> {
    await this.assertValidBid(args);
    const { tickLower, tickUpper, salt } = this.resolveBidCoordinates(args);
    const owner = this.resolveOwnerOrUndefined(args.owner, args.account);
    const hookData = this.resolveHookData(args.hookData, owner, args.account);

    const simulation = await this.positionManager.simulatePlaceBid({
      key: this.openingAuctionPoolKey,
      tickLower,
      liquidity: args.liquidity,
      salt,
      hookData,
      account: args.account,
    });

    return {
      ...simulation,
      tickLower,
      tickUpper,
      salt,
    };
  }

  async placeBid(
    args: Omit<OpeningAuctionBidArgs, 'account'>,
    options?: { gas?: bigint },
  ): Promise<Hash> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }

    await this.assertValidBid({
      ...args,
      account: this.walletClient.account,
    });

    const simulation = await this.simulatePlaceBid({
      ...args,
      account: this.walletClient.account,
    });

    const txHash = await this.walletClient.writeContract(
      options?.gas
        ? { ...(simulation.request as any), gas: options.gas }
        : (simulation.request as any),
    );

    this.invalidateSnapshot();
    return txHash;
  }

  async estimateWithdrawBidGas(args: OpeningAuctionBidArgs): Promise<bigint> {
    const simulation = await this.simulateWithdrawBid(args);
    return simulation.gasEstimate;
  }

  async simulateWithdrawBid(
    args: OpeningAuctionBidArgs,
  ): Promise<OpeningAuctionBidSimulationResult> {
    this.assertPositiveLiquidity(args.liquidity, 'withdrawBid');

    const { tickLower, tickUpper, salt } = this.resolveBidCoordinates(args);
    const owner = this.resolveOwnerOrUndefined(args.owner, args.account);
    const hookData = this.resolveHookData(args.hookData, owner, args.account);

    const simulation = await this.positionManager.simulateWithdrawBid({
      key: this.openingAuctionPoolKey,
      tickLower,
      liquidity: args.liquidity,
      salt,
      hookData,
      account: args.account,
    });

    return {
      ...simulation,
      tickLower,
      tickUpper,
      salt,
    };
  }

  async withdrawBid(
    args: Omit<OpeningAuctionBidArgs, 'account'>,
    options?: { gas?: bigint },
  ): Promise<Hash> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }

    const simulation = await this.simulateWithdrawBid({
      ...args,
      account: this.walletClient.account,
    });

    const txHash = await this.walletClient.writeContract(
      options?.gas
        ? { ...(simulation.request as any), gas: options.gas }
        : (simulation.request as any),
    );

    this.invalidateSnapshot();
    return txHash;
  }

  async simulateWithdrawFullBid(
    args: OpeningAuctionWithdrawFullBidArgs,
  ): Promise<OpeningAuctionWithdrawFullBidSimulationResult> {
    const owner = this.resolveOwner(args.owner, args.account);
    const hookData = this.resolveHookData(args.hookData, owner, args.account);

    return await this.positionManager.simulateWithdrawFullBid({
      openingAuctionHookAddress: this.openingAuctionHookAddress,
      key: this.openingAuctionPoolKey,
      tickLower: args.tickLower,
      salt: args.salt,
      hookData,
      owner,
      account: args.account,
    });
  }

  async withdrawFullBid(
    args: Omit<OpeningAuctionWithdrawFullBidArgs, 'account'>,
    options?: { gas?: bigint },
  ): Promise<OpeningAuctionWithdrawFullBidResult> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }

    const simulation = await this.simulateWithdrawFullBid({
      ...args,
      account: this.walletClient.account,
    });

    const transactionHash = await this.walletClient.writeContract(
      options?.gas
        ? { ...(simulation.simulation.request as any), gas: options.gas }
        : (simulation.simulation.request as any),
    );

    this.invalidateSnapshot();

    return {
      positionId: simulation.positionId,
      liquidity: simulation.liquidity,
      transactionHash,
    };
  }

  async getPositionInfo(
    args: OpeningAuctionBidLookupArgs,
  ): Promise<OpeningAuctionBidPositionInfo | null> {
    const owner = this.resolveOwner(args.owner, args.account);
    const { tickLower, tickUpper, salt } = this.resolveBidCoordinates(args);

    const positionId = await this.openingAuction.getPositionId({
      owner,
      tickLower,
      tickUpper,
      salt,
    });
    if (positionId === 0n) {
      return null;
    }

    const [position, isInRange, claimableIncentives] = await Promise.all([
      this.openingAuction.getPosition(positionId),
      this.openingAuction.isInRange(positionId),
      this.openingAuction.calculateIncentives(positionId),
    ]);

    const positionKey = OpeningAuctionPositionManager.computePositionKey({
      owner,
      tickLower,
      tickUpper,
      salt,
    });

    return {
      owner,
      tickLower,
      tickUpper,
      salt,
      positionKey,
      positionId,
      position,
      isInRange,
      claimableIncentives,
    };
  }

  async getBidStatus(args: OpeningAuctionBidLookupArgs): Promise<OpeningAuctionBidStatus> {
    const owner = this.resolveOwner(args.owner, args.account);
    const { tickLower, tickUpper, salt } = this.resolveBidCoordinates(args);

    const [snapshot, positionInfo] = await Promise.all([
      this.getAuctionSnapshot(),
      this.getPositionInfo({
        owner,
        tickLower,
        salt,
        account: args.account,
      }),
    ]);

    const { phase, isToken0, estimatedClearingTick } = snapshot;

    const positionKey = OpeningAuctionPositionManager.computePositionKey({
      owner,
      tickLower,
      tickUpper,
      salt,
    });

    if (!positionInfo) {
      return {
        exists: false,
        owner,
        tickLower,
        tickUpper,
        salt,
        positionKey,
        positionId: 0n,
        liquidity: 0n,
        isInRange: false,
        claimableIncentives: 0n,
        hasClaimedIncentives: false,
        phase,
        estimatedClearingTick,
        wouldBeFilledAtEstimatedClearing: false,
        isAboveEstimatedClearing: false,
      };
    }

    const wouldBeFilledAtEstimatedClearing = isToken0
      ? estimatedClearingTick < tickUpper
      : estimatedClearingTick >= tickLower;

    const isAboveEstimatedClearing = isToken0
      ? tickLower > estimatedClearingTick
      : tickLower < estimatedClearingTick;

    return {
      exists: true,
      owner,
      tickLower,
      tickUpper,
      salt,
      positionKey,
      positionId: positionInfo.positionId,
      liquidity: positionInfo.position.liquidity,
      isInRange: positionInfo.isInRange,
      claimableIncentives: positionInfo.claimableIncentives,
      hasClaimedIncentives: positionInfo.position.hasClaimedIncentives,
      phase,
      estimatedClearingTick,
      wouldBeFilledAtEstimatedClearing,
      isAboveEstimatedClearing,
    };
  }

  /**
   * Enumerate all bids for a given owner with enriched info.
   */
  async getOwnerBids(args?: {
    owner?: Address;
    account?: Address | Account;
  }): Promise<OpeningAuctionOwnerBidInfo[]> {
    const owner = this.resolveOwner(args?.owner, args?.account);
    const positionIds = await this.openingAuction.getOwnerPositions(owner);

    if (positionIds.length === 0) {
      return [];
    }

    return await this.getMultiplePositionInfos(positionIds);
  }

  /**
   * Batch fetch position info for multiple position IDs.
   */
  async getMultiplePositionInfos(
    positionIds: bigint[],
  ): Promise<OpeningAuctionOwnerBidInfo[]> {
    if (positionIds.length === 0) {
      return [];
    }

    const results = await Promise.all(
      positionIds.map(async (positionId) => {
        const [position, isInRange, claimableIncentives] = await Promise.all([
          this.openingAuction.getPosition(positionId),
          this.openingAuction.isInRange(positionId),
          this.openingAuction.calculateIncentives(positionId),
        ]);

        return {
          positionId,
          owner: position.owner,
          tickLower: position.tickLower,
          tickUpper: position.tickUpper,
          liquidity: position.liquidity,
          rewardDebtX128: position.rewardDebtX128,
          hasClaimedIncentives: position.hasClaimedIncentives,
          isInRange,
          claimableIncentives,
        };
      }),
    );

    return results.sort((a, b) =>
      a.positionId < b.positionId ? -1 : a.positionId > b.positionId ? 1 : 0,
    );
  }

  /**
   * Batch status for all owner positions including clearing tick info.
   */
  async getOwnerBidStatuses(args?: {
    owner?: Address;
    account?: Address | Account;
  }): Promise<OpeningAuctionOwnerBidStatus[]> {
    const owner = this.resolveOwner(args?.owner, args?.account);

    const [bids, snapshot] = await Promise.all([
      this.getOwnerBids({ owner }),
      this.getAuctionSnapshot(),
    ]);

    const { phase, isToken0, estimatedClearingTick } = snapshot;

    return bids.map((bid) => {
      const wouldBeFilledAtEstimatedClearing = isToken0
        ? estimatedClearingTick < bid.tickUpper
        : estimatedClearingTick >= bid.tickLower;

      const isAboveEstimatedClearing = isToken0
        ? bid.tickLower > estimatedClearingTick
        : bid.tickLower < estimatedClearingTick;

      return {
        ...bid,
        phase,
        estimatedClearingTick,
        wouldBeFilledAtEstimatedClearing,
        isAboveEstimatedClearing,
      };
    });
  }

  /**
   * Read liquidity across a tick range.
   */
  async getTickLiquidityDistribution(args: {
    startTick: number;
    endTick: number;
    step?: number;
  }): Promise<Array<{ tick: number; liquidity: bigint }>> {
    const step = args.step ?? this.openingAuctionPoolKey.tickSpacing;
    if (!Number.isInteger(step) || step <= 0) {
      throw new Error('step must be a positive integer');
    }

    const { startTick, endTick } = args;
    if (!Number.isInteger(startTick) || !Number.isInteger(endTick)) {
      throw new Error('startTick and endTick must be integers');
    }
    if (startTick > endTick) {
      throw new Error('startTick must be <= endTick');
    }

    const tickSpacing = this.openingAuctionPoolKey.tickSpacing;
    if (startTick % tickSpacing !== 0) {
      throw new Error(
        `startTick (${startTick}) must be aligned to tickSpacing (${tickSpacing})`,
      );
    }
    if (endTick % tickSpacing !== 0) {
      throw new Error(
        `endTick (${endTick}) must be aligned to tickSpacing (${tickSpacing})`,
      );
    }
    if (step % tickSpacing !== 0) {
      throw new Error(
        `step (${step}) must be a multiple of tickSpacing (${tickSpacing})`,
      );
    }

    const ticks: number[] = [];
    for (let t = startTick; t <= endTick; t += step) {
      ticks.push(t);
    }

    if (ticks.length > 1000) {
      throw new Error('Tick range too large (max 1000 ticks per query)');
    }

    const liquidities = await Promise.all(
      ticks.map((tick) => this.openingAuction.getLiquidityAtTick(tick)),
    );

    return ticks.map((tick, i) => ({ tick, liquidity: liquidities[i] }));
  }

  // --- Incentives ---

  async estimateClaimIncentivesGas(
    args: OpeningAuctionBidLookupArgs,
  ): Promise<bigint> {
    const simulation = await this.simulateClaimIncentives(args);
    return simulation.gasEstimate;
  }

  async simulateClaimIncentives(
    args: OpeningAuctionBidLookupArgs,
  ): Promise<OpeningAuctionClaimIncentivesSimulationResult> {
    const owner = this.resolveOwner(args.owner, args.account);
    const { tickLower, tickUpper, salt } = this.resolveBidCoordinates(args);

    const positionId = await this.openingAuction.getPositionId({
      owner,
      tickLower,
      tickUpper,
      salt,
    });
    if (positionId === 0n) {
      throw new Error('Position not found for the given (owner,ticks,salt)');
    }

    const simulation = await this.openingAuction.simulateClaimIncentives(
      positionId,
      args.account,
    );

    return {
      positionId,
      request: simulation.request,
      gasEstimate: simulation.gasEstimate,
    };
  }

  async claimIncentives(
    args: Omit<OpeningAuctionBidLookupArgs, 'account'>,
    options?: { gas?: bigint },
  ): Promise<Hash> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }

    const simulation = await this.simulateClaimIncentives({
      ...args,
      account: this.walletClient.account,
    });

    return await this.walletClient.writeContract(
      options?.gas
        ? { ...(simulation.request as any), gas: options.gas }
        : (simulation.request as any),
    );
  }

  // --- Phase 2b: increaseBid / decreaseBid ---

  async simulateIncreaseBid(
    args: OpeningAuctionBidArgs,
  ): Promise<OpeningAuctionBidSimulationResult> {
    return this.simulatePlaceBid(args);
  }

  async estimateIncreaseBidGas(args: OpeningAuctionBidArgs): Promise<bigint> {
    return this.estimatePlaceBidGas(args);
  }

  async increaseBid(
    args: Omit<OpeningAuctionBidArgs, 'account'>,
    options?: { gas?: bigint },
  ): Promise<Hash> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }

    await this.assertValidBid({
      ...args,
      account: this.walletClient.account,
    });

    return this.placeBid(args, options);
  }

  async simulateDecreaseBid(
    args: OpeningAuctionBidArgs,
  ): Promise<OpeningAuctionBidSimulationResult> {
    const phase = await this.openingAuction.getPhase();
    if (phase === OPENING_AUCTION_PHASE_ACTIVE) {
      throw new Error(
        'Cannot decrease bid during active auction phase. Only full withdrawal is allowed during active auction.',
      );
    }
    return this.simulateWithdrawBid(args);
  }

  async estimateDecreaseBidGas(args: OpeningAuctionBidArgs): Promise<bigint> {
    const phase = await this.openingAuction.getPhase();
    if (phase === OPENING_AUCTION_PHASE_ACTIVE) {
      throw new Error(
        'Cannot decrease bid during active auction phase. Only full withdrawal is allowed during active auction.',
      );
    }
    return this.estimateWithdrawBidGas(args);
  }

  async decreaseBid(
    args: Omit<OpeningAuctionBidArgs, 'account'>,
    options?: { gas?: bigint },
  ): Promise<Hash> {
    const phase = await this.openingAuction.getPhase();
    if (phase === OPENING_AUCTION_PHASE_ACTIVE) {
      throw new Error(
        'Cannot decrease bid during active auction phase. Only full withdrawal is allowed during active auction.',
      );
    }
    return this.withdrawBid(args, options);
  }

  // --- Phase 2b: moveBid ---

  /**
   * Simulate both legs of a move (withdraw + place) without executing.
   * Use this to pre-validate before calling `moveBid`. See `moveBid` for
   * non-atomic semantics and partial-completion recovery guidance.
   */
  async simulateMoveBid(
    args: OpeningAuctionMoveBidArgs,
  ): Promise<OpeningAuctionMoveBidSimulationResult> {
    if (args.fromTickLower === args.toTickLower) {
      throw new Error('fromTickLower and toTickLower must be different');
    }

    const owner = this.resolveOwner(args.owner, args.account);
    const { tickLower: fromTickLower, tickUpper: fromTickUpper } =
      this.resolveBidCoordinates({ tickLower: args.fromTickLower, salt: args.salt });
    const salt = args.salt ?? zeroHash;

    const positionId = await this.openingAuction.getPositionId({
      owner,
      tickLower: fromTickLower,
      tickUpper: fromTickUpper,
      salt,
    });

    if (positionId === 0n) {
      throw new Error('Source position not found for the given (owner,ticks,salt)');
    }

    const position = await this.openingAuction.getPosition(positionId);
    if (position.liquidity === 0n) {
      throw new Error('Source position has zero liquidity');
    }

    const liquidity = position.liquidity;

    // Validate the place leg before simulating
    await this.assertValidBid({
      tickLower: args.toTickLower,
      liquidity,
      salt: args.salt,
      owner: args.owner,
      account: args.account,
    });

    const withdrawSimulation = await this.simulateWithdrawBid({
      tickLower: args.fromTickLower,
      liquidity,
      salt: args.salt,
      owner: args.owner,
      account: args.account,
    });

    const placeSimulation = await this.simulatePlaceBid({
      tickLower: args.toTickLower,
      liquidity,
      salt: args.salt,
      owner: args.owner,
      account: args.account,
    });

    return { withdrawSimulation, placeSimulation, liquidity };
  }

  /**
   * Move a bid from one tick to another by withdrawing and re-placing.
   *
   * **Non-atomic**: This executes two separate transactions (withdraw then place).
   * If the withdraw succeeds but the place fails (e.g. due to gas, slippage, or
   * auction state change), the bid will be in a withdrawn state with funds returned
   * to the caller. To recover, retry with `placeBid` at the desired tick using the
   * same liquidity amount. Use `simulateMoveBid` first to pre-validate both legs.
   */
  async moveBid(
    args: Omit<OpeningAuctionMoveBidArgs, 'account'>,
    options?: { gasWithdraw?: bigint; gasPlace?: bigint },
  ): Promise<OpeningAuctionMoveBidResult> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }

    if (args.fromTickLower === args.toTickLower) {
      throw new Error('fromTickLower and toTickLower must be different');
    }

    const owner = this.resolveOwner(args.owner, this.walletClient.account);
    const { tickLower: fromTickLower, tickUpper: fromTickUpper } =
      this.resolveBidCoordinates({ tickLower: args.fromTickLower, salt: args.salt });
    const salt = args.salt ?? zeroHash;

    const positionId = await this.openingAuction.getPositionId({
      owner,
      tickLower: fromTickLower,
      tickUpper: fromTickUpper,
      salt,
    });

    if (positionId === 0n) {
      throw new Error('Source position not found for the given (owner,ticks,salt)');
    }

    const position = await this.openingAuction.getPosition(positionId);
    if (position.liquidity === 0n) {
      throw new Error('Source position has zero liquidity');
    }

    const liquidity = position.liquidity;

    // Validate the place leg before executing either transaction
    await this.assertValidBid({
      tickLower: args.toTickLower,
      liquidity,
      salt: args.salt,
      owner: args.owner,
      account: this.walletClient.account,
    });

    // Execute withdraw
    const withdrawTxHash = await this.withdrawBid(
      { tickLower: args.fromTickLower, liquidity, salt: args.salt, owner: args.owner },
      options?.gasWithdraw ? { gas: options.gasWithdraw } : undefined,
    );

    // Execute place at new tick
    let placeTxHash: Hash;
    try {
      placeTxHash = await this.placeBid(
        { tickLower: args.toTickLower, liquidity, salt: args.salt, owner: args.owner },
        options?.gasPlace ? { gas: options.gasPlace } : undefined,
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err);
      throw new Error(
        `moveBid: withdraw succeeded (tx: ${withdrawTxHash}) but place at tick ${args.toTickLower} failed: ${message}. ` +
          `Retry with placeBid({ tickLower: ${args.toTickLower}, liquidity: ${liquidity}, salt: "${salt}" }) to recover.`,
      );
    }

    this.invalidateSnapshot();

    return { withdrawTxHash, placeTxHash, liquidity };
  }

  // --- Phase 2b: quoteBid ---

  async quoteBid(args: OpeningAuctionBidArgs): Promise<OpeningAuctionBidQuote> {
    const { tickLower, tickUpper } = this.resolveBidCoordinates(args);

    const [simulation, estimatedClearingTick, isToken0] = await Promise.all([
      this.simulatePlaceBid(args),
      this.openingAuction.getEstimatedClearingTick(),
      this.openingAuction.getIsToken0(),
    ]);

    const amount0Delta = simulation.decoded.amount0;
    const amount1Delta = simulation.decoded.amount1;
    const tokenInAmount0 = amount0Delta < 0n ? -amount0Delta : 0n;
    const tokenInAmount1 = amount1Delta < 0n ? -amount1Delta : 0n;

    const wouldBeFilledAtEstimatedClearing = isToken0
      ? estimatedClearingTick < tickUpper
      : estimatedClearingTick >= tickLower;

    const isAboveEstimatedClearing = isToken0
      ? tickLower > estimatedClearingTick
      : tickLower < estimatedClearingTick;

    // Rough incentive share estimate: position liquidity / (position liquidity + existing liquidity at tick)
    // Returns null when liquidity data is unavailable so callers can distinguish "unknown" from "zero".
    let estimatedIncentiveShareBps: number | null = null;
    try {
      const existingLiquidity = await this.openingAuction.getLiquidityAtTick(tickLower);
      const totalLiquidity = existingLiquidity + args.liquidity;
      if (totalLiquidity > 0n) {
        estimatedIncentiveShareBps = Number(
          (args.liquidity * 10000n) / totalLiquidity,
        );
      } else {
        estimatedIncentiveShareBps = 0;
      }
    } catch {
      // Liquidity read failed — leave as null to signal unknown
    }

    return {
      tickLower,
      tickUpper,
      liquidity: args.liquidity,
      amount0Delta,
      amount1Delta,
      tokenInAmount0,
      tokenInAmount1,
      estimatedClearingTick,
      wouldBeFilledAtEstimatedClearing,
      isAboveEstimatedClearing,
      estimatedIncentiveShareBps,
    };
  }

  // --- Phase 2b: claimAllIncentives ---

  async simulateClaimAllIncentives(args?: {
    owner?: Address;
    account?: Address | Account;
  }): Promise<OpeningAuctionClaimAllIncentivesPreview> {
    const owner = this.resolveOwner(args?.owner, args?.account);
    const bids = await this.getOwnerBids({ owner });

    const claimablePositions: Array<{ positionId: bigint; claimableIncentives: bigint }> = [];
    const skippedPositions: Array<{ positionId: bigint; reason: string }> = [];

    for (const bid of bids) {
      if (bid.hasClaimedIncentives) {
        skippedPositions.push({ positionId: bid.positionId, reason: 'already claimed' });
        continue;
      }
      if (bid.claimableIncentives === 0n) {
        skippedPositions.push({ positionId: bid.positionId, reason: 'zero claimable' });
        continue;
      }
      if (!bid.isInRange) {
        skippedPositions.push({ positionId: bid.positionId, reason: 'not in range' });
        continue;
      }
      claimablePositions.push({
        positionId: bid.positionId,
        claimableIncentives: bid.claimableIncentives,
      });
    }

    const totalClaimable = claimablePositions.reduce(
      (acc, p) => acc + p.claimableIncentives,
      0n,
    );

    return { claimablePositions, totalClaimable, skippedPositions };
  }

  async claimAllIncentives(args?: {
    owner?: Address;
    account?: Address | Account;
    continueOnError?: boolean;
  }): Promise<OpeningAuctionClaimAllIncentivesResult> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }

    const preview = await this.simulateClaimAllIncentives({
      owner: args?.owner,
      account: args?.account ?? this.walletClient.account,
    });

    const results: OpeningAuctionClaimAllIncentivesResult['results'] = [];
    let totalClaimed = 0;
    let totalFailed = 0;

    for (const { positionId } of preview.claimablePositions) {
      try {
        const { request } = await this.openingAuction.simulateClaimIncentives(
          positionId,
          this.walletClient.account,
        );

        const transactionHash = await this.walletClient.writeContract(request as any);
        results.push({ positionId, transactionHash });
        totalClaimed++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.push({ positionId, error: errorMessage });
        totalFailed++;

        if (!args?.continueOnError) {
          break;
        }
      }
    }

    return { results, totalClaimed, totalFailed };
  }

  // --- Settlement ---

  async estimateSettleAuctionGas(account?: Address | Account): Promise<bigint> {
    return await this.openingAuction.estimateSettleAuctionGas(account);
  }

  async simulateSettleAuction(account?: Address | Account): Promise<{
    request: unknown;
    gasEstimate: bigint;
  }> {
    return await this.openingAuction.simulateSettleAuction(account);
  }

  async settleAuction(options?: { gas?: bigint }): Promise<Hash> {
    return await this.openingAuction.settleAuction(options);
  }

  // --- Event Watchers ---

  watchAuctionSettlement(
    options: OpeningAuctionWatchSettlementOptions,
  ): () => void {
    return this.openingAuction.watchAuctionSettled(options);
  }

  watchBidStatus(options: OpeningAuctionWatchBidStatusOptions): () => void {
    let stopped = false;
    let polling = false;
    let previousStatus: OpeningAuctionBidStatus | null = null;

    const pollStatus = async (): Promise<void> => {
      if (stopped || polling) {
        return;
      }
      polling = true;

      try {
        const nextStatus = await this.getBidStatus(options);
        if (
          previousStatus === null ||
          OpeningAuctionBidManager.hasStatusChanged(previousStatus, nextStatus)
        ) {
          options.onStatusChange(nextStatus, previousStatus);
          previousStatus = nextStatus;
        }
      } catch (error) {
        options.onError?.(error as Error);
      } finally {
        polling = false;
      }
    };

    const unwatch = this.rpc.watchBlockNumber({
      emitOnBegin: options.emitOnBegin ?? true,
      poll: options.poll ? true : undefined,
      pollingInterval: options.pollingInterval,
      onBlockNumber: () => {
        void pollStatus();
      },
      onError: (error) => options.onError?.(error as Error),
    });

    return () => {
      stopped = true;
      unwatch();
    };
  }

  watchBidPlaced(options: OpeningAuctionWatchBidPlacedOptions): () => void {
    const args: any = {};
    if (options.owner) {
      args.owner = options.owner;
    }

    return this.rpc.watchContractEvent({
      address: this.openingAuctionHookAddress,
      abi: bidManagerEventAbi,
      eventName: 'BidPlaced',
      args: Object.keys(args).length > 0 ? args : undefined,
      fromBlock: options.fromBlock,
      poll: options.poll,
      pollingInterval: options.pollingInterval,
      strict: options.strict ?? false,
      onError: options.onError,
      onLogs: (logs: any[]) => {
        for (const log of logs) {
          const logArgs = (log?.args ?? {}) as {
            positionId?: bigint;
            owner?: Address;
            tickLower?: number | bigint;
            liquidity?: bigint;
          };

          options.onBidPlaced({
            positionId: logArgs.positionId ?? 0n,
            owner: logArgs.owner ?? zeroAddress,
            tickLower: Number(logArgs.tickLower ?? 0),
            liquidity: logArgs.liquidity ?? 0n,
            transactionHash: (log.transactionHash ?? zeroHash) as Hash,
            blockNumber: (log.blockNumber ?? 0n) as bigint,
            logIndex: Number(log.logIndex ?? 0),
          });
        }
      },
    } as any);
  }

  watchBidWithdrawn(options: OpeningAuctionWatchBidWithdrawnOptions): () => void {
    const args: any = {};
    if (options.positionId !== undefined) {
      args.positionId = options.positionId;
    }

    return this.rpc.watchContractEvent({
      address: this.openingAuctionHookAddress,
      abi: bidManagerEventAbi,
      eventName: 'BidWithdrawn',
      args: Object.keys(args).length > 0 ? args : undefined,
      fromBlock: options.fromBlock,
      poll: options.poll,
      pollingInterval: options.pollingInterval,
      strict: options.strict ?? false,
      onError: options.onError,
      onLogs: (logs: any[]) => {
        for (const log of logs) {
          const logArgs = (log?.args ?? {}) as {
            positionId?: bigint;
          };

          options.onBidWithdrawn({
            positionId: logArgs.positionId ?? 0n,
            transactionHash: (log.transactionHash ?? zeroHash) as Hash,
            blockNumber: (log.blockNumber ?? 0n) as bigint,
            logIndex: Number(log.logIndex ?? 0),
          });
        }
      },
    } as any);
  }

  watchIncentivesClaimed(options: OpeningAuctionWatchIncentivesClaimedOptions): () => void {
    const args: any = {};
    if (options.owner) {
      args.owner = options.owner;
    }
    if (options.positionId !== undefined) {
      args.positionId = options.positionId;
    }

    return this.rpc.watchContractEvent({
      address: this.openingAuctionHookAddress,
      abi: bidManagerEventAbi,
      eventName: 'IncentivesClaimed',
      args: Object.keys(args).length > 0 ? args : undefined,
      fromBlock: options.fromBlock,
      poll: options.poll,
      pollingInterval: options.pollingInterval,
      strict: options.strict ?? false,
      onError: options.onError,
      onLogs: (logs: any[]) => {
        for (const log of logs) {
          const logArgs = (log?.args ?? {}) as {
            positionId?: bigint;
            owner?: Address;
            amount?: bigint;
          };

          options.onIncentivesClaimed({
            positionId: logArgs.positionId ?? 0n,
            owner: logArgs.owner ?? zeroAddress,
            amount: logArgs.amount ?? 0n,
            transactionHash: (log.transactionHash ?? zeroHash) as Hash,
            blockNumber: (log.blockNumber ?? 0n) as bigint,
            logIndex: Number(log.logIndex ?? 0),
          });
        }
      },
    } as any);
  }

  watchPhaseChange(options: OpeningAuctionWatchPhaseChangeOptions): () => void {
    return this.rpc.watchContractEvent({
      address: this.openingAuctionHookAddress,
      abi: bidManagerEventAbi,
      eventName: 'PhaseChanged',
      fromBlock: options.fromBlock,
      poll: options.poll,
      pollingInterval: options.pollingInterval,
      strict: options.strict ?? false,
      onError: options.onError,
      onLogs: (logs: any[]) => {
        for (const log of logs) {
          const logArgs = (log?.args ?? {}) as {
            oldPhase?: number | bigint;
            newPhase?: number | bigint;
          };

          options.onPhaseChanged({
            oldPhase: Number(logArgs.oldPhase ?? 0),
            newPhase: Number(logArgs.newPhase ?? 0),
            transactionHash: (log.transactionHash ?? zeroHash) as Hash,
            blockNumber: (log.blockNumber ?? 0n) as bigint,
            logIndex: Number(log.logIndex ?? 0),
          });
        }
      },
    } as any);
  }

  watchEstimatedClearingTick(
    options: OpeningAuctionWatchEstimatedClearingTickOptions,
  ): () => void {
    return this.rpc.watchContractEvent({
      address: this.openingAuctionHookAddress,
      abi: bidManagerEventAbi,
      eventName: 'EstimatedClearingTickUpdated',
      fromBlock: options.fromBlock,
      poll: options.poll,
      pollingInterval: options.pollingInterval,
      strict: options.strict ?? false,
      onError: options.onError,
      onLogs: (logs: any[]) => {
        for (const log of logs) {
          const logArgs = (log?.args ?? {}) as {
            newEstimatedClearingTick?: number | bigint;
          };

          options.onEstimatedClearingTickUpdated({
            newEstimatedClearingTick: Number(logArgs.newEstimatedClearingTick ?? 0),
            transactionHash: (log.transactionHash ?? zeroHash) as Hash,
            blockNumber: (log.blockNumber ?? 0n) as bigint,
            logIndex: Number(log.logIndex ?? 0),
          });
        }
      },
    } as any);
  }

  // --- Private helpers ---

  /**
   * Preflight guard: runs validateBid and throws if any errors are found.
   */
  private async assertValidBid(args: OpeningAuctionBidArgs): Promise<void> {
    const result = await this.validateBid(args);
    if (!result.valid) {
      throw new Error(`Invalid bid: ${result.errors.join(', ')}`);
    }
  }

  /**
   * Returns a memoized auction snapshot (phase, isToken0, estimatedClearingTick).
   * Cached per block number to reduce redundant reads within composite operations.
   */
  private async getAuctionSnapshot(): Promise<{
    phase: number;
    isToken0: boolean;
    estimatedClearingTick: number;
  }> {
    const currentBlock = await this.rpc.getBlockNumber();

    if (
      this._snapshotCache &&
      this._snapshotCache.blockNumber >= currentBlock
    ) {
      return this._snapshotCache;
    }

    const [phase, isToken0, estimatedClearingTick] = await Promise.all([
      this.openingAuction.getPhase(),
      this.openingAuction.getIsToken0(),
      this.openingAuction.getEstimatedClearingTick(),
    ]);

    this._snapshotCache = {
      phase,
      isToken0,
      estimatedClearingTick,
      blockNumber: currentBlock,
    };

    return this._snapshotCache;
  }

  /**
   * Invalidate the memoized snapshot (useful after write operations).
   */
  invalidateSnapshot(): void {
    this._snapshotCache = null;
  }

  private resolveBidCoordinates(args: {
    tickLower: number;
    salt?: Hash;
  }): { tickLower: number; tickUpper: number; salt: Hash } {
    const { tickLower, tickUpper } =
      OpeningAuctionPositionManager.validateSingleTick({
        key: this.openingAuctionPoolKey,
        tickLower: args.tickLower,
      });

    return {
      tickLower,
      tickUpper,
      salt: args.salt ?? zeroHash,
    };
  }

  private resolveOwner(owner?: Address, account?: Address | Account): Address {
    const resolvedOwner = this.resolveOwnerOrUndefined(owner, account);
    if (!resolvedOwner) {
      throw new Error(
        'owner (or account/walletClient) is required for bid resolution',
      );
    }
    return resolvedOwner;
  }

  private resolveOwnerOrUndefined(
    owner?: Address,
    account?: Address | Account,
  ): Address | undefined {
    return (
      owner ??
      this.accountToAddress(account) ??
      this.accountToAddress(
        this.walletClient?.account as Address | Account | undefined,
      )
    );
  }

  private resolveHookData(
    hookData: Hex | undefined,
    owner: Address | undefined,
    account?: Address | Account,
  ): Hex {
    if (hookData) {
      return hookData;
    }

    const resolvedOwner = owner ?? this.resolveOwner(undefined, account);
    return OpeningAuctionPositionManager.encodeOwnerHookData(
      resolvedOwner,
      'packed',
    );
  }

  private accountToAddress(account?: Address | Account): Address | undefined {
    if (!account) {
      return undefined;
    }
    return typeof account === 'string' ? account : account.address;
  }

  private assertPositiveLiquidity(
    liquidity: bigint,
    operation: 'withdrawBid',
  ): void {
    if (liquidity <= 0n) {
      throw new Error(`${operation} requires liquidity > 0`);
    }
  }

  private static hasStatusChanged(
    previous: OpeningAuctionBidStatus,
    next: OpeningAuctionBidStatus,
  ): boolean {
    return (
      previous.exists !== next.exists ||
      previous.positionId !== next.positionId ||
      previous.liquidity !== next.liquidity ||
      previous.isInRange !== next.isInRange ||
      previous.claimableIncentives !== next.claimableIncentives ||
      previous.hasClaimedIncentives !== next.hasClaimedIncentives ||
      previous.phase !== next.phase ||
      previous.estimatedClearingTick !== next.estimatedClearingTick ||
      previous.wouldBeFilledAtEstimatedClearing !== next.wouldBeFilledAtEstimatedClearing ||
      previous.isAboveEstimatedClearing !== next.isAboveEstimatedClearing
    );
  }
}

export type {
  OpeningAuctionAuctionSettledEvent,
  OpeningAuctionWatchSettlementOptions,
};
