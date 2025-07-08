import {
  ReadWriteContract,
  ReadWriteAdapter,
  Drift,
  TransactionOptions,
  FunctionReturn,
} from '@delvtech/drift';
import {
  Address,
  encodeAbiParameters,
  encodePacked,
  getAddress,
  Hash,
  Hex,
  keccak256,
  zeroAddress,
} from 'viem';
import { ReadFactory, AirlockABI } from './ReadFactory';
import { CreateParams } from './types';
import { DERC20Bytecode, DopplerBytecode } from '@/abis';
import { DAY_SECONDS, DEFAULT_PD_SLUGS, DEAD_ADDRESS, WAD } from '@/constants';
import { DopplerData, TokenFactoryData } from './types';
import { DopplerPreDeploymentConfig, DopplerV4Addresses, PriceRange, TickRange, V4MigratorData, BeneficiaryData } from '@/types';

const DEFAULT_INITIAL_VOTING_DELAY = 7200;
const DEFAULT_INITIAL_VOTING_PERIOD = 50400;
const DEFAULT_INITIAL_PROPOSAL_THRESHOLD = BigInt(0);

const FLAG_MASK = BigInt(0x3fff);
const flags = BigInt(
  (1 << 13) | // BEFORE_INITIALIZE_FLAG
    (1 << 12) | // AFTER_INITIALIZE_FLAG
    (1 << 11) | // BEFORE_ADD_LIQUIDITY_FLAG
    (1 << 7) | // BEFORE_SWAP_FLAG
    (1 << 6) | // AFTER_SWAP_FLAG
    (1 << 5) // BEFORE_DONATE_FLAG
);

/**
 * ReadWriteFactory provides read and write operations for the Doppler V4 airlock contract (we use the Factory naming convention for clarity).
 * Extends ReadFactory with additional capabilities for creating pools and migrating assets.
 *
 * Key features:
 * - Create new Doppler pools with tokens, hooks, and governance
 * - Mine optimal hook addresses with required flags
 * - Migrate liquidity from existing assets
 * - Build complete configuration parameters for pool deployment
 * - Automatic gamma calculation for optimal price discovery
 * - Parameter validation and error handling
 *
 * @example
 * ```typescript
 * const factory = new ReadWriteFactory(airlockAddress, drift);
 *
 * const { createParams, hook, token } = factory.buildConfig({
 *   name: "MyToken",
 *   symbol: "MTK",
 *   totalSupply: parseEther("1000000"),
 *   // ... other parameters
 * }, addresses);
 *
 * const simulation = await factory.simulateCreate(createParams);
 * const txHash = await factory.create(createParams);
 * ```
 */
export class ReadWriteFactory extends ReadFactory {
  declare airlock: ReadWriteContract<AirlockABI>;

  /**
   * Creates a new ReadWriteFactory instance
   * @param address - The address of the factory contract
   * @param drift - A Drift instance with read-write adapter capabilities
   */
  constructor(address: Address, drift: Drift<ReadWriteAdapter>) {
    super(address, drift);
  }

  /**
   * Computes the CREATE2 address for a contract deployment
   * @param salt - The salt used for deployment
   * @param initCodeHash - Hash of the initialization code
   * @param deployer - Address of the deploying contract
   * @returns The computed contract address
   * @private
   */
  private computeCreate2Address(
    salt: Hash,
    initCodeHash: Hash,
    deployer: Address
  ): Address {
    const encoded = encodePacked(
      ['bytes1', 'address', 'bytes32', 'bytes32'],
      ['0xff', deployer, salt, initCodeHash]
    );
    return getAddress(`0x${keccak256(encoded).slice(-40)}`);
  }

  /**
   * Validates basic parameters for pool deployment
   * @param params - The deployment configuration to validate
   * @throws {Error} When validation fails
   * @private
   */
  private validateBasicParams(params: DopplerPreDeploymentConfig) {
    if (!params.name || !params.symbol) {
      throw new Error('Name and symbol are required');
    }
    if (params.totalSupply <= 0) {
      throw new Error('Total supply must be positive');
    }
    if (params.numTokensToSell <= 0) {
      throw new Error('Number of tokens to sell must be positive');
    }
    if (params.tickRange) {
      if (params.tickRange.startTick >= params.tickRange.endTick) {
        throw new Error('Invalid tick range');
      }
    }
    if (params.duration <= 0) {
      throw new Error('Duration must be positive');
    }
    if (params.epochLength <= 0) {
      throw new Error('Epoch length must be positive');
    }
    if (params.tickSpacing <= 0) {
      throw new Error('Tick spacing must be positive');
    }
  }

