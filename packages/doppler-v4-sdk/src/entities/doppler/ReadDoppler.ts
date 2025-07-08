import {
  ReadContract,
  ReadAdapter,
  Drift,
  createDrift,
  FunctionReturn,
} from '@delvtech/drift';
import { Address } from 'abitype';
import { dopplerAbi, stateViewAbi } from '@/abis';
import { encodePacked, Hex, keccak256 } from 'viem';
import { PoolKey } from '@/types';
import { ReadDerc20 } from '../token/derc20/ReadDerc20';
import { ReadEth } from '../token/eth/ReadEth';
import { ETH_ADDRESS } from '@/constants';

type DopplerABI = typeof dopplerAbi;
type StateViewABI = typeof stateViewAbi;

/**
 * A read-only interface for interacting with Doppler protocol smart contracts.
 *
 * The ReadDoppler class provides methods to query various state variables and computed values
 * from both the main Doppler contract and its associated StateView contract. It serves as a
 * wrapper around Doppler protocol contracts, offering a convenient TypeScript interface for
 * reading contract state without making any state-changing transactions.
 *
 * @example
 * ```typescript
 * const doppler = new ReadDoppler(
 *   '0x1234...', // Doppler contract address
 *   '0x5678...', // StateView contract address
 *   undefined,   // Use default Drift instance
 *   '0xabcd...'  // Pool ID
 * );
 *
 * const currentPrice = await doppler.getCurrentPrice();
 * const assetToken = await doppler.getAssetToken();
 * ```
 */
export class ReadDoppler {
  /** The Drift adapter instance used for contract interactions */
  drift: Drift<ReadAdapter>;
  /** The address of the main Doppler contract */
  address: Address;
  /** Read contract instance for the main Doppler contract */
  doppler: ReadContract<DopplerABI>;
  /** Read contract instance for the StateView contract */
  stateView: ReadContract<StateViewABI>;
  /** The pool ID associated with this Doppler instance */
  poolId: Hex;

  /**
   * Creates a new ReadDoppler instance.
   *
   * @param dopplerAddress - The contract address of the main Doppler contract
   * @param stateViewAddress - The contract address of the StateView contract used for additional pool information
   * @param drift - Drift instance for contract interactions. Defaults to a new Drift instance
   * @param poolId - The unique identifier for the pool associated with this Doppler instance
   *
   * @example
   * ```typescript
   * const doppler = new ReadDoppler(
   *   '0x1234567890123456789012345678901234567890',
   *   '0x0987654321098765432109876543210987654321',
   *   createDrift(),
   *   '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef'
   * );
   * ```
   */
  constructor(
    dopplerAddress: Hex,
    stateViewAddress: Hex,
    drift: Drift<ReadAdapter> = createDrift(),
    poolId: Hex
  ) {
    this.address = dopplerAddress;
    this.doppler = drift.contract({
      abi: dopplerAbi,
      address: dopplerAddress,
    });
    this.stateView = drift.contract({
      abi: stateViewAbi,
      address: stateViewAddress,
    });
    this.poolId = poolId;
    this.drift = drift;
  }

  /**
   * Retrieves position information for a given salt value.
   *
   * @param salt - The salt identifier for the position
   * @returns Promise resolving to position data from the Doppler contract
   *
   * @example
   * ```typescript
   * const position = await doppler.getPosition('0x1234...');
   * console.log('Position data:', position);
   * ```
   */
  public async getPosition(
    salt: Hex
  ): Promise<FunctionReturn<DopplerABI, 'positions'>> {
    return this.doppler.read('positions', { salt });
  }

  /**
   * Gets the current slot0 data (including price information) for a specified pool.
   *
   * Slot0 contains the current state of the pool including the current price (sqrtPriceX96),
   * current tick, and other pool state variables.
   *
   * @param id - The pool ID to query
   * @returns Promise resolving to slot0 data including sqrtPriceX96, tick, and other pool state
   *
   * @example
   * ```typescript
   * const slot0 = await doppler.getSlot0('0xabcd...');
   * console.log('Current sqrt price:', slot0.sqrtPriceX96);
   * ```
   */
  public async getSlot0(
    id: Hex
  ): Promise<FunctionReturn<StateViewABI, 'getSlot0'>> {
    return this.stateView.read('getSlot0', { poolId: id });
  }

  /**
   * Calculates and returns the current price of the pool.
   *
   * Converts from Uniswap V3's sqrtPriceX96 format to a standard price by squaring
   * the sqrt price and dividing by 2^192 to remove the fixed-point scaling.
   *
   * @returns Promise resolving to the current price as a bigint
   *
   * @example
   * ```typescript
   * const price = await doppler.getCurrentPrice();
   * console.log('Current price:', price.toString());
   * ```
   */
  public async getCurrentPrice(): Promise<bigint> {
    const { sqrtPriceX96 } = await this.getSlot0(this.poolId);
    return (sqrtPriceX96 * sqrtPriceX96) / BigInt(2 ** 192);
  }

