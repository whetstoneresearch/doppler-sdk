import type { Address, WalletClient } from 'viem';
import type {
  BeneficiaryData,
  DopplerSDKConfig,
  HookInfo,
  PoolInfo,
  SupportedPublicClient,
} from './common/types';
import type { SupportedChainId } from './common/addresses';
import { StaticAuction } from './static/StaticAuction';
import { DynamicAuction } from './dynamic/DynamicAuction';
import { MulticurvePool } from './multicurve/MulticurvePool';
import { StaticAuctionFactory } from './static/StaticAuctionFactory';
import { DynamicAuctionFactory } from './dynamic/DynamicAuctionFactory';
import { MulticurveFactory } from './multicurve/MulticurveFactory';
import { Quoter } from './entities/quoter';
import { Derc20 } from './entities/token';
import { StaticAuctionBuilder } from './static/StaticAuctionBuilder';
import { DynamicAuctionBuilder } from './dynamic/DynamicAuctionBuilder';
import { MulticurveBuilder } from './multicurve/MulticurveBuilder';
import {
  DEFAULT_AIRLOCK_BENEFICIARY_SHARES,
  getAirlockBeneficiary,
  getAirlockOwner as fetchAirlockOwner,
} from './common/utils/airlock';

export class DopplerSDK<C extends SupportedChainId = SupportedChainId> {
  private publicClient: SupportedPublicClient;
  private walletClient?: WalletClient;
  public chainId: C;
  private _staticFactory?: StaticAuctionFactory<C>;
  private _dynamicFactory?: DynamicAuctionFactory<C>;
  private _multicurveFactory?: MulticurveFactory<C>;
  private _quoter?: Quoter;

  constructor(config: DopplerSDKConfig) {
    this.publicClient = config.publicClient;
    this.walletClient = config.walletClient;
    this.chainId = config.chainId as unknown as C;
  }

  /**
   * Get the static auction factory for creating V3-style static auctions
   */
  get staticFactory(): StaticAuctionFactory<C> {
    if (!this._staticFactory) {
      this._staticFactory = new StaticAuctionFactory(
        this.publicClient,
        this.walletClient,
        this.chainId,
      );
    }
    return this._staticFactory;
  }

  /**
   * Get the dynamic auction factory for creating V4 Dutch auctions
   */
  get dynamicFactory(): DynamicAuctionFactory<C> {
    if (!this._dynamicFactory) {
      this._dynamicFactory = new DynamicAuctionFactory(
        this.publicClient,
        this.walletClient,
        this.chainId,
      );
    }
    return this._dynamicFactory;
  }

  /**
   * Get the multicurve factory for creating V4 multicurve auctions
   */
  get multicurveFactory(): MulticurveFactory<C> {
    if (!this._multicurveFactory) {
      this._multicurveFactory = new MulticurveFactory(
        this.publicClient,
        this.walletClient,
        this.chainId,
      );
    }
    return this._multicurveFactory;
  }

  /**
   * Get the quoter instance for price queries
   */
  get quoter(): Quoter {
    if (!this._quoter) {
      this._quoter = new Quoter(this.publicClient, this.chainId);
    }
    return this._quoter;
  }

  /**
   * Get a StaticAuction instance for interacting with a static auction pool
   * @param poolAddress The address of the Uniswap V3 pool
   */
  async getStaticAuction(poolAddress: Address): Promise<StaticAuction> {
    return new StaticAuction(this.publicClient, poolAddress);
  }

  /**
   * Get a DynamicAuction instance for interacting with a dynamic auction hook
   * @param hookAddress The address of the Uniswap V4 hook
   */
  async getDynamicAuction(hookAddress: Address): Promise<DynamicAuction> {
    return new DynamicAuction(this.publicClient, hookAddress);
  }

  /**
   * Get a MulticurvePool instance for interacting with a V4 multicurve pool
   * @param tokenAddress The address of the token created by the auction (called "asset" in contracts; V4 pools don't have addresses, so the token is used as the lookup key)
   */
  async getMulticurvePool(tokenAddress: Address): Promise<MulticurvePool> {
    return new MulticurvePool(
      this.publicClient,
      this.walletClient,
      tokenAddress,
    );
  }

  /**
   * Get a DERC20 token instance for interacting with a token
   * @param tokenAddress The address of the DERC20 token
   */
  getDerc20(tokenAddress: Address): Derc20 {
    return new Derc20(this.publicClient, this.walletClient, tokenAddress);
  }

  /**
   * Get information about a static auction pool
   * @param poolAddress The address of the pool
   */
  async getPoolInfo(poolAddress: Address): Promise<PoolInfo> {
    const auction = new StaticAuction(this.publicClient, poolAddress);
    return auction.getPoolInfo();
  }

  /**
   * Get information about a dynamic auction hook
   * @param hookAddress The address of the hook
   */
  async getHookInfo(hookAddress: Address): Promise<HookInfo> {
    const auction = new DynamicAuction(this.publicClient, hookAddress);
    return auction.getHookInfo();
  }

  /**
   * Create a new static auction builder
   */
  buildStaticAuction(): StaticAuctionBuilder<C> {
    return new StaticAuctionBuilder(this.chainId);
  }

  /**
   * Create a new dynamic auction builder
   */
  buildDynamicAuction(): DynamicAuctionBuilder<C> {
    return new DynamicAuctionBuilder(this.chainId);
  }

  /**
   * Create a new multicurve (V4 initializer) auction builder
   */
  buildMulticurveAuction(): MulticurveBuilder<C> {
    return new MulticurveBuilder(this.chainId);
  }

  /**
   * Get the current chain ID
   */
  getChainId(): C {
    return this.chainId;
  }

  /**
   * Get the underlying clients
   */
  getClients(): {
    publicClient: SupportedPublicClient;
    walletClient?: WalletClient;
  } {
    return {
      publicClient: this.publicClient,
      walletClient: this.walletClient,
    };
  }

  /**
   * Get the airlock owner address for the configured chain
   */
  async getAirlockOwner(): Promise<Address> {
    return fetchAirlockOwner(this.publicClient);
  }

  /**
   * Convenience helper for building the airlock beneficiary entry with the default 5% (0.05e18 WAD shares)
   */
  async getAirlockBeneficiary(
    shares: bigint = DEFAULT_AIRLOCK_BENEFICIARY_SHARES,
  ): Promise<BeneficiaryData> {
    return getAirlockBeneficiary(this.publicClient, shares);
  }
}
