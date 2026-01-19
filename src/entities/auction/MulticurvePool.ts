import {
  type Address,
  type PublicClient,
  type WalletClient,
  type Hash,
  type Hex,
  zeroAddress,
} from 'viem';
import type { SupportedPublicClient } from '../../common/types';
import { LockablePoolStatus } from '../../static/types';
import type { MulticurvePoolState } from '../../multicurve/types';
import type { V4PoolKey } from '../../internal/v4-shared/types';
import {
  v4MulticurveInitializerAbi,
  v4MulticurveMigratorAbi,
  streamableFeesLockerAbi,
} from '../../common/abis';
import { getAddresses } from '../../common/addresses';
import type { SupportedChainId } from '../../common/addresses';
import { computePoolId } from '../../internal/v4-shared/poolKey';

/** Result from finding which initializer contains the pool */
interface InitializerDiscoveryResult {
  initializerAddress: Address;
  state: MulticurvePoolState;
}

/**
 * MulticurvePool class for interacting with V4 multicurve pools
 *
 * Multicurve pools use the V4 multicurve initializer which supports:
 * - Multiple bonding curves with different price ranges
 * - Fee collection for configured beneficiaries
 * - No-migration lockable liquidity
 *
 * Note: V4 pools don't have their own contract addresses. The token address
 * is used as the lookup key to retrieve pool state from the initializer contract.
 *
 * Terminology: The contracts call the created token "asset" (paired against "numeraire", e.g., WETH).
 * We use "tokenAddress" in the SDK for consistency.
 */
export class MulticurvePool {
  private client: SupportedPublicClient;
  private walletClient?: WalletClient;
  private tokenAddress: Address;
  private get rpc(): PublicClient {
    return this.client as PublicClient;
  }

  constructor(
    client: SupportedPublicClient,
    walletClient: WalletClient | undefined,
    tokenAddress: Address,
  ) {
    this.client = client;
    this.walletClient = walletClient;
    this.tokenAddress = tokenAddress;
  }

  /**
   * Get the token address for this pool
   * This is also the lookup key used to retrieve pool state from the initializer
   * (Called "asset" in the contracts, but we use "tokenAddress" for SDK consistency)
   */
  getTokenAddress(): Address {
    return this.tokenAddress;
  }

  /**
   * Get current pool state from the multicurve initializer
   *
   * Automatically discovers which initializer (standard or scheduled) contains the pool.
   */
  async getState(): Promise<MulticurvePoolState> {
    const { state } = await this.findInitializerForPool();
    return state;
  }

  /**
   * Find which initializer contains this pool and return both the address and state.
   *
   * Tries v4MulticurveInitializer first (more common), then falls back to
   * v4ScheduledMulticurveInitializer if the pool isn't found.
   */
  private async findInitializerForPool(): Promise<InitializerDiscoveryResult> {
    const chainId = await this.rpc.getChainId();
    const addresses = getAddresses(chainId as SupportedChainId);

    // Build list of initializers to try, preferring non-scheduled (more common)
    const initializersToTry: Address[] = [
      addresses.v4MulticurveInitializer,
      addresses.v4ScheduledMulticurveInitializer,
    ].filter(
      (addr): addr is Address => addr !== undefined && addr !== zeroAddress,
    );

    if (initializersToTry.length === 0) {
      throw new Error(
        'No V4 multicurve initializer addresses configured for this chain',
      );
    }

    const triedInitializers: Address[] = [];

    for (const initializerAddress of initializersToTry) {
      triedInitializers.push(initializerAddress);

      const stateData = await this.rpc.readContract({
        address: initializerAddress,
        abi: v4MulticurveInitializerAbi,
        functionName: 'getState',
        args: [this.tokenAddress],
      });

      // Parse the returned tuple into a strongly typed PoolKey
      const [numeraire, status, rawPoolKey, farTick] = stateData as readonly [
        Address,
        number,
        {
          currency0: Address;
          currency1: Address;
          fee: number;
          tickSpacing: number;
          hooks: Address;
        } & readonly [Address, Address, number, number, Address],
        number,
      ];

      const poolKey = this.parsePoolKey(rawPoolKey);

      // Check if pool exists in this initializer
      // A non-existent pool will have zeroed hooks and tickSpacing
      if (poolKey.hooks !== zeroAddress && poolKey.tickSpacing !== 0) {
        const state: MulticurvePoolState = {
          asset: this.tokenAddress,
          numeraire,
          fee: poolKey.fee,
          tickSpacing: poolKey.tickSpacing,
          status,
          poolKey,
          farTick: Number(farTick),
        };
        return { initializerAddress, state };
      }
    }

    // Pool not found in any initializer
    throw new Error(
      `Pool not found for token ${this.tokenAddress}. ` +
        `Tried initializers: ${triedInitializers.join(', ')}`,
    );
  }

