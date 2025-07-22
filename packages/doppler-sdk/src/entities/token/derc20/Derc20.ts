import { type Address, type PublicClient, type WalletClient } from 'viem'
import { derc20Abi } from '../../../abis'

/**
 * A class providing read and write access to a DERC20 token contract.
 * Enables querying standard ERC20 token properties along with custom vesting
 * and minting-related state information.
 */
export class Derc20 {
  private publicClient: PublicClient
  private walletClient?: WalletClient
  private address: Address
  
  constructor(publicClient: PublicClient, walletClient: WalletClient | undefined, address: Address) {
    this.publicClient = publicClient
    this.walletClient = walletClient
    this.address = address
  }
  
  /** Get the human-readable name of the token */
  async getName(): Promise<string> {
    return await this.publicClient.readContract({
      address: this.address,
      abi: derc20Abi,
      functionName: 'name',
    })
  }
  
  /** Get the symbol/ticker of the token */
  async getSymbol(): Promise<string> {
    return await this.publicClient.readContract({
      address: this.address,
      abi: derc20Abi,
      functionName: 'symbol',
    })
  }
  
  /** Get the number of decimals used for token divisions */
  async getDecimals(): Promise<number> {
    return await this.publicClient.readContract({
      address: this.address,
      abi: derc20Abi,
      functionName: 'decimals',
    })
  }
  
  /** Get the token URI for the token */
  async getTokenURI(): Promise<string> {
    return await this.publicClient.readContract({
      address: this.address,
      abi: derc20Abi,
      functionName: 'tokenURI',
    })
  }
  
  /**
   * Get the allowance granted by an owner to a spender
   * @param owner - The address that granted the allowance
   * @param spender - The address that can spend the tokens
   */
  async getAllowance(owner: Address, spender: Address): Promise<bigint> {
    return await this.publicClient.readContract({
      address: this.address,
      abi: derc20Abi,
      functionName: 'allowance',
      args: [owner, spender],
    })
  }
  
  /**
   * Get the token balance of a specific account
   * @param account - Address to check balance for
   */
  async getBalanceOf(account: Address): Promise<bigint> {
    return await this.publicClient.readContract({
      address: this.address,
      abi: derc20Abi,
      functionName: 'balanceOf',
      args: [account],
    })
  }
  
  /** Get the total supply of tokens in circulation */
  async getTotalSupply(): Promise<bigint> {
    return await this.publicClient.readContract({
      address: this.address,
      abi: derc20Abi,
      functionName: 'totalSupply',
    })
  }
  
  /** Get the duration (in seconds) of the vesting period */
  async getVestingDuration(): Promise<bigint> {
    return await this.publicClient.readContract({
      address: this.address,
      abi: derc20Abi,
      functionName: 'vestingDuration',
    })
  }
  
  /** Get the timestamp when vesting begins */
  async getVestingStart(): Promise<bigint> {
    return await this.publicClient.readContract({
      address: this.address,
      abi: derc20Abi,
      functionName: 'vestingStart',
    })
  }
  
  /** Get the total amount of tokens allocated for vesting */
  async getVestedTotalAmount(): Promise<bigint> {
    return await this.publicClient.readContract({
      address: this.address,
      abi: derc20Abi,
      functionName: 'vestedTotalAmount',
    })
  }
  
  /** Get the amount of vested tokens available for a specific address */
  async getAvailableVestedAmount(account: Address): Promise<bigint> {
    return await this.publicClient.readContract({
      address: this.address,
      abi: derc20Abi,
      functionName: 'computeAvailableVestedAmount',
      args: [account],
    })
  }
  
  /** Get the current annual mint rate in tokens per year */
  async getYearlyMintRate(): Promise<bigint> {
    return await this.publicClient.readContract({
      address: this.address,
      abi: derc20Abi,
      functionName: 'yearlyMintRate',
    })
  }
  
  /** Get the pool address for the token */
  async getPool(): Promise<Address> {
    return await this.publicClient.readContract({
      address: this.address,
      abi: derc20Abi,
      functionName: 'pool',
    })
  }
  
  /** Check if the liquidity pool is unlocked */
  async getIsPoolUnlocked(): Promise<boolean> {
    return await this.publicClient.readContract({
      address: this.address,
      abi: derc20Abi,
      functionName: 'isPoolUnlocked',
    })
  }
  
  /** Get the timestamp when token minting begins */
  async getCurrentYearStart(): Promise<bigint> {
    return await this.publicClient.readContract({
      address: this.address,
      abi: derc20Abi,
      functionName: 'currentYearStart',
    })
  }
  
  /** Get the timestamp of the last mint */
  async getLastMintTimestamp(): Promise<bigint> {
    return await this.publicClient.readContract({
      address: this.address,
      abi: derc20Abi,
      functionName: 'lastMintTimestamp',
    })
  }
  
  /**
   * Get detailed vesting information for a specific account
   * @param account - Address to retrieve vesting data for
   * @returns Object containing totalAmount and releasedAmount
   */
  async getVestingData(account: Address): Promise<{
    totalAmount: bigint
    releasedAmount: bigint
  }> {
    const result = await this.publicClient.readContract({
      address: this.address,
      abi: derc20Abi,
      functionName: 'getVestingDataOf',
      args: [account],
    })
    
    return {
      totalAmount: result[0],
      releasedAmount: result[1],
    }
  }
  
  // Write methods (require wallet client)
  
  /**
   * Approve a spender to transfer tokens on behalf of the owner
   * @param spender - Address that will be able to spend the tokens
   * @param value - Amount of tokens to approve
   * @returns Transaction hash
   */
  async approve(spender: Address, value: bigint): Promise<`0x${string}`> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations')
    }
    
    const { request } = await this.publicClient.simulateContract({
      address: this.address,
      abi: derc20Abi,
      functionName: 'approve',
      args: [spender, value],
      account: this.walletClient.account,
    })
    
    return await this.walletClient.writeContract(request)
  }
  
  /**
   * Release vested tokens to the caller
   * @param amount - Amount of vested tokens to release
   * @returns Transaction hash
   */
  async release(amount: bigint): Promise<`0x${string}`> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations')
    }
    
    const { request } = await this.publicClient.simulateContract({
      address: this.address,
      abi: derc20Abi,
      functionName: 'release',
      args: [amount],
      account: this.walletClient.account,
    })
    
    return await this.walletClient.writeContract(request)
  }
}