  /**
   * Retrieves the pool key configuration.
   *
   * The pool key contains the currency addresses, fee tier, tick spacing,
   * and hooks address that define the pool's configuration.
   *
   * @returns Promise resolving to the PoolKey containing pool configuration
   *
   * @example
   * ```typescript
   * const poolKey = await doppler.getPoolKey();
   * console.log('Currency0:', poolKey.currency0);
   * console.log('Currency1:', poolKey.currency1);
   * console.log('Fee:', poolKey.fee);
   * ```
   */
  public async getPoolKey(): Promise<PoolKey> {
    return this.doppler.read('poolKey');
  }

  /**
   * Computes the pool ID by hashing the pool key components.
   *
   * The pool ID is computed by encoding and hashing the pool key components
   * in the correct order (tokenA < tokenB lexicographically).
   *
   * @returns Promise resolving to the computed pool ID as a hex string
   *
   * @example
   * ```typescript
   * const poolId = await doppler.getPoolId();
   * console.log('Computed pool ID:', poolId);
   * ```
   */
  public async getPoolId(): Promise<Hex> {
    const poolKey = await this.getPoolKey();
    const tokenA =
      poolKey.currency0.toLowerCase() > poolKey.currency1.toLowerCase()
        ? poolKey.currency1
        : poolKey.currency0;
    const tokenB =
      poolKey.currency0.toLowerCase() > poolKey.currency1.toLowerCase()
        ? poolKey.currency0
        : poolKey.currency1;

    const poolId = keccak256(
      encodePacked(
        ['address', 'address', 'uint24', 'uint24', 'address'],
        [tokenA, tokenB, poolKey.fee, poolKey.tickSpacing, poolKey.hooks]
      )
    );

    return poolId;
  }

  /**
   * Returns a ReadDerc20 instance for the asset token.
   *
   * The asset token is currency1 from the pool key and represents the token
   * being sold in the Doppler strategy.
   *
   * @returns Promise resolving to a ReadDerc20 instance for the asset token
   *
   * @example
   * ```typescript
   * const assetToken = await doppler.getAssetToken();
   * const symbol = await assetToken.getSymbol();
   * console.log('Asset token symbol:', symbol);
   * ```
   */
  public async getAssetToken(): Promise<ReadDerc20> {
    const poolKey = await this.getPoolKey();
    return new ReadDerc20(poolKey.currency1, this.drift);
  }

  /**
   * Returns a token instance for the quote token.
   *
   * The quote token is currency0 from the pool key. If currency0 is ETH,
   * returns a ReadEth instance; otherwise returns a ReadDerc20 instance.
   *
   * @returns Promise resolving to either a ReadEth or ReadDerc20 instance for the quote token
   *
   * @example
   * ```typescript
   * const quoteToken = await doppler.getQuoteToken();
   * if (quoteToken instanceof ReadEth) {
   *   console.log('Quote token is ETH');
   * } else {
   *   const symbol = await quoteToken.getSymbol();
   *   console.log('Quote token symbol:', symbol);
   * }
   * ```
   */
  public async getQuoteToken(): Promise<ReadDerc20 | ReadEth> {
    const poolKey = await this.getPoolKey();
    return poolKey.currency0.toLowerCase() === ETH_ADDRESS.toLowerCase()
      ? new ReadEth(this.drift)
      : new ReadDerc20(poolKey.currency0, this.drift);
  }

  /**
   * Retrieves the current state of the Doppler contract.
   *
   * @returns Promise resolving to the current state value from the contract
   *
   * @example
   * ```typescript
   * const state = await doppler.getState();
   * console.log('Current contract state:', state);
   * ```
   */
  public async getState(): Promise<FunctionReturn<DopplerABI, 'state'>> {
    return this.doppler.read('state');
  }

  /**
   * Checks if the contract has insufficient proceeds.
   *
   * @returns Promise resolving to true if proceeds are insufficient, false otherwise
   *
   * @example
   * ```typescript
   * const insufficient = await doppler.getInsufficientProceeds();
   * if (insufficient) {
   *   console.log('Warning: Insufficient proceeds detected');
   * }
   * ```
   */
  public async getInsufficientProceeds(): Promise<boolean> {
    return this.doppler.read('insufficientProceeds');
  }

  /**
   * Checks if early exit is enabled for the strategy.
   *
   * @returns Promise resolving to true if early exit is enabled, false otherwise
   *
   * @example
   * ```typescript
   * const canExit = await doppler.getEarlyExit();
   * console.log('Early exit available:', canExit);
   * ```
   */
  public async getEarlyExit(): Promise<boolean> {
    return this.doppler.read('earlyExit');
  }

  /**
   * Gets the number of tokens scheduled to be sold in the strategy.
   *
   * @returns Promise resolving to the number of tokens to sell as a bigint
   *
   * @example
   * ```typescript
   * const tokensToSell = await doppler.getNumTokensToSell();
   * console.log('Tokens to sell:', tokensToSell.toString());
   * ```
   */
  public async getNumTokensToSell(): Promise<bigint> {
    return this.doppler.read('numTokensToSell');
  }

