import type { Address } from 'viem';
import {
  BASIS_POINTS,
  DEFAULT_AUCTION_DURATION,
  DEFAULT_EPOCH_LENGTH,
  DEFAULT_PD_SLUGS,
  DEFAULT_V4_YEARLY_MINT_RATE,
  DOPPLER_MAX_TICK_SPACING,
  FEE_TIERS,
  V4_MAX_FEE,
  ZERO_ADDRESS,
} from '../constants';
import { computeOptimalGamma, isToken0Expected } from '../utils';
import {
  isLaunchpadEnabledChain,
  isNoOpEnabledChain,
  type GovernanceOption,
  type MigrationConfig,
  type ModuleAddressOverrides,
  type TokenConfig,
  type VestingConfig,
} from '../types';
import { type SupportedChainId } from '../addresses';
import { type BaseAuctionBuilder } from './shared';

export interface OpeningAuctionConfig {
  auctionDuration: number;
  minAcceptableTickToken0: number;
  minAcceptableTickToken1: number;
  incentiveShareBps: number;
  tickSpacing: number;
  fee: number;
  minLiquidity: bigint;
  shareToAuctionBps: number;
}

export interface OpeningAuctionDopplerConfig {
  minProceeds: bigint;
  maxProceeds: bigint;
  startTick: number;
  endTick: number;
  epochLength?: number;
  duration?: number;
  gamma?: number;
  numPdSlugs?: number;
  fee?: number;
  tickSpacing?: number;
}

export interface ResolvedOpeningAuctionDopplerConfig {
  minProceeds: bigint;
  maxProceeds: bigint;
  startTick: number;
  endTick: number;
  epochLength: number;
  duration: number;
  gamma: number;
  numPdSlugs?: number;
  fee: number;
  tickSpacing: number;
}

export type OpeningAuctionModuleAddressOverrides = ModuleAddressOverrides & {
  openingAuctionInitializer?: Address;
  openingAuctionPositionManager?: Address;
};

export interface CreateOpeningAuctionParams<
  C extends SupportedChainId = SupportedChainId,
> {
  token: TokenConfig;
  sale: {
    initialSupply: bigint;
    numTokensToSell: bigint;
    numeraire: Address;
  };
  openingAuction: OpeningAuctionConfig;
  doppler: ResolvedOpeningAuctionDopplerConfig;
  vesting?: VestingConfig;
  governance: GovernanceOption<C>;
  migration: MigrationConfig;
  integrator?: Address;
  userAddress: Address;
  startTimeOffset?: number;
  startingTime?: number;
  blockTimestamp?: number;
  modules?: OpeningAuctionModuleAddressOverrides;
  gas?: bigint;
}

export class OpeningAuctionBuilder<
  C extends SupportedChainId,