  /**
   * Computes optimal gamma parameter based on price range and time parameters
   * Gamma determines how much the price can move per epoch during the sale.
   *
   * @param startTick - Starting tick of the price range
   * @param endTick - Ending tick of the price range
   * @param durationDays - Duration of the sale in days
   * @param epochLength - Length of each epoch in seconds
   * @param tickSpacing - Tick spacing for the pool
   * @returns The optimal gamma value
   * @throws {Error} If computed gamma is not divisible by tick spacing
   * @private
   */
  private computeOptimalGamma(
    startTick: number,
    endTick: number,
    durationDays: number,
    epochLength: number,
    tickSpacing: number
  ): number {
    // Calculate total number of epochs
    const totalEpochs = (durationDays * DAY_SECONDS) / epochLength;

    // Calculate required tick movement per epoch to cover the range
    const tickDelta = Math.abs(endTick - startTick);
    // Round up to nearest multiple of tick spacing
    let gamma = Math.ceil(tickDelta / totalEpochs) * tickSpacing;
    // Ensure gamma is at least 1 tick spacing
    gamma = Math.max(tickSpacing, gamma);

    if (gamma % tickSpacing !== 0) {
      throw new Error('Computed gamma must be divisible by tick spacing');
    }

    return gamma;
  }

  /**
   * Computes tick values from price range
   * @param priceRange - The price range in human-readable format
   * @param tickSpacing - The tick spacing for the pool
   * @returns The tick range
   * @private
   */
  private computeTicks(priceRange: PriceRange, tickSpacing: number): TickRange {
    // Convert prices to ticks using the formula: tick = log(price) / log(1.0001) * tickSpacing
    const startTick = Math.floor(Math.log(priceRange.startPrice) / Math.log(1.0001) / tickSpacing) * tickSpacing;
    const endTick = Math.ceil(Math.log(priceRange.endPrice) / Math.log(1.0001) / tickSpacing) * tickSpacing;
    
    return {
      startTick,
      endTick
    };
  }

  /**
   * Encodes token factory initialization data
   * @param tokenConfig - Basic token configuration (name, symbol, URI)
   * @param vestingConfig - Vesting schedule configuration
   * @returns Encoded data for token factory initialization
   * @private
   */
  private encodeTokenFactoryData(
    tokenConfig: { name: string; symbol: string; tokenURI: string },
    vestingConfig: {
      amounts: bigint[];
      recipients: Address[];
      vestingDuration: bigint;
      yearlyMintRate: bigint;
    }
  ): Hex {
    return encodeAbiParameters(
      [
        { type: 'string' },
        { type: 'string' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'address[]' },
        { type: 'uint256[]' },
        { type: 'string' },
      ],
      [
        tokenConfig.name,
        tokenConfig.symbol,
        vestingConfig.yearlyMintRate,
        vestingConfig.vestingDuration,
        vestingConfig.recipients,
        vestingConfig.amounts,
        tokenConfig.tokenURI,
      ]
    );
  }

  /**
   * Encodes custom LP liquidity migrator data
   * @param customLPConfig - Configuration for custom LP migration
   * @param customLPConfig.customLPWad - Amount of custom LP tokens
   * @param customLPConfig.customLPRecipient - Recipient of custom LP tokens
   * @param customLPConfig.lockupPeriod - Lockup period for the tokens
   * @returns Encoded migrator data
   */
  public encodeCustomLPLiquidityMigratorData(customLPConfig: {
    customLPWad: bigint;
    customLPRecipient: Address;
    lockupPeriod: number;
  }): Hex {
    return encodeAbiParameters(
      [{ type: 'uint64' }, { type: 'address' }, { type: 'uint32' }],
      [
        customLPConfig.customLPWad,
        customLPConfig.customLPRecipient,
        customLPConfig.lockupPeriod,
      ]
    );
  }