  /**
   * Gets the minimum proceeds threshold for the strategy.
   *
   * @returns Promise resolving to the minimum proceeds as a bigint
   *
   * @example
   * ```typescript
   * const minProceeds = await doppler.getMinimumProceeds();
   * console.log('Minimum proceeds:', minProceeds.toString());
   * ```
   */
  public async getMinimumProceeds(): Promise<bigint> {
    return this.doppler.read('minimumProceeds');
  }

  /**
   * Gets the maximum proceeds threshold for the strategy.
   *
   * @returns Promise resolving to the maximum proceeds as a bigint
   *
   * @example
   * ```typescript
   * const maxProceeds = await doppler.getMaximumProceeds();
   * console.log('Maximum proceeds:', maxProceeds.toString());
   * ```
   */
  public async getMaximumProceeds(): Promise<bigint> {
    return this.doppler.read('maximumProceeds');
  }

  /**
   * Gets the starting time of the Doppler strategy.
   *
   * @returns Promise resolving to the starting time as a Unix timestamp (bigint)
   *
   * @example
   * ```typescript
   * const startTime = await doppler.getStartingTime();
   * const startDate = new Date(Number(startTime) * 1000);
   * console.log('Strategy starts at:', startDate);
   * ```
   */
  public async getStartingTime(): Promise<bigint> {
    return this.doppler.read('startingTime');
  }

  /**
   * Gets the ending time of the Doppler strategy.
   *
   * @returns Promise resolving to the ending time as a Unix timestamp (bigint)
   *
   * @example
   * ```typescript
   * const endTime = await doppler.getEndingTime();
   * const endDate = new Date(Number(endTime) * 1000);
   * console.log('Strategy ends at:', endDate);
   * ```
   */
  public async getEndingTime(): Promise<bigint> {
    return this.doppler.read('endingTime');
  }

  /**
   * Gets the starting tick for the price range.
   *
   * In Uniswap V3, ticks represent price ranges in a logarithmic scale.
   * The starting tick defines the initial price boundary for the strategy.
   *
   * @returns Promise resolving to the starting tick as a number
   *
   * @example
   * ```typescript
   * const startTick = await doppler.getStartingTick();
   * console.log('Starting tick:', startTick);
   * ```
   */
  public async getStartingTick(): Promise<number> {
    return this.doppler.read('startingTick');
  }

  /**
   * Gets the ending tick for the price range.
   *
   * The ending tick defines the final price boundary for the strategy.
   *
   * @returns Promise resolving to the ending tick as a number
   *
   * @example
   * ```typescript
   * const endTick = await doppler.getEndingTick();
   * console.log('Ending tick:', endTick);
   * ```
   */
  public async getEndingTick(): Promise<number> {
    return this.doppler.read('endingTick');
  }

  /**
   * Gets the length of each epoch in the strategy.
   *
   * An epoch represents a time period in the Doppler strategy during which
   * certain parameters or behaviors may change.
   *
   * @returns Promise resolving to the epoch length in seconds as a bigint
   *
   * @example
   * ```typescript
   * const epochLength = await doppler.getEpochLength();
   * const epochHours = Number(epochLength) / 3600;
   * console.log('Epoch length:', epochHours, 'hours');
   * ```
   */
  public async getEpochLength(): Promise<bigint> {
    return this.doppler.read('epochLength');
  }

  /**
   * Gets the gamma parameter used in the strategy calculations.
   *
   * Gamma is a strategy parameter that affects the behavior of the
   * automated market making algorithm.
   *
   * @returns Promise resolving to the gamma parameter as a number
   *
   * @example
   * ```typescript
   * const gamma = await doppler.getGamma();
   * console.log('Gamma parameter:', gamma);
   * ```
   */
  public async getGamma(): Promise<number> {
    return this.doppler.read('gamma');
  }

  /**
   * Checks if the strategy is operating on token0.
   *
   * In Uniswap V3 pools, tokens are ordered as token0 and token1.
   * This indicates which token the strategy is primarily focused on.
   *
   * @returns Promise resolving to true if operating on token0, false for token1
   *
   * @example
   * ```typescript
   * const isToken0 = await doppler.getIsToken0();
   * console.log('Operating on token0:', isToken0);
   * ```
   */
  public async getIsToken0(): Promise<boolean> {
    return this.doppler.read('isToken0');
  }

  /**
   * Gets the number of PD (Price Discovery) slugs.
   *
   * PD slugs are components of the Doppler strategy related to
   * price discovery mechanisms.
   *
   * @returns Promise resolving to the number of PD slugs as a bigint
   *
   * @example
   * ```typescript
   * const numSlugs = await doppler.getNumPDSlugs();
   * console.log('Number of PD slugs:', numSlugs.toString());
   * ```
   */
  public async getNumPDSlugs(): Promise<bigint> {
    return this.doppler.read('numPDSlugs');
  }
}
