import { ReadContract, ReadAdapter, Drift, createDrift } from '@delvtech/drift';
import { Address } from 'viem';
import { airlockAbi } from '@/abis';
import { AssetData } from '@/types';
export type AirlockABI = typeof airlockAbi;

/**
 * Enum representing the different states a module can have in the Doppler factory system
 */
export enum ModuleState {
  /** Module is not whitelisted and cannot be used */
  NotWhitelisted = 0,
  /** Module is configured as a token factory */
  TokenFactory = 1,
  /** Module is configured as a governance factory */
  GovernanceFactory = 2,
  /** Module is configured as a hook factory */
  HookFactory = 3,
  /** Module is configured as a migrator */
  Migrator = 4,
}

/**
 * ReadFactory provides read-only operations for the Doppler V4 airlock contract.
 *
 * This is the base class that handles queries and data retrieval from deployed
 * Doppler pools and their associated contracts. It provides access to:
 * - Module state information
 * - Asset deployment data
 * - Pool configuration details
 *
 * Key features:
 * - Query module whitelisting status
 * - Retrieve comprehensive asset data for deployed tokens
 * - Read-only operations with automatic error handling
 * - Built on Drift for type-safe contract interactions
 *
 * @example
 * ```typescript
 * import { ReadFactory, ModuleState } from '@doppler/v4-sdk';
 *
 * const factory = new ReadFactory(airlockAddress);
 *
 * // Check if a module is whitelisted
 * const state = await factory.getModuleState(moduleAddress);
 * if (state === ModuleState.TokenFactory) {
 *   console.log('Module is a valid token factory');
 * }
 *
 * // Get complete asset information
 * const assetData = await factory.getAssetData(tokenAddress);
 * console.log('Pool address:', assetData.pool);
 * ```
 */
export class ReadFactory {
  /** The airlock contract instance for read operations */
  airlock: ReadContract<AirlockABI>;

  /**
   * Creates a new ReadFactory instance for read-only operations
   *
   * @param address - The address of the airlock contract
   * @param drift - Optional Drift instance with read adapter (creates default if not provided)
   *
   * @example
   * ```typescript
   * // Using default drift instance
   * const factory = new ReadFactory(airlockAddress);
   *
   * // Using custom drift instance
   * const customDrift = createDrift({ adapter: customAdapter });
   * const factory = new ReadFactory(airlockAddress, customDrift);
   * ```
   */
  constructor(address: Address, drift: Drift<ReadAdapter> = createDrift()) {
    this.airlock = drift.contract({
      abi: airlockAbi,
      address,
    });
  }

  /**
   * Retrieves the current state/type of a module in the Doppler system
   *
   * Modules in Doppler serve different roles (token factory, governance factory, etc.)
   * and must be whitelisted before they can be used in pool creation.
   *
   * @param module - The address of the module to check
   * @returns Promise resolving to the module's current state
   *
   * @example
   * ```typescript
   * const state = await factory.getModuleState('0x123...');
   *
   * switch (state) {
   *   case ModuleState.NotWhitelisted:
   *     console.log('Module is not approved for use');
   *     break;
   *   case ModuleState.TokenFactory:
   *     console.log('Module can create tokens');
   *     break;
   *   case ModuleState.GovernanceFactory:
   *     console.log('Module can create governance contracts');
   *     break;
   *   // ... other cases
   * }
   * ```
   */
  async getModuleState(module: Address): Promise<ModuleState> {
    return this.airlock.read('getModuleState', {
      module,
    });
  }

  /**
   * Retrieves comprehensive deployment data for a Doppler asset
   *
   * This method returns all the key contract addresses and configuration
   * associated with a deployed Doppler token, including:
   * - Numeraire (quote token) used for pricing
   * - Timelock and governance contracts
   * - Liquidity migrator for post-discovery trading
   * - Pool initializer and pool addresses
   * - Sale data (tokens for sale)
   * - Integrator address
   *
   * @param asset - The address of the deployed asset token
   * @returns Promise resolving to complete asset deployment data
   *
   * @example
   * ```typescript
   * const assetData = await factory.getAssetData(tokenAddress);
   *
   * console.log('Asset details:', {
   *   numeraire: assetData.numeraire,
   *   governance: assetData.governance,
   *   pool: assetData.pool,
   *   migrationPool: assetData.migrationPool,
   *   totalSupply: assetData.totalSupply.toString(),
   *   tokensForSale: assetData.numTokensToSell.toString(),
   *   integrator: assetData.integrator
   * });
   * ```
   */
  async getAssetData(asset: Address): Promise<AssetData> {
    return this.airlock.read('getAssetData', {
      asset,
    });
  }

  /**
   * Retrieves the owner address of the airlock contract
   *
   * @returns Promise resolving to the owner address
   *
   * @example
   * ```typescript
   * const ownerAddress = await factory.owner();
   * console.log('Airlock owner:', ownerAddress);
   * ```
   */
  async owner(): Promise<Address> {
    return this.airlock.read('owner');
  }
}
