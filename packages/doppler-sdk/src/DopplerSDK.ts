import type { Address, WalletClient } from 'viem'
import type { DopplerSDKConfig, HookInfo, PoolInfo, SupportedPublicClient } from './types'
import { DopplerFactory } from './entities/DopplerFactory'
import { StaticAuction, DynamicAuction } from './entities/auction'
import { Quoter } from './entities/quoter'

export class DopplerSDK {
  private publicClient: SupportedPublicClient
  private walletClient?: WalletClient
  private chainId: number
  private _factory?: DopplerFactory
  private _quoter?: Quoter

  constructor(config: DopplerSDKConfig) {
    this.publicClient = config.publicClient
    this.walletClient = config.walletClient
    this.chainId = config.chainId
  }

  /**
   * Get the factory instance for creating auctions
   */
  get factory(): DopplerFactory {
    if (!this._factory) {
      this._factory = new DopplerFactory(this.publicClient, this.walletClient, this.chainId)
    }
    return this._factory
  }

  /**
   * Get the quoter instance for price queries
   */
  get quoter(): Quoter {
    if (!this._quoter) {
      this._quoter = new Quoter(this.publicClient, this.chainId)
    }
    return this._quoter
  }

  /**
   * Get a StaticAuction instance for interacting with a static auction pool
   * @param poolAddress The address of the Uniswap V3 pool
   */
  async getStaticAuction(poolAddress: Address): Promise<StaticAuction> {
    return new StaticAuction(this.publicClient, poolAddress)
  }

  /**
   * Get a DynamicAuction instance for interacting with a dynamic auction hook
   * @param hookAddress The address of the Uniswap V4 hook
   */
  async getDynamicAuction(hookAddress: Address): Promise<DynamicAuction> {
    return new DynamicAuction(this.publicClient, hookAddress)
  }

  /**
   * Get information about a static auction pool
   * @param poolAddress The address of the pool
   */
  async getPoolInfo(poolAddress: Address): Promise<PoolInfo> {
    const auction = new StaticAuction(this.publicClient, poolAddress)
    return auction.getPoolInfo()
  }

  /**
   * Get information about a dynamic auction hook
   * @param hookAddress The address of the hook
   */
  async getHookInfo(hookAddress: Address): Promise<HookInfo> {
    const auction = new DynamicAuction(this.publicClient, hookAddress)
    return auction.getHookInfo()
  }

  /**
   * Get the current chain ID
   */
  getChainId(): number {
    return this.chainId
  }

  /**
   * Get the underlying clients
   */
  getClients(): { publicClient: SupportedPublicClient; walletClient?: WalletClient } {
    return {
      publicClient: this.publicClient,
      walletClient: this.walletClient
    }
  }
}