import type { Address } from 'viem';
import { TICK_SPACINGS, ZERO_ADDRESS } from '../common/constants';
import {
  DEFAULT_V3_END_TICK,
  DEFAULT_V3_FEE,
  DEFAULT_V3_MAX_SHARE_TO_BE_SOLD,
  DEFAULT_V3_NUM_POSITIONS,
  DEFAULT_V3_START_TICK,
  DEFAULT_V3_VESTING_DURATION,
  DEFAULT_V3_YEARLY_MINT_RATE,
  V3_FEE_TIERS,
} from '../static/constants';
import {
  marketCapToTicksForStaticAuction,
  validateMarketCapParameters,
} from '../static/utils/marketCapHelpers';
import { isNoOpEnabledChain } from '../common/types';
import type {
  GovernanceOption,
  MigrationConfig,
  PriceRange,
  VestingConfig,
  TokenConfig,
  ModuleAddressOverrides,
} from '../common/types';
import type {
  CreateStaticAuctionParams,
  StaticAuctionMarketCapConfig,
} from '../static/types';
import type { SupportedChainId } from '../common/addresses';
import { computeTicks, type BaseAuctionBuilder } from './shared';

export class StaticAuctionBuilder<
  C extends SupportedChainId,
> implements BaseAuctionBuilder<C> {
  private token?: TokenConfig;
  private sale?: CreateStaticAuctionParams<C>['sale'];
  private pool?: CreateStaticAuctionParams<C>['pool'];
  private beneficiaries?: { beneficiary: Address; shares: bigint }[];
  private vesting?: VestingConfig;
  private governance?: GovernanceOption<C>;
  private migration?: MigrationConfig;
  private integrator?: Address;
  private userAddress?: Address;
  private moduleAddresses?: ModuleAddressOverrides;
  private gasLimit?: bigint;
  // Deferred market cap config - converted to pool in build()
  private marketCapConfig?: {
    marketCap: { start: number; end: number };
    numerairePrice: number;
    tokenSupply?: bigint;
    tokenDecimals?: number;
    numeraireDecimals?: number;
    fee?: number;
    numPositions?: number;
    maxShareToBeSold?: bigint;
  };
  public chainId: C;

  constructor(chainId: C) {
    this.chainId = chainId;
  }

  static forChain<C extends SupportedChainId>(
    chainId: C,
  ): StaticAuctionBuilder<C> {
    return new StaticAuctionBuilder(chainId);
  }

  tokenConfig(
    params:
      | {
          type?: 'standard';
          name: string;
          symbol: string;
          tokenURI: string;
          yearlyMintRate?: bigint;
        }
      | {
          type: 'doppler404';
          name: string;
          symbol: string;
          baseURI: string;
          unit?: bigint;
        },
  ): this {
    if (params && 'type' in params && params.type === 'doppler404') {
      this.token = {
        type: 'doppler404',
        name: params.name,
        symbol: params.symbol,
        baseURI: params.baseURI,
        unit: params.unit,
      };
    } else {
      this.token = {
        type: 'standard',
        name: params.name,
        symbol: params.symbol,
        tokenURI: params.tokenURI,
        yearlyMintRate: params.yearlyMintRate ?? DEFAULT_V3_YEARLY_MINT_RATE,
      };
    }
    return this;
  }

  saleConfig(params: {
    initialSupply: bigint;
    numTokensToSell: bigint;
    numeraire: Address;
  }): this {
    this.sale = {
      initialSupply: params.initialSupply,
      numTokensToSell: params.numTokensToSell,
      numeraire: params.numeraire,
    };
    return this;
  }

  /**
   * Provide pool ticks directly.
   *
   * Note: Static Auctions use Uniswap V3, which only supports 4 fee tiers:
   * 100 (0.01%), 500 (0.05%), 3000 (0.3%), 10000 (1%).
   * For custom fees, use Dynamic or Multicurve auctions (V4).
   */
  poolByTicks(params: {
    startTick?: number;
    endTick?: number;
    fee?: number;
    numPositions?: number;
    maxShareToBeSold?: bigint;
  }): this {
    // Mutual exclusion: cannot use poolByTicks() after withMarketCapRange()
    if (this.marketCapConfig) {
      throw new Error(
        'Cannot use poolByTicks() after withMarketCapRange(). ' +
          'Use withMarketCapRange() for market cap-based configuration, ' +
          'or poolByTicks()/poolByPriceRange() for manual tick configuration.',
      );
    }

    const fee = params.fee ?? DEFAULT_V3_FEE;

    // Validate fee is a V3-supported tier
    if (!(V3_FEE_TIERS as readonly number[]).includes(fee)) {
      throw new Error(
        `Static auctions (Uniswap V3) require standard fee tiers: ${V3_FEE_TIERS.join(', ')}. ` +
          `Got: ${fee}. For custom fees, use Dynamic or Multicurve auctions (Uniswap V4).`,
      );
    }

    const startTick = params.startTick ?? DEFAULT_V3_START_TICK;
    const endTick = params.endTick ?? DEFAULT_V3_END_TICK;
    this.pool = {
      startTick,
      endTick,
      fee,
      numPositions: params.numPositions ?? DEFAULT_V3_NUM_POSITIONS,
      maxShareToBeSold:
        params.maxShareToBeSold ?? DEFAULT_V3_MAX_SHARE_TO_BE_SOLD,
    };
    return this;
  }

  /**
   * @deprecated Use withMarketCapRange() instead for more intuitive market cap configuration
   */
  poolByPriceRange(params: {
    priceRange: PriceRange;
    fee?: number;
    numPositions?: number;
    maxShareToBeSold?: bigint;
  }): this {
    // Mutual exclusion: cannot use poolByPriceRange() after withMarketCapRange()
    if (this.marketCapConfig) {
      throw new Error(
        'Cannot use poolByPriceRange() after withMarketCapRange(). ' +
          'Use withMarketCapRange() for market cap-based configuration, ' +
          'or poolByTicks()/poolByPriceRange() for manual tick configuration.',
      );
    }

    const fee = params.fee ?? DEFAULT_V3_FEE;
    const tickSpacing =
      fee === 100
        ? TICK_SPACINGS[100]
        : fee === 500
          ? TICK_SPACINGS[500]
          : fee === 3000
            ? TICK_SPACINGS[3000]
            : TICK_SPACINGS[10000];
    const ticks = computeTicks(params.priceRange, tickSpacing);
    return this.poolByTicks({
      startTick: ticks.startTick,
      endTick: ticks.endTick,
      fee,
      numPositions: params.numPositions,
      maxShareToBeSold: params.maxShareToBeSold,
    });
  }

  /**
   * Configure pool using target market cap range.
   * Converts market cap values (in USD) to Uniswap ticks.
   *
   * @param params - Market cap configuration
   * @returns Builder instance for chaining
   *
   * @example
   * ```ts
   * builder
   *   .saleConfig({ initialSupply, numTokensToSell, numeraire: WETH })
   *   .withMarketCapRange({
   *     marketCap: { start: 100_000, end: 10_000_000 }, // $100k to $10M
   *     numerairePrice: 3000, // ETH = $3000
   *   })
   * ```
   */
  withMarketCapRange(params: StaticAuctionMarketCapConfig): this {
    // Mutual exclusion: cannot use withMarketCapRange() after poolByTicks()/poolByPriceRange()
    if (this.pool) {
      throw new Error(
        'Cannot use withMarketCapRange() after poolByTicks()/poolByPriceRange(). ' +
          'Use withMarketCapRange() for market cap-based configuration, ' +
          'or poolByTicks()/poolByPriceRange() for manual tick configuration.',
      );
    }

    // Basic validation that doesn't require saleConfig
    if (params.numerairePrice <= 0) {
      throw new Error('numerairePrice must be greater than 0');
    }
    if (params.marketCap.start <= 0 || params.marketCap.end <= 0) {
      throw new Error('marketCap values must be greater than 0');
    }
    if (params.marketCap.start >= params.marketCap.end) {
      throw new Error('marketCap.start must be less than marketCap.end');
    }

    // Validate fee is a V3-supported tier (if provided)
    if (params.fee !== undefined) {
      if (!(V3_FEE_TIERS as readonly number[]).includes(params.fee)) {
        throw new Error(
          `Static auctions (Uniswap V3) require standard fee tiers: ${V3_FEE_TIERS.join(', ')}. ` +
            `Got: ${params.fee}. For custom fees, use Dynamic or Multicurve auctions (Uniswap V4).`,
        );
      }
    }

    // Store config for deferred conversion in build()
    this.marketCapConfig = {
      marketCap: params.marketCap,
      numerairePrice: params.numerairePrice,
      tokenSupply: params.tokenSupply,
      tokenDecimals: params.tokenDecimals,
      numeraireDecimals: params.numeraireDecimals,
      fee: params.fee,
      numPositions: params.numPositions,
      maxShareToBeSold: params.maxShareToBeSold,
    };

    return this;
  }

  /**
   * Configure beneficiaries for fee streaming on locked V3 pools.
   *
   * When beneficiaries are provided, the pool enters a "Locked" state where:
   * - Fees are collected and distributed to beneficiaries according to their shares
   * - Liquidity cannot be exited/migrated (pool stays locked permanently)
   * - Anyone can call collectFees() to distribute accumulated fees
   *
   * IMPORTANT:
   * - Shares must sum to exactly WAD (1e18 = 100%)
   * - Protocol owner (Airlock.owner()) must be included with at least 5% shares
   * - Beneficiaries will be automatically sorted by address (ascending)
   * - Use withMigration({ type: 'noOp' }) when using beneficiaries
   *
   * @example
   * ```typescript
   * builder.withBeneficiaries([
   *   { beneficiary: protocolOwner, shares: parseEther('0.05') },  // 5% (minimum required)
   *   { beneficiary: teamWallet, shares: parseEther('0.45') },     // 45%
   *   { beneficiary: daoTreasury, shares: parseEther('0.50') },    // 50%
   * ])
   * ```
   */
  withBeneficiaries(
    beneficiaries: { beneficiary: Address; shares: bigint }[],
  ): this {
    // Sort beneficiaries by address (ascending) as required by the contract
    this.beneficiaries = [...beneficiaries].sort((a, b) => {
      const aAddr = a.beneficiary.toLowerCase();
      const bAddr = b.beneficiary.toLowerCase();
      return aAddr < bAddr ? -1 : aAddr > bAddr ? 1 : 0;
    });
    return this;
  }

  withVesting(params?: {
    duration?: bigint;
    cliffDuration?: number;
    recipients?: Address[];
    amounts?: bigint[];
  }): this {
    if (!params) {
      this.vesting = undefined;
      return this;
    }
    this.vesting = {
      duration: Number(params.duration ?? DEFAULT_V3_VESTING_DURATION),
      cliffDuration: params.cliffDuration ?? 0,
      recipients: params.recipients,
      amounts: params.amounts,
    };
    return this;
  }

  withGovernance(params: GovernanceOption<C>): this {
    this.governance = params;
    return this;
  }

  withMigration(migration: MigrationConfig): this {
    this.migration = migration;
    return this;
  }

  withUserAddress(address: Address): this {
    this.userAddress = address;
    return this;
  }

  withIntegrator(address?: Address): this {
    this.integrator = address ?? ZERO_ADDRESS;
    return this;
  }

  withGasLimit(gas?: bigint): this {
    this.gasLimit = gas;
    return this;
  }

  // Address override helpers
  private overrideModule<K extends keyof ModuleAddressOverrides>(
    key: K,
    address: NonNullable<ModuleAddressOverrides[K]>,
  ): this {
    this.moduleAddresses = {
      ...this.moduleAddresses,
      [key]: address,
    } as ModuleAddressOverrides;
    return this;
  }

  withTokenFactory(address: Address): this {
    return this.overrideModule('tokenFactory', address);
  }

  withAirlock(address: Address): this {
    return this.overrideModule('airlock', address);
  }

  withV3Initializer(address: Address): this {
    return this.overrideModule('v3Initializer', address);
  }

  withGovernanceFactory(address: Address): this {
    return this.overrideModule('governanceFactory', address);
  }

  withV2Migrator(address: Address): this {
    return this.overrideModule('v2Migrator', address);
  }

  withV4Migrator(address: Address): this {
    return this.overrideModule('v4Migrator', address);
  }

  withNoOpMigrator(address: Address): this {
    return this.overrideModule('noOpMigrator', address);
  }

  build(): CreateStaticAuctionParams<C> {
    if (!this.token) throw new Error('tokenConfig is required');
    if (!this.sale) throw new Error('saleConfig is required');
    if (!this.migration) throw new Error('migration configuration is required');
    if (!this.userAddress) throw new Error('userAddress is required');

    // Convert deferred market cap config to pool if set
    if (this.marketCapConfig && !this.pool) {
      const config = this.marketCapConfig;

      // Get token supply from config or saleConfig
      const tokenSupply = config.tokenSupply ?? this.sale.initialSupply;
      if (!tokenSupply) {
        throw new Error(
          'tokenSupply must be provided (either via saleConfig() or withMarketCapRange() params)',
        );
      }

      // Determine fee and tick spacing
      const fee = config.fee ?? DEFAULT_V3_FEE;
      const tickSpacing =
        fee === 100
          ? TICK_SPACINGS[100]
          : fee === 500
            ? TICK_SPACINGS[500]
            : fee === 3000
              ? TICK_SPACINGS[3000]
              : TICK_SPACINGS[10000];

      // Validate market cap parameters
      const startValidation = validateMarketCapParameters(
        config.marketCap.start,
        tokenSupply,
        config.tokenDecimals,
      );
      const endValidation = validateMarketCapParameters(
        config.marketCap.end,
        tokenSupply,
        config.tokenDecimals,
      );

      // Log warnings if any
      const allWarnings = [
        ...startValidation.warnings,
        ...endValidation.warnings,
      ];
      if (allWarnings.length > 0) {
        console.warn('Market cap validation warnings:');
        allWarnings.forEach((w) => console.warn(`  - ${w}`));
      }

      // Convert market cap range to ticks for V3 Static auction
      const { startTick, endTick } = marketCapToTicksForStaticAuction({
        marketCapRange: config.marketCap,
        tokenSupply,
        numerairePriceUSD: config.numerairePrice,
        tickSpacing,
        tokenDecimals: config.tokenDecimals ?? 18,
        numeraireDecimals: config.numeraireDecimals ?? 18,
      });

      // Set pool config
      this.pool = {
        startTick,
        endTick,
        fee,
        numPositions: config.numPositions ?? DEFAULT_V3_NUM_POSITIONS,
        maxShareToBeSold:
          config.maxShareToBeSold ?? DEFAULT_V3_MAX_SHARE_TO_BE_SOLD,
      };
    }

    if (!this.pool) throw new Error('pool configuration is required');

    // Default governance: noOp on supported chains, default on others (e.g., Ink)
    const governance =
      this.governance ??
      (isNoOpEnabledChain(this.chainId)
        ? { type: 'noOp' as const }
        : { type: 'default' as const });

    // Merge beneficiaries into pool config if provided
    const poolWithBeneficiaries = this.beneficiaries
      ? { ...this.pool, beneficiaries: this.beneficiaries }
      : this.pool;

    // Validate noOp migration requires beneficiaries
    // NoOpMigrator is designed for locked pools with beneficiaries. Without beneficiaries,
    // the pool status is "Initialized" (not "Locked"), meaning exitLiquidity() can be called.
    // But NoOpMigrator.migrate() always reverts, so the entire graduation transaction fails
    // and liquidity becomes trapped.
    if (this.migration.type === 'noOp') {
      const hasBeneficiaries =
        poolWithBeneficiaries.beneficiaries &&
        poolWithBeneficiaries.beneficiaries.length > 0;
      if (!hasBeneficiaries) {
        throw new Error(
          'noOp migration requires beneficiaries. Without beneficiaries, the pool would be stuck after reaching ' +
            'graduation - exitLiquidity() succeeds but NoOpMigrator.migrate() always reverts, causing the entire ' +
            'transaction to fail. Either add beneficiaries via withBeneficiaries() or use a different migration type (uniswapV2, uniswapV4).',
        );
      }
    }

    return {
      token: this.token,
      sale: this.sale,
      pool: poolWithBeneficiaries,
      vesting: this.vesting,
      governance: governance as GovernanceOption<C>,
      migration: this.migration,
      integrator: this.integrator ?? ZERO_ADDRESS,
      userAddress: this.userAddress,
      modules: this.moduleAddresses,
      gas: this.gasLimit,
    };
  }
}