  /**
   * Encodes V4 migrator data for Uniswap V4 migration with StreamableFeesLocker
   * @param v4Config - Configuration for V4 migration
   * @param includeDefaultBeneficiary - Whether to include the airlock owner as a default 5% beneficiary
   * @returns Encoded migrator data
   * @throws {Error} If beneficiaries are invalid
   */
  public async encodeV4MigratorData(
    v4Config: V4MigratorData,
    includeDefaultBeneficiary: boolean = true
  ): Promise<Hex> {
    let beneficiaries = [...v4Config.beneficiaries];

    if (includeDefaultBeneficiary) {
      // Get the airlock owner address
      const airlockOwner = await this.owner();
      
      // Check if airlock owner is already in the beneficiaries list
      const existingOwnerIndex = beneficiaries.findIndex(
        b => b.beneficiary.toLowerCase() === airlockOwner.toLowerCase()
      );

      if (existingOwnerIndex === -1) {
        // Add airlock owner as 5% beneficiary
        const ownerShares = BigInt(0.05e18); // 5% in WAD
        
        // Scale down other beneficiaries proportionally
        const remainingShares = WAD - ownerShares; // 95% remaining
        const currentTotal = beneficiaries.reduce((sum, b) => sum + b.shares, BigInt(0));
        
        beneficiaries = beneficiaries.map(b => ({
          ...b,
          shares: (b.shares * remainingShares) / currentTotal
        }));
        
        // Add the owner beneficiary
        beneficiaries.push({
          beneficiary: airlockOwner,
          shares: ownerShares
        });
        
        // Sort beneficiaries by address
        beneficiaries = this.sortBeneficiaries(beneficiaries);
      }
    }

    // Validate beneficiaries
    this.validateBeneficiaries(beneficiaries);
    
    return encodeAbiParameters(
      [
        { type: 'uint24' },  // fee
        { type: 'int24' },   // tickSpacing
        { type: 'uint32' },  // lockDuration
        { type: 'tuple[]', components: [
          { type: 'address', name: 'beneficiary' },
          { type: 'uint96', name: 'shares' }
        ]}
      ],
      [
        v4Config.fee,
        v4Config.tickSpacing,
        v4Config.lockDuration,
        beneficiaries.map(b => ({
          beneficiary: b.beneficiary,
          shares: b.shares
        }))
      ]
    );
  }

  /**
   * Validates beneficiaries array for V4 migration
   * @param beneficiaries - Array of beneficiaries to validate
   * @throws {Error} If validation fails
   * @private
   */
  private validateBeneficiaries(beneficiaries: BeneficiaryData[]): void {
    if (!beneficiaries || beneficiaries.length === 0) {
      throw new Error('At least one beneficiary is required');
    }

    // Check ordering (must be in ascending order by address)
    let prevBeneficiary: Address = zeroAddress;
    let totalShares = BigInt(0);

    for (const beneficiary of beneficiaries) {
      if (beneficiary.beneficiary <= prevBeneficiary) {
        throw new Error('Beneficiaries must be sorted in ascending order by address');
      }
      if (beneficiary.shares <= 0) {
        throw new Error('All beneficiary shares must be positive');
      }
      prevBeneficiary = beneficiary.beneficiary;
      totalShares += beneficiary.shares;
    }

    // Check total shares equals WAD (1e18)
    if (totalShares !== WAD) {
      throw new Error(`Total shares must equal ${WAD.toString()} (1e18), got ${totalShares.toString()}`);
    }
  }

  /**
   * Helper function to sort beneficiaries by address
   * @param beneficiaries - Array of beneficiaries to sort
   * @returns Sorted array of beneficiaries
   */
  public sortBeneficiaries(beneficiaries: BeneficiaryData[]): BeneficiaryData[] {
    if (!beneficiaries || beneficiaries.length === 0) {
      return [];
    }
    return [...beneficiaries].sort((a, b) => {
      const addrA = a.beneficiary.toLowerCase();
      const addrB = b.beneficiary.toLowerCase();
      return addrA < addrB ? -1 : addrA > addrB ? 1 : 0;
    });
  }

