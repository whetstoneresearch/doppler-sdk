import { type Address, zeroAddress, type PublicClient } from 'viem';
import { SupportedPublicClient } from '../../../types';

/**
 * Read-only access to the client's native currency information and balances.
 *
 * @remarks
 * This class implements a consistent interface with other token implementations (like DERC20)
 * but handles native currency behavior such as:
 * - Reading chain metadata (falling back to Ether for clients without a chain)
 * - Simulating unlimited allowance for native transfers
 * - Querying native balances through viem
 */
export class Eth {
  private publicClient: SupportedPublicClient;
  private get rpc(): PublicClient {
    return this.publicClient as PublicClient;
  }

  /** Static native currency address identifier (zero address) */
  static readonly address = zeroAddress;

  constructor(publicClient: SupportedPublicClient) {
    this.publicClient = publicClient;
  }

  /**
   * Get the human-readable name of the token
   * @returns Promise resolving to the chain's native currency name
   */
  async getName(): Promise<string> {
    return this.rpc.chain?.nativeCurrency.name ?? 'Ether';
  }

  /**
   * Get the ticker symbol of the token
   * @returns Promise resolving to the chain's native currency symbol
   */
  async getSymbol(): Promise<string> {
    return this.rpc.chain?.nativeCurrency.symbol ?? 'ETH';
  }

  /**
   * Get the number of decimal places used by the token
   * @returns Promise resolving to the chain's native currency decimals
   */
  async getDecimals(): Promise<number> {
    return this.rpc.chain?.nativeCurrency.decimals ?? 18;
  }

  /**
   * Get the allowance granted to a spender (always returns maximum value)
   * @returns Promise resolving to 2^256 - 1 (simulates unlimited native allowance)
   *
   * @remarks
   * Native currency doesn't have an allowance mechanism, so this returns max uint256 value
   * to represent unlimited approval in systems expecting ERC20-like interfaces
   */
  async getAllowance(): Promise<bigint> {
    return 2n ** 256n - 1n;
  }

  /**
   * Get the native balance of a specified account
   * @param account - Address of the account to query
   * @returns Promise resolving to the account's balance in native base units
   */
  async getBalanceOf(account: Address): Promise<bigint> {
    return await this.rpc.getBalance({
      address: account,
    });
  }
}