> implements BaseAuctionBuilder<C> {
  private token?: TokenConfig;
  private sale?: CreateOpeningAuctionParams<C>['sale'];
  private openingAuction?: OpeningAuctionConfig;
  private doppler?: OpeningAuctionDopplerConfig;
  private vesting?: VestingConfig;
  private governance?: GovernanceOption<C>;
  private migration?: MigrationConfig;
  private integrator?: Address;
  private userAddress?: Address;
  private startTimeOffset?: number;
  private startingTime?: number;
  private blockTimestamp?: number;
  private moduleAddresses?: OpeningAuctionModuleAddressOverrides;
  private gasLimit?: bigint;
  public chainId: C;

  constructor(chainId: C) {
    this.chainId = chainId;
  }

  static forChain<C extends SupportedChainId>(
    chainId: C,
  ): OpeningAuctionBuilder<C> {
    return new OpeningAuctionBuilder(chainId);
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
        yearlyMintRate: params.yearlyMintRate ?? DEFAULT_V4_YEARLY_MINT_RATE,
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

  openingAuctionConfig(params: OpeningAuctionConfig): this {
    this.openingAuction = { ...params };
    return this;
  }

  dopplerConfig(params: OpeningAuctionDopplerConfig): this {
    this.doppler = { ...params };
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
      duration: Number(params.duration ?? 0n),
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

  withTime(params?: {
    startTimeOffset?: number;
    startingTime?: number | bigint | Date;
    blockTimestamp?: number;
  }): this {
    if (!params) {
      this.startTimeOffset = undefined;
      this.startingTime = undefined;
      this.blockTimestamp = undefined;
      return this;
    }

    const hasStartTimeOffset = params.startTimeOffset !== undefined;
    const hasStartingTime = params.startingTime !== undefined;
    if (hasStartTimeOffset && hasStartingTime) {
      throw new Error(
        'withTime() accepts either startTimeOffset or startingTime, not both',
      );
    }

    if (hasStartTimeOffset) {
      const startTimeOffset = Number(params.startTimeOffset);
      if (
        !Number.isFinite(startTimeOffset) ||
        !Number.isInteger(startTimeOffset) ||
        startTimeOffset < 0
      ) {
        throw new Error('startTimeOffset must be a non-negative integer');
      }
      this.startTimeOffset = startTimeOffset;
      this.startingTime = undefined;
    } else if (hasStartingTime) {
      const startingTimeSeconds = this.normalizeTimestamp(
        params.startingTime!,
      );
      this.startingTime = startingTimeSeconds;
      this.startTimeOffset = undefined;
    } else {
      this.startTimeOffset = undefined;
      this.startingTime = undefined;
    }

    if (params.blockTimestamp !== undefined) {
      const blockTimestamp = Number(params.blockTimestamp);
      if (
        !Number.isFinite(blockTimestamp) ||
        !Number.isInteger(blockTimestamp) ||
        blockTimestamp < 0
      ) {
        throw new Error('blockTimestamp must be a non-negative integer');
      }
      this.blockTimestamp = blockTimestamp;
    } else {
      this.blockTimestamp = undefined;
    }

    return this;
  }

  private normalizeTimestamp(value: number | bigint | Date): number {
    let seconds: number;
    if (value instanceof Date) {
      seconds = Math.floor(value.getTime() / 1000);
    } else if (typeof value === 'bigint') {
      seconds = Number(value);
    } else {
      seconds = Number(value);
    }

    if (!Number.isFinite(seconds) || !Number.isInteger(seconds)) {
      throw new Error(
        'startingTime must be an integer number of seconds since Unix epoch',
      );
    }
    if (seconds < 0) {
      throw new Error('startingTime cannot be negative');
    }

    const UINT32_MAX = 0xffffffff;
    if (seconds > UINT32_MAX) {
      throw new Error(
        'startingTime must fit within uint32 (seconds since Unix epoch up to year 2106)',
      );
    }

    return seconds;
  }

  private overrideModule<K extends keyof OpeningAuctionModuleAddressOverrides>(
    key: K,
    address: NonNullable<OpeningAuctionModuleAddressOverrides[K]>,
  ): this {
    this.moduleAddresses = {
      ...this.moduleAddresses,
      [key]: address,
    };
    return this;
  }

  withTokenFactory(address: Address): this {
    return this.overrideModule('tokenFactory', address);
  }

  withAirlock(address: Address): this {
    return this.overrideModule('airlock', address);
  }

  withPoolManager(address: Address): this {
    return this.overrideModule('poolManager', address);
  }

  withDopplerDeployer(address: Address): this {
    return this.overrideModule('dopplerDeployer', address);
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

  withOpeningAuctionInitializer(address: Address): this {
    return this.overrideModule('openingAuctionInitializer', address);
  }

  withOpeningAuctionPositionManager(address: Address): this {
    return this.overrideModule('openingAuctionPositionManager', address);
  }

  private validatePositiveInteger(value: number, label: string): void {
    if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
      throw new Error(`${label} must be a positive integer`);
    }
  }

  build(): CreateOpeningAuctionParams<C> {
    if (!this.token) throw new Error('tokenConfig is required');
    if (!this.sale) throw new Error('saleConfig is required');
    if (!this.openingAuction)
      throw new Error('openingAuctionConfig is required');
    if (!this.doppler) throw new Error('dopplerConfig is required');
    if (!this.migration) throw new Error('migration configuration is required');
    if (!this.userAddress) throw new Error('userAddress is required');

    if (!this.token.name || this.token.name.trim().length === 0) {
      throw new Error('Token name is required');
    }
    if (!this.token.symbol || this.token.symbol.trim().length === 0) {
      throw new Error('Token symbol is required');
    }

    if (this.sale.initialSupply <= 0n) {
      throw new Error('Initial supply must be positive');
    }
    if (this.sale.numTokensToSell <= 0n) {
      throw new Error('Number of tokens to sell must be positive');
    }
    if (this.sale.numTokensToSell > this.sale.initialSupply) {
      throw new Error('Cannot sell more tokens than initial supply');
    }

    this.validatePositiveInteger(
      this.openingAuction.auctionDuration,
      'openingAuction.auctionDuration',
    );
    this.validatePositiveInteger(
      this.openingAuction.tickSpacing,
      'openingAuction.tickSpacing',
    );
    if (
      !Number.isInteger(this.openingAuction.fee) ||
      this.openingAuction.fee < 0 ||
      this.openingAuction.fee > V4_MAX_FEE
    ) {
      throw new Error(
        `openingAuction.fee must be an integer between 0 and ${V4_MAX_FEE}`,
      );
    }
    if (
      !Number.isInteger(this.openingAuction.shareToAuctionBps) ||
      this.openingAuction.shareToAuctionBps <= 0 ||
      this.openingAuction.shareToAuctionBps > BASIS_POINTS
    ) {
      throw new Error(
        `openingAuction.shareToAuctionBps must be in (0, ${BASIS_POINTS}]`,
      );
    }
    if (
      !Number.isInteger(this.openingAuction.incentiveShareBps) ||
      this.openingAuction.incentiveShareBps < 0 ||
      this.openingAuction.incentiveShareBps > BASIS_POINTS
    ) {
      throw new Error(
        `openingAuction.incentiveShareBps must be between 0 and ${BASIS_POINTS}`,
      );
    }
    if (this.openingAuction.minLiquidity <= 0n) {
      throw new Error('openingAuction.minLiquidity must be positive');
    }

    const duration = this.doppler.duration ?? DEFAULT_AUCTION_DURATION;
    const epochLength = this.doppler.epochLength ?? DEFAULT_EPOCH_LENGTH;
    const fee = this.doppler.fee ?? FEE_TIERS.HIGH;
    const tickSpacing = this.doppler.tickSpacing ?? DOPPLER_MAX_TICK_SPACING;

    this.validatePositiveInteger(duration, 'doppler.duration');
    this.validatePositiveInteger(epochLength, 'doppler.epochLength');
    this.validatePositiveInteger(tickSpacing, 'doppler.tickSpacing');

    if (tickSpacing > DOPPLER_MAX_TICK_SPACING) {
      throw new Error(
        `doppler.tickSpacing must be <= ${DOPPLER_MAX_TICK_SPACING}. Got ${tickSpacing}.`,
      );
    }
    if (duration % epochLength !== 0) {
      throw new Error(
        'doppler.epochLength must divide doppler.duration evenly',
      );
    }
    if (!Number.isInteger(fee) || fee < 0 || fee > V4_MAX_FEE) {
      throw new Error(`doppler.fee must be an integer between 0 and ${V4_MAX_FEE}`);
    }

    if (this.doppler.minProceeds < 0n) {
      throw new Error('doppler.minProceeds must be non-negative');
    }
    if (this.doppler.maxProceeds < this.doppler.minProceeds) {
      throw new Error(
        'doppler.maxProceeds must be greater than or equal to doppler.minProceeds',
      );
    }

    if (this.openingAuction.tickSpacing % tickSpacing !== 0) {
      throw new Error(
        `openingAuction.tickSpacing (${this.openingAuction.tickSpacing}) must be divisible by doppler.tickSpacing (${tickSpacing})`,
      );
    }

    const isToken0 = isToken0Expected(this.sale.numeraire);
    if (isToken0 && this.doppler.startTick < this.doppler.endTick) {
      throw new Error(
        'doppler.startTick must be greater than or equal to doppler.endTick when token is expected to be currency0',
      );
    }
    if (!isToken0 && this.doppler.startTick > this.doppler.endTick) {
      throw new Error(
        'doppler.startTick must be less than or equal to doppler.endTick when token is expected to be currency1',
      );
    }

    let gamma = this.doppler.gamma;
    if (gamma !== undefined) {
      this.validatePositiveInteger(gamma, 'doppler.gamma');
      if (gamma % tickSpacing !== 0) {
        throw new Error('doppler.gamma must be divisible by doppler.tickSpacing');
      }
    } else {
      gamma = computeOptimalGamma(
        this.doppler.startTick,
        this.doppler.endTick,
        duration,
        epochLength,
        tickSpacing,
      );
    }

    const auctionTokens =
      (this.sale.numTokensToSell * BigInt(this.openingAuction.shareToAuctionBps)) /
      BigInt(BASIS_POINTS);
    if (auctionTokens <= 0n) {
      throw new Error(
        'openingAuction.shareToAuctionBps yields zero auction tokens for the configured sale',
      );
    }

    // Default governance: noOp on supported chains, default on others (e.g., Ink)
    const governance =
      this.governance ??
      (isNoOpEnabledChain(this.chainId)
        ? { type: 'noOp' as const }
        : { type: 'default' as const });

    if (
      governance.type === 'launchpad' &&
      !isLaunchpadEnabledChain(this.chainId)
    ) {
      throw new Error(
        `Launchpad governance is not supported on chain ${this.chainId}. Use a supported chain or a different governance type.`,
      );
    }

    return {
      token: this.token,
      sale: this.sale,
      openingAuction: this.openingAuction,
      doppler: {
        minProceeds: this.doppler.minProceeds,
        maxProceeds: this.doppler.maxProceeds,
        startTick: this.doppler.startTick,
        endTick: this.doppler.endTick,
        epochLength,
        duration,
        gamma,
        numPdSlugs: this.doppler.numPdSlugs ?? DEFAULT_PD_SLUGS,
        fee,
        tickSpacing,
      },
      vesting: this.vesting,
      governance: governance as GovernanceOption<C>,
      migration: this.migration,
      integrator: this.integrator ?? ZERO_ADDRESS,
      userAddress: this.userAddress,
      startTimeOffset: this.startTimeOffset,
      startingTime: this.startingTime,
      blockTimestamp: this.blockTimestamp,
      modules: this.moduleAddresses,
      gas: this.gasLimit,
    };
  }
}