  /**
   * Builds complete configuration for creating a new Doppler pool
   *
   * This method:
   * 1. Validates all input parameters
   * 2. Converts price ranges to tick ranges if needed
   * 3. Computes optimal gamma if not provided
   * 4. Mines hook and token addresses with proper flags
   * 5. Encodes all factory data
   *
   * @param params - Pre-deployment configuration parameters
   * @param addresses - Addresses of required Doppler V4 contracts
   * @returns Object containing createParams, hook address, and token address
   *
   * @throws {Error} When validation fails or required parameters are missing
   *
   * @example
   * ```typescript
   * const config = factory.buildConfig({
   *   name: "Community Token",
   *   symbol: "COMM",
   *   totalSupply: parseEther("1000000"),
   *   numTokensToSell: parseEther("500000"),
   *   priceRange: { startPrice: 0.001, endPrice: 0.01 },
   *   duration: 30,
   *   epochLength: 3600,
   *   // ... other required parameters
   * }, addresses);
   * ```
   */
  public buildConfig(
    params: DopplerPreDeploymentConfig,
    addresses: DopplerV4Addresses,
    options?: { useGovernance?: boolean }
  ): {
    createParams: CreateParams;
    hook: Hex;
    token: Hex;
  } {
    this.validateBasicParams(params);

    // Validate governance configuration
    const useGovernance = options?.useGovernance ?? true;
    if (!useGovernance && addresses.noOpGovernanceFactory === '0x0000000000000000000000000000000000000000') {
      throw new Error('NoOpGovernanceFactory address not configured for this chain. Please deploy NoOpGovernanceFactory first.');
    }

    if (!params.priceRange && !params.tickRange) {
      throw new Error('Price range or tick range must be provided');
    }

    let startTick;
    let endTick;
    if (params.priceRange) {
      const ticks = this.computeTicks(params.priceRange, params.tickSpacing);
      startTick = ticks.startTick;
      endTick = ticks.endTick;
    }

    if (params.tickRange) {
      startTick = params.tickRange.startTick;
      endTick = params.tickRange.endTick;
    }

    if (!startTick || !endTick) {
      throw new Error('Start tick or end tick not found');
    }

    const gamma =
      params.gamma ??
      this.computeOptimalGamma(
        startTick,
        endTick,
        params.duration,
        params.epochLength,
        params.tickSpacing
      );

    const startTime = params.blockTimestamp + 30;
    const endTime = params.blockTimestamp + params.duration * DAY_SECONDS + 30;

    const totalDuration = endTime - startTime;
    if (totalDuration % params.epochLength !== 0) {
      throw new Error('Epoch length must divide total duration evenly');
    }

    if (gamma % params.tickSpacing !== 0) {
      throw new Error('Computed gamma must be divisible by tick spacing');
    }

    const {
      tokenFactory,
      dopplerDeployer,
      v4Initializer,
      poolManager,
      airlock,
      migrator,
      governanceFactory,
    } = addresses;

    const tokenParams: TokenFactoryData = {
      name: params.name,
      symbol: params.symbol,
      initialSupply: params.totalSupply,
      airlock,
      yearlyMintRate: params.yearlyMintRate,
      vestingDuration: params.vestingDuration,
      recipients: params.recipients,
      amounts: params.amounts,
      tokenURI: params.tokenURI,
    };

    const dopplerParams: DopplerData = {
      minimumProceeds: params.minProceeds,
      maximumProceeds: params.maxProceeds,
      startingTime: BigInt(startTime),
      endingTime: BigInt(endTime),
      startingTick: startTick,
      endingTick: endTick,
      epochLength: BigInt(params.epochLength),
      gamma,
      isToken0: false,
      numPDSlugs: BigInt(params.numPdSlugs ?? DEFAULT_PD_SLUGS),
      fee: params.fee,
      tickSpacing: params.tickSpacing,
    };

    const numeraire = params.numeraire ?? zeroAddress;

    const [salt, hook, token, poolInitializerData, tokenFactoryData] =
      this.mineHookAddress({
        airlock,
        poolManager,
        deployer: dopplerDeployer,
        initialSupply: params.totalSupply,
        numTokensToSell: params.numTokensToSell,
        numeraire,
        tokenFactory,
        tokenFactoryData: tokenParams,
        poolInitializer: v4Initializer,
        poolInitializerData: dopplerParams,
      });

    // Determine which governance factory to use
    const selectedGovernanceFactory = useGovernance
      ? addresses.governanceFactory
      : addresses.noOpGovernanceFactory;

    // When using NoOpGovernanceFactory, the data is ignored, but we still need to provide valid encoding
    const governanceFactoryData = useGovernance
      ? encodeAbiParameters(
          [
            { type: 'string' },
            { type: 'uint48' },
            { type: 'uint32' },
            { type: 'uint256' },
          ],
          [
            params.name,
            DEFAULT_INITIAL_VOTING_DELAY,
            DEFAULT_INITIAL_VOTING_PERIOD,
            DEFAULT_INITIAL_PROPOSAL_THRESHOLD,
          ]
        )
      : '0x' as Hex; // NoOpGovernanceFactory ignores the data

    return {
      createParams: {
        initialSupply: params.totalSupply,
        numTokensToSell: params.numTokensToSell,
        numeraire,
        tokenFactory,
        tokenFactoryData,
        governanceFactory: selectedGovernanceFactory,
        governanceFactoryData,
        poolInitializer: v4Initializer,
        poolInitializerData,
        liquidityMigrator: migrator,
        liquidityMigratorData: params.liquidityMigratorData ?? '0x',
        integrator: params.integrator,
        salt,
      },
      hook,
      token,
    };
  }

