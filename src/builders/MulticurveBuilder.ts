import type { Address } from 'viem'
import {
  DEFAULT_V3_YEARLY_MINT_RATE,
  FEE_TIERS,
  TICK_SPACINGS,
  WAD,
  ZERO_ADDRESS,
} from '../constants'
import {
  marketCapRangeToTicksForCurve,
  validateMarketCapParameters,
} from '../utils'
import {
  isNoOpEnabledChain,
  type CreateMulticurveParams,
  type GovernanceOption,
  type MigrationConfig,
  type VestingConfig,
  type TokenConfig,
  type MulticurveMarketCapCurvesConfig,
  type MulticurveMarketCapPreset,
  type ModuleAddressOverrides,
} from '../types'
import { type SupportedChainId } from '../addresses'
import {
  type BaseAuctionBuilder,
  type MarketCapPresetOverrides,
  buildCurvesFromPresets,
} from './shared'

export class MulticurveBuilder<C extends SupportedChainId>
  implements BaseAuctionBuilder<C> {
  private token?: TokenConfig
  private sale?: CreateMulticurveParams<C>['sale']
  private pool?: CreateMulticurveParams<C>['pool']
  private schedule?: CreateMulticurveParams<C>['schedule']
  private vesting?: VestingConfig
  private governance?: GovernanceOption<C>
  private migration?: MigrationConfig
  private integrator?: Address
  private userAddress?: Address
  private moduleAddresses?: ModuleAddressOverrides
  private gasLimit?: bigint
  public chainId: C

  constructor(chainId: C) {
    this.chainId = chainId
  }

  static forChain<C extends SupportedChainId>(chainId: C): MulticurveBuilder<C> {
    return new MulticurveBuilder(chainId)
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
        yearlyMintRate: params.yearlyMintRate ?? DEFAULT_V3_YEARLY_MINT_RATE,
      }
    }
    return this
  }

  saleConfig(params: { initialSupply: bigint; numTokensToSell: bigint; numeraire: Address }): this {
    this.sale = { initialSupply: params.initialSupply, numTokensToSell: params.numTokensToSell, numeraire: params.numeraire }
    return this
  }

  poolConfig(params: { fee: number; tickSpacing: number; curves: { tickLower: number; tickUpper: number; numPositions: number; shares: bigint }[]; beneficiaries?: { beneficiary: Address; shares: bigint }[] }): this {
    const sortedBeneficiaries = params.beneficiaries
      ? [...params.beneficiaries].sort((a, b) => {
          const aAddr = a.beneficiary.toLowerCase()
          const bAddr = b.beneficiary.toLowerCase()
          return aAddr < bAddr ? -1 : aAddr > bAddr ? 1 : 0
        })
      : undefined

    this.pool = { fee: params.fee, tickSpacing: params.tickSpacing, curves: params.curves, beneficiaries: sortedBeneficiaries }
    return this
  }

  withMarketCapPresets(params?: {
    fee?: number
    tickSpacing?: number
    presets?: MulticurveMarketCapPreset[]
    overrides?: MarketCapPresetOverrides
    beneficiaries?: { beneficiary: Address; shares: bigint }[]
  }): this {
    const { fee, tickSpacing, curves } = buildCurvesFromPresets({
      fee: params?.fee,
      tickSpacing: params?.tickSpacing,
      presets: params?.presets,
      overrides: params?.overrides,
    })

    return this.poolConfig({
      fee,
      tickSpacing,
      curves,
      beneficiaries: params?.beneficiaries,
    })
  }

  /**
   * Configure multicurve using market cap ranges (no tick math required).
   *
   * This is the recommended way to configure multicurve pools. Simply specify
   * market cap ranges in USD for each curve.
   *
   * Curves can be provided in any order - they will be automatically sorted
   * by market cap (ascending) before validation and processing. Curves must
   * be contiguous or overlapping (no gaps allowed).
   *
   * @param params - Market cap configuration with curves defined by market cap ranges
   * @returns Builder instance for chaining
   *
   * @example
   * ```ts
   * builder
   *   .saleConfig({ initialSupply, numTokensToSell, numeraire: WETH })
   *   .withCurves({
   *     numerairePrice: 3000, // ETH = $3000
   *     curves: [
   *       { marketCap: { start: 500_000, end: 1_000_000 }, numPositions: 10, shares: parseEther('0.3') },
   *       { marketCap: { start: 1_000_000, end: 5_000_000 }, numPositions: 20, shares: parseEther('0.5') },
   *       { marketCap: { start: 5_000_000, end: 50_000_000 }, numPositions: 10, shares: parseEther('0.2') },
   *     ],
   *   })
   * ```
   */
  withCurves(params: MulticurveMarketCapCurvesConfig): this {
    // Validate required config
    if (!this.sale?.numeraire) {
      throw new Error('Must call saleConfig() before withCurves()')
    }

    // Validate numerairePrice
    if (params.numerairePrice <= 0) {
      throw new Error('numerairePrice must be greater than 0')
    }

    // Validate curves array
    if (!params.curves || params.curves.length === 0) {
      throw new Error('curves array must contain at least one curve')
    }

    // Validate each curve
    for (let i = 0; i < params.curves.length; i++) {
      const curve = params.curves[i]
      this.validateCurveRange(
        curve.marketCap.start,
        curve.marketCap.end,
        curve.numPositions,
        curve.shares,
        `curves[${i}]`
      )
    }

    // Sort curves by market cap (start, then end) for deterministic ordering
    const sortedCurves = this.sortCurvesByMarketCap(params.curves)

    // Validate curve contiguity (no gaps allowed, overlaps OK)
    this.validateCurveContiguity(sortedCurves)

    // Validate total shares sum to exactly WAD
    const totalShares = sortedCurves.reduce((sum, c) => sum + c.shares, 0n)
    if (totalShares !== WAD) {
      throw new Error(
        `Total curve shares must equal 100% (${WAD}). Got ${totalShares} (${Number(totalShares * 10000n / WAD) / 100}%)`
      )
    }

    // Get token supply
    const tokenSupply = params.tokenSupply ?? this.sale.initialSupply
    if (!tokenSupply) {
      throw new Error(
        'tokenSupply must be provided (either via saleConfig() or withCurves() params)'
      )
    }

    // Get fee and tick spacing
    const fee = params.fee ?? FEE_TIERS.LOW
    const tickSpacing = params.tickSpacing ??
      (TICK_SPACINGS as Record<number, number>)[fee]

    if (tickSpacing === undefined) {
      throw new Error('tickSpacing must be provided when using a custom fee tier')
    }

    const numeraire = this.sale.numeraire

    // Validate first curve market caps (the launch price)
    const firstCurve = sortedCurves[0]
    const startValidation = validateMarketCapParameters(
      firstCurve.marketCap.start,
      tokenSupply,
      params.tokenDecimals
    )
    const endValidation = validateMarketCapParameters(
      firstCurve.marketCap.end,
      tokenSupply,
      params.tokenDecimals
    )
    const allWarnings = [...startValidation.warnings, ...endValidation.warnings]
    if (allWarnings.length > 0) {
      console.warn('First curve market cap validation warnings:')
      allWarnings.forEach(w => console.warn(`  - ${w}`))
    }

    // Convert all curves to ticks
    const curves: { tickLower: number; tickUpper: number; numPositions: number; shares: bigint }[] = []

    for (const curve of sortedCurves) {
      const curveTicks = marketCapRangeToTicksForCurve(
        curve.marketCap.start,
        curve.marketCap.end,
        tokenSupply,
        params.numerairePrice,
        params.tokenDecimals ?? 18,
        params.numeraireDecimals ?? 18,
        tickSpacing,
        numeraire
      )

      curves.push({
        tickLower: curveTicks.tickLower,
        tickUpper: curveTicks.tickUpper,
        numPositions: curve.numPositions,
        shares: curve.shares,
      })
    }

    // Delegate to existing poolConfig method
    return this.poolConfig({
      fee,
      tickSpacing,
      curves,
      beneficiaries: params.beneficiaries,
    })
  }

  /**
   * Sort curves by market cap (start, then end) for deterministic ordering
   */
  private sortCurvesByMarketCap<T extends { marketCap: { start: number; end: number } }>(
    curves: T[]
  ): T[] {
    return [...curves].sort((a, b) => {
      const startDiff = a.marketCap.start - b.marketCap.start
      if (startDiff !== 0) return startDiff
      return a.marketCap.end - b.marketCap.end
    })
  }

  /**
   * Validate a single curve's parameters
   */
  private validateCurveRange(
    startMarketCap: number,
    endMarketCap: number,
    numPositions: number,
    shares: bigint,
    label: string
  ): void {
    if (startMarketCap <= 0) {
      throw new Error(`${label}: marketCap.start must be greater than 0`)
    }
    if (endMarketCap <= 0) {
      throw new Error(`${label}: marketCap.end must be greater than 0`)
    }
    if (startMarketCap >= endMarketCap) {
      throw new Error(
        `${label}: startMarketCap ($${startMarketCap.toLocaleString()}) must be less than endMarketCap ($${endMarketCap.toLocaleString()})`
      )
    }
    if (numPositions <= 0) {
      throw new Error(`${label}: numPositions must be greater than 0`)
    }
    if (shares <= 0n) {
      throw new Error(`${label}: shares must be greater than 0`)
    }
  }

  /**
   * Validate that curves are contiguous or overlapping (no gaps allowed).
   * Expects curves to be pre-sorted by market cap.
   */
  private validateCurveContiguity(
    sortedCurves: { marketCap: { start: number; end: number } }[]
  ): void {
    if (sortedCurves.length <= 1) {
      return
    }

    for (let i = 1; i < sortedCurves.length; i++) {
      const prevCurve = sortedCurves[i - 1]
      const currCurve = sortedCurves[i]

      if (currCurve.marketCap.start > prevCurve.marketCap.end) {
        throw new Error(
          `Gap detected between market cap ranges: ` +
          `$${prevCurve.marketCap.start.toLocaleString()}-$${prevCurve.marketCap.end.toLocaleString()} ` +
          `and $${currCurve.marketCap.start.toLocaleString()}-$${currCurve.marketCap.end.toLocaleString()}. ` +
          `Curves must be contiguous or overlapping.`
        )
      }
    }
  }

  withVesting(params?: { duration?: bigint; cliffDuration?: number; recipients?: Address[]; amounts?: bigint[] }): this {
    if (!params) { this.vesting = undefined; return this }
    this.vesting = { duration: Number(params.duration ?? 0n), cliffDuration: params.cliffDuration ?? 0, recipients: params.recipients, amounts: params.amounts }
    return this
  }

  withSchedule(params?: { startTime: number | bigint | Date }): this {
    if (!params) {
      this.schedule = undefined
      return this
    }

    let startTimeSeconds: number
    const { startTime } = params

    if (startTime instanceof Date) {
      startTimeSeconds = Math.floor(startTime.getTime() / 1000)
    } else if (typeof startTime === 'bigint') {
      startTimeSeconds = Number(startTime)
    } else {
      startTimeSeconds = Number(startTime)
    }

    if (!Number.isFinite(startTimeSeconds) || !Number.isInteger(startTimeSeconds)) {
      throw new Error('Schedule startTime must be an integer number of seconds since Unix epoch')
    }

    if (startTimeSeconds < 0) {
      throw new Error('Schedule startTime cannot be negative')
    }

    const UINT32_MAX = 0xffffffff
    if (startTimeSeconds > UINT32_MAX) {
      throw new Error('Schedule startTime must fit within uint32 (seconds since Unix epoch up to year 2106)')
    }

    this.schedule = { startTime: startTimeSeconds }
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

  private overrideModule<K extends keyof ModuleAddressOverrides>(key: K, address: NonNullable<ModuleAddressOverrides[K]>): this {
    this.moduleAddresses = { ...(this.moduleAddresses ?? {}), [key]: address } as ModuleAddressOverrides
    return this
  }

  withTokenFactory(address: Address): this { return this.overrideModule('tokenFactory', address) }
  withAirlock(address: Address): this { return this.overrideModule('airlock', address) }
  withV4MulticurveInitializer(address: Address): this { return this.overrideModule('v4MulticurveInitializer', address) }
  withV4ScheduledMulticurveInitializer(address: Address): this { return this.overrideModule('v4ScheduledMulticurveInitializer', address) }
  withGovernanceFactory(address: Address): this { return this.overrideModule('governanceFactory', address) }
  withV2Migrator(address: Address): this { return this.overrideModule('v2Migrator', address) }

  withV4Migrator(address: Address): this { return this.overrideModule('v4Migrator', address) }
  withNoOpMigrator(address: Address): this { return this.overrideModule('noOpMigrator', address) }

  build(): CreateMulticurveParams<C> {
    if (!this.token) throw new Error('tokenConfig is required')
    if (!this.sale) throw new Error('saleConfig is required')
    if (!this.pool) throw new Error('poolConfig is required')
    if (!this.migration) throw new Error('migration configuration is required')
    if (!this.userAddress) throw new Error('userAddress is required')

    // Default governance: noOp on supported chains, default on others (e.g., Ink)
    const governance = this.governance ?? (
      isNoOpEnabledChain(this.chainId)
        ? { type: 'noOp' as const }
        : { type: 'default' as const }
    )

    return {
      token: this.token,
      sale: this.sale,
      pool: this.pool,
      schedule: this.schedule,
      vesting: this.vesting,
      governance: governance as GovernanceOption<C>,
      migration: this.migration,
      integrator: this.integrator ?? ZERO_ADDRESS,
      userAddress: this.userAddress,
      modules: this.moduleAddresses,
      gas: this.gasLimit,
    }
  }
}
