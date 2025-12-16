import type { Address } from 'viem'
import {
  DEFAULT_AUCTION_DURATION,
  DEFAULT_EPOCH_LENGTH,
  DEFAULT_V4_YEARLY_MINT_RATE,
  ZERO_ADDRESS,
} from '../constants'
import {
  computeOptimalGamma,
  marketCapRangeToTicks,
  transformTicksForAuction,
  validateMarketCapParameters,
} from '../utils'
import {
  isNoOpEnabledChain,
  type CreateDynamicAuctionParams,
  type GovernanceOption,
  type MigrationConfig,
  type PriceRange,
  type VestingConfig,
  type TokenConfig,
  type DynamicAuctionMarketCapConfig,
  type ModuleAddressOverrides,
} from '../types'
import { type SupportedChainId } from '../addresses'
import { computeTicks, type BaseAuctionBuilder } from './shared'

export class DynamicAuctionBuilder<C extends SupportedChainId>
  implements BaseAuctionBuilder<C> {
  private token?: TokenConfig
  private sale?: CreateDynamicAuctionParams<C>['sale']
  private auction?: CreateDynamicAuctionParams<C>['auction']
  private pool?: CreateDynamicAuctionParams<C>['pool']
  private vesting?: VestingConfig
  private governance?: GovernanceOption<C>
  private migration?: MigrationConfig
  private integrator?: Address
  private userAddress?: Address
  private startTimeOffset?: number
  private blockTimestamp?: number
  private moduleAddresses?: ModuleAddressOverrides
  private gasLimit?: bigint
  public chainId: C

  constructor(chainId: C) {
    this.chainId = chainId
  }

  static forChain<C extends SupportedChainId>(chainId: C): DynamicAuctionBuilder<C> {
    return new DynamicAuctionBuilder(chainId)
  }

  tokenConfig(
    params:
      | { type?: 'standard'; name: string; symbol: string; tokenURI: string; yearlyMintRate?: bigint }
      | { type: 'doppler404'; name: string; symbol: string; baseURI: string; unit?: bigint }
  ): this {
    if (params && 'type' in params && params.type === 'doppler404') {
      this.token = {
        type: 'doppler404',
        name: params.name,
        symbol: params.symbol,
        baseURI: params.baseURI,
        unit: params.unit,
      }
    } else {
      this.token = {
        type: 'standard',
        name: params.name,
        symbol: params.symbol,
        tokenURI: params.tokenURI,
        yearlyMintRate: params.yearlyMintRate ?? DEFAULT_V4_YEARLY_MINT_RATE,
      }
    }
    return this
  }

  saleConfig(params: {
    initialSupply: bigint
    numTokensToSell: bigint
    numeraire?: Address
  }): this {
    this.sale = {
      initialSupply: params.initialSupply,
      numTokensToSell: params.numTokensToSell,
      numeraire: params.numeraire ?? ZERO_ADDRESS,
    }
    return this
  }

  poolConfig(params: { fee: number; tickSpacing: number }): this {
    this.pool = { fee: params.fee, tickSpacing: params.tickSpacing }
    return this
  }

  // Provide ticks directly
  auctionByTicks(params: {
    startTick: number
    endTick: number
    minProceeds: bigint
    maxProceeds: bigint
    duration?: number
    epochLength?: number
    gamma?: number
    numPdSlugs?: number
  }): this {
    const duration = params.duration ?? DEFAULT_AUCTION_DURATION
    const epochLength = params.epochLength ?? DEFAULT_EPOCH_LENGTH
    const gamma =
      params.gamma ?? (this.pool ? computeOptimalGamma(params.startTick, params.endTick, duration, epochLength, this.pool.tickSpacing) : undefined)
    this.auction = {
      duration,
      epochLength,
      startTick: params.startTick,
      endTick: params.endTick,
      gamma,
      minProceeds: params.minProceeds,
      maxProceeds: params.maxProceeds,
      numPdSlugs: params.numPdSlugs,
    }
    return this
  }

  /**
   * @deprecated Use withMarketCapRange() instead for more intuitive market cap configuration
   */
  auctionByPriceRange(params: {
    priceRange: PriceRange
    minProceeds: bigint
    maxProceeds: bigint
    duration?: number
    epochLength?: number
    gamma?: number
    tickSpacing?: number // optional; will use pool.tickSpacing if not provided
    numPdSlugs?: number
  }): this {
    const tickSpacing = params.tickSpacing ?? this.pool?.tickSpacing
    if (!tickSpacing) {
      throw new Error('tickSpacing is required (set poolConfig first or pass tickSpacing)')
    }
    const ticks = computeTicks(params.priceRange, tickSpacing)
    return this.auctionByTicks({
      startTick: ticks.startTick,
      endTick: ticks.endTick,
      minProceeds: params.minProceeds,
      maxProceeds: params.maxProceeds,
      duration: params.duration,
      epochLength: params.epochLength,
      gamma: params.gamma,
      numPdSlugs: params.numPdSlugs,
    })
  }

  /**
   * Configure auction using target market cap range.
   * Converts market cap values (in USD) to Uniswap ticks.
   *
   * @param params - Market cap configuration with auction parameters
   * @returns Builder instance for chaining
   *
   * @example
   * ```ts
   * builder
   *   .saleConfig({ initialSupply, numTokensToSell, numeraire: WETH })
   *   .poolConfig({ fee: 3000, tickSpacing: 60 })
   *   .withMarketCapRange({
   *     marketCap: { start: 500_000, min: 50_000 }, // $500k start, $50k floor
   *     numerairePrice: 3000, // ETH = $3000
   *     minProceeds: parseEther('10'),
   *     maxProceeds: parseEther('1000'),
   *   })
   * ```
   */
  withMarketCapRange(params: DynamicAuctionMarketCapConfig): this {
    // Validate required config
    if (!this.sale?.numeraire) {
      throw new Error('Must call saleConfig() before withMarketCapRange()')
    }

    // Get token supply
    const tokenSupply = params.tokenSupply ?? this.sale.initialSupply
    if (!tokenSupply) {
      throw new Error(
        'tokenSupply must be provided (either via saleConfig() or withMarketCapRange() params)'
      )
    }

    // Get tick spacing
    const tickSpacing = this.pool?.tickSpacing
    if (!tickSpacing) {
      throw new Error(
        'tickSpacing is required (set via poolConfig() before calling withMarketCapRange())'
      )
    }

    // Validate market cap parameters
    const startValidation = validateMarketCapParameters(
      params.marketCap.start,
      tokenSupply,
      params.tokenDecimals
    )
    const minValidation = validateMarketCapParameters(
      params.marketCap.min,
      tokenSupply,
      params.tokenDecimals
    )

    const allWarnings = [...startValidation.warnings, ...minValidation.warnings]
    if (allWarnings.length > 0) {
      console.warn('Market cap validation warnings:')
      allWarnings.forEach(w => console.warn(`  - ${w}`))
    }

    // Convert market cap range to ticks and transform for auction contract
    // Pass min as start, start as end (ascending order for validation)
    // Dutch auction price semantics are handled by the contract, not tick ordering
    const { startTick: rawStartTick, endTick: rawEndTick } = marketCapRangeToTicks(
      { start: params.marketCap.min, end: params.marketCap.start },
      tokenSupply,
      params.numerairePrice,
      params.tokenDecimals ?? 18,
      params.numeraireDecimals ?? 18,
      tickSpacing,
      this.sale.numeraire
    )

    const { startTick, endTick } = transformTicksForAuction(
      rawStartTick,
      rawEndTick,
      this.sale.numeraire
    )

    // Delegate to existing auctionByTicks method
    return this.auctionByTicks({
      startTick,
      endTick,
      minProceeds: params.minProceeds,
      maxProceeds: params.maxProceeds,
      duration: params.duration,
      epochLength: params.epochLength,
      gamma: params.gamma,
      numPdSlugs: params.numPdSlugs,
    })
  }

  withVesting(params?: { duration?: bigint; cliffDuration?: number; recipients?: Address[]; amounts?: bigint[] }): this {
    if (!params) {
      this.vesting = undefined
      return this
    }
    this.vesting = {
      duration: Number(params.duration ?? 0n),
      cliffDuration: params.cliffDuration ?? 0,
      recipients: params.recipients,
      amounts: params.amounts,
    }
    return this
  }

  withGovernance(params: GovernanceOption<C>): this {
    this.governance = params
    return this
  }

  withMigration(migration: MigrationConfig): this {
    this.migration = migration
    return this
  }

  withUserAddress(address: Address): this {
    this.userAddress = address
    return this
  }

  withIntegrator(address?: Address): this {
    this.integrator = address ?? ZERO_ADDRESS
    return this
  }

  withGasLimit(gas?: bigint): this {
    this.gasLimit = gas
    return this
  }

  withTime(params?: { startTimeOffset?: number; blockTimestamp?: number }): this {
    if (!params) {
      this.startTimeOffset = undefined
      this.blockTimestamp = undefined
      return this
    }
    this.startTimeOffset = params.startTimeOffset
    this.blockTimestamp = params.blockTimestamp
    return this
  }

  // Address override helpers
  private overrideModule<K extends keyof ModuleAddressOverrides>(key: K, address: NonNullable<ModuleAddressOverrides[K]>): this {
    this.moduleAddresses = {
      ...(this.moduleAddresses ?? {}),
      [key]: address,
    } as ModuleAddressOverrides
    return this
  }

  withTokenFactory(address: Address): this {
    return this.overrideModule('tokenFactory', address)
  }

  withAirlock(address: Address): this {
    return this.overrideModule('airlock', address)
  }

  withV4Initializer(address: Address): this {
    return this.overrideModule('v4Initializer', address)
  }

  withPoolManager(address: Address): this {
    return this.overrideModule('poolManager', address)
  }

  withDopplerDeployer(address: Address): this {
    return this.overrideModule('dopplerDeployer', address)
  }

  withGovernanceFactory(address: Address): this {
    return this.overrideModule('governanceFactory', address)
  }

  withV2Migrator(address: Address): this {
    return this.overrideModule('v2Migrator', address)
  }

  withV3Migrator(address: Address): this {
    return this.overrideModule('v3Migrator', address)
  }

  withV4Migrator(address: Address): this {
    return this.overrideModule('v4Migrator', address)
  }

  withNoOpMigrator(address: Address): this {
    return this.overrideModule('noOpMigrator', address)
  }

  build(): CreateDynamicAuctionParams<C> {
    if (!this.token) throw new Error('tokenConfig is required')
    if (!this.sale) throw new Error('saleConfig is required')
    if (!this.pool) throw new Error('poolConfig is required')
    if (!this.auction) throw new Error('auction configuration is required')
    if (!this.migration) throw new Error('migration configuration is required')
    if (!this.userAddress) throw new Error('userAddress is required')

    // Default governance: noOp on supported chains, default on others (e.g., Ink)
    const governance = this.governance ?? (
      isNoOpEnabledChain(this.chainId)
        ? { type: 'noOp' as const }
        : { type: 'default' as const }
    )

    // Ensure gamma is set and valid
    let { gamma } = this.auction
    if (gamma === undefined) {
      gamma = computeOptimalGamma(
        this.auction.startTick,
        this.auction.endTick,
        this.auction.duration,
        this.auction.epochLength,
        this.pool.tickSpacing,
      )
    }

    const auction = { ...this.auction, gamma }

    return {
      token: this.token,
      sale: this.sale,
      auction,
      pool: this.pool,
      vesting: this.vesting,
      governance: governance as GovernanceOption<C>,
      migration: this.migration,
      integrator: this.integrator ?? ZERO_ADDRESS,
      userAddress: this.userAddress,
      startTimeOffset: this.startTimeOffset,
      blockTimestamp: this.blockTimestamp,
      modules: this.moduleAddresses,
      gas: this.gasLimit,
    }
  }
}