  /**
   * Mines a salt and hook address with the appropriate flags
   *
   * This method iterates through possible salt values to find a combination that:
   * - Produces a hook address with required Doppler flags
   * - Maintains proper token ordering relative to numeraire
   * - Ensures deterministic deployment addresses
   *
   * @param params - Parameters for hook address mining
   * @returns Tuple of [salt, hook address, token address, pool data, token data]
   * @throws {Error} If no valid salt can be found within the search limit
   * @private
   */
  private mineHookAddress(params: {
    airlock: Address;
    poolManager: Address;
    deployer: Address;
    initialSupply: bigint;
    numTokensToSell: bigint;
    numeraire: Address;
    tokenFactory: Address;
    tokenFactoryData: TokenFactoryData;
    poolInitializer: Address;
    poolInitializerData: DopplerData;
  }): [Hash, Address, Address, Hex, Hex] {
    const isToken0 =
      params.numeraire !== '0x0000000000000000000000000000000000000000';

    const {
      minimumProceeds,
      maximumProceeds,
      startingTime,
      endingTime,
      startingTick,
      endingTick,
      epochLength,
      gamma,
      numPDSlugs,
      fee,
      tickSpacing,
    } = params.poolInitializerData;

    const poolInitializerData = encodeAbiParameters(
      [
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'int24' },
        { type: 'int24' },
        { type: 'uint256' },
        { type: 'int24' },
        { type: 'bool' },
        { type: 'uint256' },
        { type: 'uint24' },
        { type: 'int24' },
      ],
      [
        minimumProceeds,
        maximumProceeds,
        startingTime,
        endingTime,
        startingTick,
        endingTick,
        epochLength,
        gamma,
        isToken0,
        numPDSlugs,
        fee,
        tickSpacing,
      ]
    );

    const { poolManager, numTokensToSell, poolInitializer } = params;

    const hookInitHashData = encodeAbiParameters(
      [
        { type: 'address' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'int24' },
        { type: 'int24' },
        { type: 'uint256' },
        { type: 'int24' },
        { type: 'bool' },
        { type: 'uint256' },
        { type: 'address' },
        { type: 'uint24' },
      ],
      [
        poolManager,
        numTokensToSell,
        minimumProceeds,
        maximumProceeds,
        startingTime,
        endingTime,
        startingTick,
        endingTick,
        epochLength,
        gamma,
        isToken0,
        numPDSlugs,
        poolInitializer,
        fee,
      ]
    );

    const hookInitHash = keccak256(
      encodePacked(
        ['bytes', 'bytes'],
        [DopplerBytecode as Hex, hookInitHashData]
      )
    );

    const {
      name,
      symbol,
      yearlyMintRate,
      vestingDuration,
      recipients,
      amounts,
      tokenURI,
    } = params.tokenFactoryData;