  /**
   * Collect fees from the pool and distribute to beneficiaries
   *
   * This function can be called by any beneficiary to trigger fee collection
   * and distribution. Fees are automatically distributed according to the
   * configured beneficiary shares.
   *
   * @returns Object containing the amounts of fees0 and fees1 distributed, and the transaction hash
   */
  async collectFees(): Promise<{
    fees0: bigint;
    fees1: bigint;
    transactionHash: Hash;
  }> {
    if (!this.walletClient) {
      throw new Error('Wallet client required to collect fees');
    }

    const chainId = await this.rpc.getChainId();
    const addresses = getAddresses(chainId as SupportedChainId);

    // Discover which initializer has this pool and get state in one call
    const { initializerAddress, state } = await this.findInitializerForPool();

    if (state.status === LockablePoolStatus.Locked) {
      const poolId = computePoolId(state.poolKey);
      return this.collectFeesFromContract(
        initializerAddress,
        v4MulticurveInitializerAbi,
        poolId,
      );
    }

    if (state.status === LockablePoolStatus.Exited) {
      if (!addresses.v4Migrator) {
        throw new Error(
          'V4 multicurve migrator address not configured for this chain',
        );
      }

      const assetData = await this.rpc.readContract({
        address: addresses.v4Migrator,
        abi: v4MulticurveMigratorAbi,
        functionName: 'getAssetData',
        args: [state.poolKey.currency0, state.poolKey.currency1],
      });

      const migratorPoolKey = this.parsePoolKey(
        (assetData as any).poolKey ?? (assetData as any)[1],
      );
      const poolId = computePoolId(migratorPoolKey);

      const beneficiaries =
        (assetData as any).beneficiaries ?? (assetData as any)[4] ?? [];
      if (!Array.isArray(beneficiaries) || beneficiaries.length === 0) {
        throw new Error(
          'Migrated multicurve pool has no beneficiaries configured',
        );
      }

      const lockerAddress = await this.resolveLockerAddress(
        addresses.v4Migrator,
        addresses.streamableFeesLocker,
      );

      const streamData = await this.rpc.readContract({
        address: lockerAddress,
        abi: streamableFeesLockerAbi,
        functionName: 'streams',
        args: [poolId],
      });

      const startDate = Number(
        (streamData as any).startDate ?? (streamData as any)[2] ?? 0,
      );
      if (startDate === 0) {
        throw new Error('Migrated multicurve stream not initialized');
      }

      return this.collectFeesFromContract(
        lockerAddress,
        streamableFeesLockerAbi,
        poolId,
      );
    }

    throw new Error('Multicurve pool is not locked or migrated');
  }

  /**
   * Get the numeraire address for this pool
   */
  async getNumeraireAddress(): Promise<Address> {
    const state = await this.getState();
    return state.numeraire;
  }

  private parsePoolKey(rawPoolKey: unknown): V4PoolKey {
    const poolKeyStruct = rawPoolKey as any;
    return {
      currency0: (poolKeyStruct.currency0 ?? poolKeyStruct[0]) as Address,
      currency1: (poolKeyStruct.currency1 ?? poolKeyStruct[1]) as Address,
      fee: Number(poolKeyStruct.fee ?? poolKeyStruct[2]),
      tickSpacing: Number(poolKeyStruct.tickSpacing ?? poolKeyStruct[3]),
      hooks: (poolKeyStruct.hooks ?? poolKeyStruct[4]) as Address,
    };
  }

  private async resolveLockerAddress(
    migratorAddress: Address,
    configuredLocker?: Address,
  ): Promise<Address> {
    if (configuredLocker) {
      return configuredLocker;
    }

    const lockerAddress = await this.rpc.readContract({
      address: migratorAddress,
      abi: v4MulticurveMigratorAbi,
      functionName: 'locker',
      args: [],
    });

    return lockerAddress as Address;
  }

  private async collectFeesFromContract(
    contractAddress: Address,
    abi: typeof v4MulticurveInitializerAbi | typeof streamableFeesLockerAbi,
    poolId: Hex,
  ): Promise<{ fees0: bigint; fees1: bigint; transactionHash: Hash }> {
    const { request, result } = await this.rpc.simulateContract({
      address: contractAddress,
      abi,
      functionName: 'collectFees',
      args: [poolId],
      account: this.walletClient!.account,
    });

    const hash = await this.walletClient!.writeContract(request);

    await this.rpc.waitForTransactionReceipt({ hash, confirmations: 1 });

    const [fees0, fees1] = result as readonly [bigint, bigint];

    return {
      fees0,
      fees1,
      transactionHash: hash,
    };
  }
}