    const tokenFactoryData = this.encodeTokenFactoryData(
      {
        name,
        symbol,
        tokenURI,
      },
      {
        amounts,
        recipients,
        vestingDuration,
        yearlyMintRate,
      }
    );

    const { airlock, initialSupply } = params;

    const initHashData = encodeAbiParameters(
      [
        { type: 'string' },
        { type: 'string' },
        { type: 'uint256' },
        { type: 'address' },
        { type: 'address' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'address[]' },
        { type: 'uint256[]' },
        { type: 'string' },
      ],
      [
        name,
        symbol,
        initialSupply,
        airlock,
        airlock,
        yearlyMintRate,
        vestingDuration,
        recipients,
        amounts,
        tokenURI,
      ]
    );

    const tokenInitHash = keccak256(
      encodePacked(['bytes', 'bytes'], [DERC20Bytecode as Hex, initHashData])
    );

    for (let salt = BigInt(0); salt < BigInt(1_000_000); salt++) {
      const saltBytes = `0x${salt.toString(16).padStart(64, '0')}` as Hash;
      const hook = this.computeCreate2Address(
        saltBytes,
        hookInitHash,
        params.deployer
      );
      const token = this.computeCreate2Address(
        saltBytes,
        tokenInitHash,
        params.tokenFactory
      );

      const hookBigInt = BigInt(hook);
      const tokenBigInt = BigInt(token);
      const numeraireBigInt = BigInt(params.numeraire);

      if (
        (hookBigInt & FLAG_MASK) === flags &&
        ((isToken0 && tokenBigInt < numeraireBigInt) ||
          (!isToken0 && tokenBigInt > numeraireBigInt))
      ) {
        return [saltBytes, hook, token, poolInitializerData, tokenFactoryData];
      }
    }

    throw new Error('AirlockMiner: could not find salt');
  }

  /**
   * Creates a new Doppler pool with token, hook, migrator, and governance
   *
   * This is the main method for deploying a complete Doppler ecosystem:
   * - Deploys the token contract with vesting schedules
   * - Deploys the hook contract for price discovery
   * - Initializes the Uniswap V4 pool
   * - Sets up governance contracts
   * - Configures liquidity migration
   *
   * @param params - Complete creation parameters from buildConfig()
   * @param options - Optional transaction options (gas, value, etc.)
   * @returns Promise resolving to the transaction hash
   *
   * @example
   * ```typescript
   * const { createParams } = factory.buildConfig(config, addresses);
   * const txHash = await factory.create(createParams, {
   *   gasLimit: 5000000n
   * });
   * ```
   */
  public async create(
    params: CreateParams,
    options?: TransactionOptions
  ): Promise<Hex> {
    return this.airlock.write('create', { createData: params }, options);
  }

  /**
   * Simulates a pool creation transaction without executing it
   *
   * Useful for:
   * - Estimating gas costs
   * - Validating parameters before execution
   * - Getting return values from the creation
   * - Testing deployment configurations
   *
   * @param params - Complete creation parameters from buildConfig()
   * @returns Promise resolving to simulation results including gas estimates
   *
   * @example
   * ```typescript
   * const simulation = await factory.simulateCreate(createParams);
   * console.log(`Estimated gas: ${simulation.request.gas}`);
   * ```
   */
  public async simulateCreate(
    params: CreateParams
  ): Promise<FunctionReturn<AirlockABI, 'create'>> {
    return this.airlock.simulateWrite('create', { createData: params });
  }

  /**
   * Migrates liquidity for an existing asset from the current pool to the migration pool
   *
   * This method triggers the migration process for assets that have completed their
   * price discovery phase. The migration moves liquidity from the Doppler hook pool
   * to a standard Uniswap V4 pool for ongoing trading.
   *
   * @param asset - The address of the asset token to migrate
   * @param options - Optional transaction options (gas, value, etc.)
   * @returns Promise resolving to the transaction hash
   *
   * @example
   * ```typescript
   * // Migrate liquidity after price discovery ends
   * const txHash = await factory.migrate(tokenAddress);
   * ```
   */
  public async migrate(
    asset: Address,
    options?: TransactionOptions
  ): Promise<Hex> {
    return this.airlock.write('migrate', { asset }, options);
  }
}
