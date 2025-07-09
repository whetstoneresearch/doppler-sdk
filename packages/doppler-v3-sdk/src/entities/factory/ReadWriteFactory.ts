import {
  createDrift,
  Drift,
  FunctionArgs,
  FunctionReturn,
  HexString,
  ReadWriteAdapter,
  ReadWriteContract,
  TransactionOptions,
} from "@delvtech/drift";
import {
  Address,
  encodeAbiParameters,
  encodePacked,
  getAddress,
  Hash,
  Hex,
  keccak256,
  parseEther,
  toHex,
} from "viem";
import { BundlerAbi } from "../../abis";
import { DOPPLER_V3_ADDRESSES } from "../../addresses";
import { BeneficiaryData, V4MigratorData } from "../../types";
import { DERC20Bytecode } from "@/abis/bytecodes";
import { VANITY_ADDRESS_ENDING } from "@/constants";
import { ReadFactory, AirlockABI } from "./ReadFactory";

// Constants for default configuration values
export const ONE_YEAR_IN_SECONDS = 365 * 24 * 60 * 60;
export const DEFAULT_START_TICK = 175000;
export const DEFAULT_END_TICK = 225000;
export const DEFAULT_NUM_POSITIONS = 15;
export const DEFAULT_FEE = 10_000; // 1% fee tier
export const DEFAULT_VESTING_DURATION = BigInt(ONE_YEAR_IN_SECONDS);
export const DEFAULT_INITIAL_SUPPLY_WAD = parseEther("1000000000");
export const DEFAULT_NUM_TOKENS_TO_SELL_WAD = parseEther("900000000");
export const DEFAULT_YEARLY_MINT_RATE_WAD = parseEther("0.02");
export const DEFAULT_PRE_MINT_WAD = parseEther("9000000"); // 0.9% of the total supply
export const DEFAULT_MAX_SHARE_TO_BE_SOLD = parseEther("0.35");

export const DEFAULT_INITIAL_VOTING_DELAY = 172800;
export const DEFAULT_INITIAL_VOTING_PERIOD = 1209600;
export const DEFAULT_INITIAL_PROPOSAL_THRESHOLD = BigInt(0);

export const WAD = BigInt(10 ** 18);
export const DEAD_ADDRESS =
  "0x000000000000000000000000000000000000dEaD" as Address;

/**
 * Parameters required for creating a new Doppler V3 pool
 * @property initialSupply Initial token supply
 * @property numTokensToSell Number of tokens to sell
 * @property numeraire Address of the numeraire token
 * @property tokenFactory Address of token factory contract
 * @property tokenFactoryData Encoded token factory initialization data
 * @property governanceFactory Address of governance factory contract
 * @property governanceFactoryData Encoded governance factory initialization data
 * @property poolInitializer Address of pool initializer contract
 * @property poolInitializerData Encoded pool initialization data
 * @property liquidityMigrator Address of liquidity migrator contract
 * @property liquidityMigratorData Encoded liquidity migration data
 * @property integrator Integrator address
 * @property salt Unique salt for deployment
 */
export interface CreateParams {
  initialSupply: bigint;
  numTokensToSell: bigint;
  numeraire: Address;
  tokenFactory: Address;
  tokenFactoryData: Hex;
  governanceFactory: Address;
  governanceFactoryData: Hex;
  poolInitializer: Address;
  poolInitializerData: Hex;
  liquidityMigrator: Address;
  liquidityMigratorData: Hex;
  integrator: Address;
  salt: Hex;
}

/**
 * Configuration for a Doppler V3 liquidity pool
 * @property startTick Initial tick position
 * @property endTick Final tick position
 * @property numPositions Number of positions
 * @property maxShareToBeSold Maximum percentage of shares to sell
 * @property maxShareToBond Maximum percentage of shares to bond
 * @property fee Pool fee percentage (in basis points)
 * @property beneficiaries Array of beneficiaries (only for fee streaming pools)
 */
export interface V3PoolConfig {
  startTick: number;
  endTick: number;
  numPositions: number;
  maxShareToBeSold: bigint;
  fee: number;
  beneficiaries?: BeneficiaryData[];
}

/**
 * Token sale configuration parameters
 * @property initialSupply Initial token supply
 * @property numTokensToSell Number of tokens available for sale
 */
export interface SaleConfig {
  initialSupply: bigint;
  numTokensToSell: bigint;
}

/**
 * Vesting schedule configuration
 * @property yearlyMintCap Annual minting cap
 * @property vestingDuration Duration of vesting period
 * @property recipients Array of recipient addresses
 * @property amounts Corresponding vesting amounts
 */
export interface VestingConfig {
  yearlyMintRate: bigint;
  vestingDuration: bigint;
  recipients: Address[];
  amounts: bigint[];
}

/**
 * Basic token metadata configuration
 * @property name Token name
 * @property symbol Token symbol
 * @property tokenURI URI for token metadata
 */
export interface TokenConfig {
  name: string;
  symbol: string;
  tokenURI: string;
}

/**
 * Governance configuration parameters
 * @property initialVotingDelay Initial voting delay in seconds
 * @property initialVotingPeriod Initial voting period in seconds
 * @property initialProposalThreshold Initial proposal threshold
 */
export interface GovernanceConfig {
  initialVotingDelay: number;
  initialVotingPeriod: number;
  initialProposalThreshold: bigint;
}

/**
 * Contract dependencies for pool initialization
 * @property tokenFactory Address of token factory
 * @property governanceFactory Address of governance factory
 * @property v3Initializer Address of V3 initializer
 * @property liquidityMigrator Address of liquidity migrator
 */
export interface InitializerContractDependencies {
  tokenFactory: Address;
  governanceFactory: Address;
  v3Initializer: Address;
  liquidityMigrator: Address;
}

/**
 * Parameters for creating a Doppler V3 pool
 * @property integrator Integrator address
 * @property userAddress User address for salt generation
 * @property numeraire Address of numeraire token
 * @property contracts Contract dependencies
 * @property tokenConfig Token metadata configuration
 * @property saleConfig Optional sale configuration overrides
 * @property v3PoolConfig Optional pool configuration overrides
 * @property vestingConfig Vesting configuration or "default" preset
 * @property liquidityMigratorData Optional encoded V4 migrator data for future migration
 */
export interface CreateV3PoolParams {
  integrator: Address;
  userAddress: Address;
  numeraire: Address;
  contracts: InitializerContractDependencies;
  tokenConfig: TokenConfig;
  saleConfig?: Partial<SaleConfig>;
  v3PoolConfig?: Partial<V3PoolConfig>;
  vestingConfig: VestingConfig | "default";
  governanceConfig?: Partial<GovernanceConfig>;
  liquidityMigratorData?: Hex;
}

/**
 * Default configuration presets
 * @property defaultV3PoolConfig Default pool configuration
 * @property defaultVestingConfig Default vesting schedule
 * @property defaultSaleConfig Default sale parameters
 * @property defaultGovernanceConfig Default governance parameters
 */
export interface DefaultConfigs {
  defaultV3PoolConfig?: V3PoolConfig;
  defaultVestingConfig?: VestingConfig;
  defaultSaleConfig?: SaleConfig;
  defaultGovernanceConfig?: GovernanceConfig;
}

export type BundlerABI = typeof BundlerAbi;

/**
 * Factory class for creating and managing Doppler V3 pools with read/write capabilities
 */
export class ReadWriteFactory extends ReadFactory {
  declare airlock: ReadWriteContract<AirlockABI>;
  declare bundler: ReadWriteContract<BundlerABI>;
  declare defaultV3PoolConfig: V3PoolConfig;
  declare defaultVestingConfig: VestingConfig;
  declare defaultSaleConfig: SaleConfig;
  declare defaultGovernanceConfig: GovernanceConfig;
  private drift: Drift<ReadWriteAdapter>;
  /**
   * Create a new ReadWriteFactory instance
   * @param address Contract address
   * @param drift Drift instance for blockchain interaction
   * @param defaultConfigs Optional default configurations
   */
  constructor(
    address: Address,
    bundlerAddress: Address,
    drift: Drift<ReadWriteAdapter> = createDrift(),
    defaultConfigs?: DefaultConfigs
  ) {
    super(address, drift);
    this.drift = drift;
    this.bundler = drift.contract({
      abi: BundlerAbi,
      address: bundlerAddress,
    });

    // Initialize default configurations with fallback values
    this.defaultV3PoolConfig = defaultConfigs?.defaultV3PoolConfig ?? {
      startTick: DEFAULT_START_TICK,
      endTick: DEFAULT_END_TICK,
      numPositions: DEFAULT_NUM_POSITIONS,
      maxShareToBeSold: DEFAULT_MAX_SHARE_TO_BE_SOLD,
      fee: DEFAULT_FEE,
    };

    this.defaultVestingConfig = defaultConfigs?.defaultVestingConfig ?? {
      yearlyMintRate: DEFAULT_YEARLY_MINT_RATE_WAD,
      vestingDuration: DEFAULT_VESTING_DURATION,
      recipients: [],
      amounts: [],
    };

    this.defaultSaleConfig = defaultConfigs?.defaultSaleConfig ?? {
      initialSupply: DEFAULT_INITIAL_SUPPLY_WAD,
      numTokensToSell: DEFAULT_NUM_TOKENS_TO_SELL_WAD,
    };

    this.defaultGovernanceConfig = defaultConfigs?.defaultGovernanceConfig ?? {
      initialVotingDelay: DEFAULT_INITIAL_VOTING_DELAY,
      initialVotingPeriod: DEFAULT_INITIAL_VOTING_PERIOD,
      initialProposalThreshold: DEFAULT_INITIAL_PROPOSAL_THRESHOLD,
    };
  }
  private computeCreate2Address(
    salt: Hash,
    initCodeHash: Hash,
    deployer: Address
  ): Address {
    const encoded = encodePacked(
      ["bytes1", "address", "bytes32", "bytes32"],
      ["0xff", deployer, salt, initCodeHash]
    );
    return getAddress(`0x${keccak256(encoded).slice(-40)}`);
  }

  /**
   * Merge user configuration with defaults
   * @param config User-provided partial configuration
   * @param defaults Full default configuration
   * @returns Merged configuration object
   */
  private mergeWithDefaults<T extends object>(
    config: Partial<T> | undefined,
    defaults: T
  ): T {
    return { ...defaults, ...config };
  }

  /**
   * Get merged sale configuration
   * @param saleConfig Optional partial sale config
   * @returns Complete SaleConfig
   */
  private getMergedSaleConfig(saleConfig?: Partial<SaleConfig>): SaleConfig {
    return this.mergeWithDefaults(saleConfig, this.defaultSaleConfig);
  }

  /**
   * Get merged pool configuration
   * @param v3PoolConfig Optional partial pool config
   * @returns Complete V3PoolConfig
   */
  private getMergedV3PoolConfig(
    v3PoolConfig?: Partial<V3PoolConfig>
  ): V3PoolConfig {
    return this.mergeWithDefaults(v3PoolConfig, this.defaultV3PoolConfig);
  }

  /**
   * Get merged governance configuration
   * @param governanceConfig Optional partial governance config
   * @returns Complete GovernanceConfig
   */
  private getMergedGovernanceConfig(
    governanceConfig?: Partial<GovernanceConfig>
  ): GovernanceConfig {
    return this.mergeWithDefaults(
      governanceConfig,
      this.defaultGovernanceConfig
    );
  }

  /**
   * Get merged vesting configuration
   * @param config Vesting config or "default" preset
   * @param userAddress User address for default recipient
   * @returns Complete VestingConfig
   */
  private getMergedVestingConfig(
    config: VestingConfig | "default",
    userAddress: Address
  ): VestingConfig {
    const base = config === "default" ? this.defaultVestingConfig : config;

    return {
      ...base,
      recipients: config === "default" ? [userAddress] : [...base.recipients],
      amounts:
        config === "default" ? [DEFAULT_PRE_MINT_WAD] : [...base.amounts],
    };
  }

  /**
   * Generate a random salt
   * @param account User address to incorporate into salt
   * @returns Hex string of generated salt
   */
  private generateRandomSalt = (account: Address): HexString => {
    const array = new Uint8Array(32);

    // Sequential byte generation
    for (let i = 0; i < 32; i++) {
      array[i] = i;
    }

    if (account) {
      const addressBytes = account.slice(2).padStart(40, "0");
      for (let i = 0; i < 20; i++) {
        const addressByte = parseInt(
          addressBytes.slice(i * 2, (i + 1) * 2),
          16
        );
        array[i] ^= addressByte;
      }
    }
    return `0x${Array.from(array)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")}`;
  };

  /**
   * Encode lockable pool initializer data
   * @param v3PoolConfig Complete pool configuration
   * @returns ABI-encoded initialization data
   */
  private encodeLockablePoolInitializerData(v3PoolConfig: V3PoolConfig): Hex {
    if (!v3PoolConfig.beneficiaries) {
      throw new Error(
        "Beneficiaries are required for lockable pool initialization"
      );
    }

    const totalShares = v3PoolConfig.beneficiaries.reduce(
      (acc, beneficiary) => acc + beneficiary.shares,
      0n
    );

    if (totalShares !== WAD) {
      throw new Error("Total shares must be equal to 1e18");
    }

    // Wrapping all the components in a tuple since the data is decoded as a InitData struct
    return encodeAbiParameters(
      [
        {
          type: "tuple",
          components: [
            { name: "fee", type: "uint24" },
            { name: "startTick", type: "int24" },
            { name: "endTick", type: "int24" },
            { name: "numPositions", type: "uint16" },
            { name: "maxShareToBeSold", type: "uint256" },
            {
              name: "beneficiaries",
              type: "tuple[]",
              components: [
                { type: "address", name: "beneficiary" },
                { type: "uint96", name: "shares" },
              ],
            },
          ],
        },
      ],
      [
        {
          fee: v3PoolConfig.fee,
          startTick: v3PoolConfig.startTick,
          endTick: v3PoolConfig.endTick,
          numPositions: v3PoolConfig.numPositions,
          maxShareToBeSold: v3PoolConfig.maxShareToBeSold,
          beneficiaries: v3PoolConfig.beneficiaries,
        },
      ]
    );
  }

  /**
   * Encode pool initialization data for contract calls
   * @param v3PoolConfig Complete pool configuration
   * @returns ABI-encoded initialization data
   */
  private encodePoolInitializerData(v3PoolConfig: V3PoolConfig): Hex {
    return encodeAbiParameters(
      [
        { type: "uint24" },
        { type: "int24" },
        { type: "int24" },
        { type: "uint16" },
        { type: "uint256" },
      ],
      [
        v3PoolConfig.fee,
        v3PoolConfig.startTick,
        v3PoolConfig.endTick,
        v3PoolConfig.numPositions,
        v3PoolConfig.maxShareToBeSold,
      ]
    );
  }

  /**
   * Encode token factory initialization data
   * @param tokenConfig Token metadata
   * @param vestingConfig Vesting schedule
   * @returns ABI-encoded token factory data
   */
  private encodeTokenFactoryData(
    tokenConfig: TokenConfig,
    vestingConfig: VestingConfig
  ): Hex {
    return encodeAbiParameters(
      [
        { type: "string" },
        { type: "string" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "address[]" },
        { type: "uint256[]" },
        { type: "string" },
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
   * Encode governance factory initialization data
   * @param tokenConfig Token metadata
   * @returns ABI-encoded governance data
   */
  private encodeGovernanceFactoryData(
    tokenConfig: TokenConfig,
    governanceConfig: GovernanceConfig
  ): Hex {
    return encodeAbiParameters(
      [
        { type: "string" },
        { type: "uint48" },
        { type: "uint32" },
        { type: "uint256" },
      ],
      [
        tokenConfig.name,
        Number(governanceConfig.initialVotingDelay),
        Number(governanceConfig.initialVotingPeriod),
        governanceConfig.initialProposalThreshold,
      ]
    );
  }

  /**
   * Encode all parameters for pool creation
   * @param params CreateV3PoolParams input parameters
   * @returns Object containing create parameters and final pool config
   * @throws Error if user address is missing or invalid tick range
   */
  public encode(params: CreateV3PoolParams): {
    createParams: CreateParams;
    v3PoolConfig: V3PoolConfig;
  } {
    const { userAddress, numeraire, integrator, contracts, tokenConfig } =
      params;

    if (!userAddress) {
      throw new Error("User address is required. Is a wallet connected?");
    }

    // Merge configurations with defaults
    const vestingConfig = this.getMergedVestingConfig(
      params.vestingConfig,
      userAddress
    );
    const v3PoolConfig = this.getMergedV3PoolConfig(params.v3PoolConfig);
    const saleConfig = this.getMergedSaleConfig(params.saleConfig);
    const governanceConfig = this.getMergedGovernanceConfig(
      params.governanceConfig
    );

    // Validate tick configuration
    if (v3PoolConfig.startTick > v3PoolConfig.endTick) {
      throw new Error(
        "Invalid start and end ticks. Start tick must be less than end tick."
      );
    }

    const initHashData = encodeAbiParameters(
      [
        { type: "string" },
        { type: "string" },
        { type: "uint256" },
        { type: "address" },
        { type: "address" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "address[]" },
        { type: "uint256[]" },
        { type: "string" },
      ],
      [
        params.tokenConfig.name,
        params.tokenConfig.symbol,
        saleConfig.initialSupply,
        this.airlock.address,
        this.airlock.address,
        vestingConfig.yearlyMintRate,
        vestingConfig.vestingDuration,
        vestingConfig.recipients,
        vestingConfig.amounts,
        tokenConfig.tokenURI,
      ]
    );

    const tokenInitHash = keccak256(
      encodePacked(["bytes", "bytes"], [DERC20Bytecode as Hex, initHashData])
    );

    const governanceFactoryData = this.encodeGovernanceFactoryData(
      tokenConfig,
      governanceConfig
    );
    const tokenFactoryData = this.encodeTokenFactoryData(
      tokenConfig,
      vestingConfig
    );

    const poolInitializerData = v3PoolConfig.beneficiaries
      ? this.encodeLockablePoolInitializerData(v3PoolConfig)
      : this.encodePoolInitializerData(v3PoolConfig);
    const liquidityMigratorData = params.liquidityMigratorData ?? ("0x" as Hex);

    // Prepare final arguments
    const {
      tokenFactory,
      governanceFactory,
      v3Initializer: poolInitializer,
      liquidityMigrator,
    } = contracts;

    let minedSalt = this.generateRandomSalt(userAddress);
    for (let salt = BigInt(0); salt < BigInt(1_000_000); salt++) {
      const saltBytes = `0x${salt.toString(16).padStart(64, "0")}` as Hash;

      const token = this.computeCreate2Address(
        saltBytes,
        tokenInitHash,
        tokenFactory
      );
      if (token.toLowerCase().endsWith(VANITY_ADDRESS_ENDING)) {
        console.log(token);
        minedSalt = saltBytes;
        break;
      }
    }

    const { initialSupply, numTokensToSell } = saleConfig;

    const args: CreateParams = {
      initialSupply,
      numTokensToSell,
      numeraire,
      tokenFactory,
      tokenFactoryData,
      governanceFactory,
      governanceFactoryData,
      poolInitializer,
      poolInitializerData,
      liquidityMigrator,
      liquidityMigratorData,
      integrator,
      salt: minedSalt,
    };

    return {
      createParams: args,
      v3PoolConfig,
    };
  }

  /**
   * Encode creation data with token order validation
   * @param params CreateV3PoolParams input parameters
   * @returns Finalized create parameters with adjusted ticks if needed
   */
  public async encodeCreateData(
    params: CreateV3PoolParams
  ): Promise<CreateParams> {
    // First, perform validation before any encoding
    const saleConfig = this.getMergedSaleConfig(params.saleConfig);
    const vestingConfig = this.getMergedVestingConfig(
      params.vestingConfig,
      params.userAddress
    );
    const totalVestedAmount = vestingConfig.amounts.reduce(
      (sum, amount) => sum + amount,
      0n
    );

    // Validation Rule #1: Supply Integrity Constraint
    if (
      saleConfig.initialSupply <
      saleConfig.numTokensToSell + totalVestedAmount
    ) {
      throw new Error(
        `Configuration Error: Vesting and sale amounts (${
          saleConfig.numTokensToSell + totalVestedAmount
        }) exceed the initial supply (${
          saleConfig.initialSupply
        }). Please adjust your vesting schedule or increase the initial supply.`
      );
    }

    if (params.v3PoolConfig?.beneficiaries) {
      this.validateBeneficiaries(params.v3PoolConfig.beneficiaries);

      // assert that the beneficiaries are sorted and give 0.05 ether to the airlock owner
      const airlockOwner = await this.airlock.read("owner");
      const airlockOwnerIndex = params.v3PoolConfig.beneficiaries.findIndex(b => b.beneficiary.toLowerCase() === airlockOwner.toLowerCase());
      if (airlockOwnerIndex === -1) {
        throw new Error("Airlock owner is not a beneficiary");
      }
      if (params.v3PoolConfig.beneficiaries[airlockOwnerIndex].shares !== parseEther("0.05")) {
        throw new Error("Airlock owner must have 0.05 ether");
      }
    }

    // Validation Rule #2: No-Op Governance Constraint
    // Check if the governance factory is a no-op governance factory
    const chainId = await this.drift.getChainId();
    const addresses = DOPPLER_V3_ADDRESSES[chainId];
    const isNoOp =
      addresses?.noOpGovernanceFactory &&
      params.contracts.governanceFactory.toLowerCase() ===
        addresses.noOpGovernanceFactory.toLowerCase();

    if (isNoOp) {
      const excess =
        saleConfig.initialSupply -
        (saleConfig.numTokensToSell + totalVestedAmount);
      if (excess !== 0n) {
        throw new Error(
          `Configuration Error: No-op governance requires zero excess tokens. ` +
            `The current configuration creates an excess of ${excess} tokens. ` +
            `Please set initialSupply to be exactly the sum of numTokensToSell and vested amounts.`
        );
      }
    }

    // If validation passes, proceed with the original logic
    let isToken0 = true;
    let createParams!: CreateParams;
    let asset!: Address;

    let i = 0n;
    while (isToken0) {
      const encoded = this.encode(params);
      createParams = encoded.createParams;
      createParams.salt = this.generateRandomSalt(
        toHex(BigInt(params.userAddress) + BigInt(i))
      ) as Hex;
      const simulateResult = await this.simulateCreate(createParams);
      asset = simulateResult.asset;
      isToken0 = Number(asset) < Number(params.numeraire);
      i++;
    }
    return createParams;
  }

  /**
   * Execute pool creation transaction
   * @param params Finalized create parameters
   * @param options Write options and mined handlers
   * @returns Transaction hash
   */
  public async create(
    params: CreateParams,
    options?: TransactionOptions
  ): Promise<Hex> {
    return this.airlock.write("create", { createData: params }, options);
  }

  /**
   * Simulate pool creation transaction
   * @param params Create parameters
   * @returns Simulation results
   */
  public async simulateCreate(
    params: CreateParams
  ): Promise<FunctionReturn<AirlockABI, "create">> {
    return this.airlock.simulateWrite("create", { createData: params });
  }

  public async simulateBundleExactOutput(
    createData: CreateParams,
    params: FunctionArgs<BundlerABI, "simulateBundleExactOut">["params"]
  ): Promise<FunctionReturn<BundlerABI, "simulateBundleExactOut">> {
    return this.bundler.simulateWrite("simulateBundleExactOut", {
      createData,
      params: { ...params },
    });
  }

  public async simulateBundleExactInput(
    createData: CreateParams,
    params: FunctionArgs<BundlerABI, "simulateBundleExactIn">["params"]
  ): Promise<FunctionReturn<BundlerABI, "simulateBundleExactIn">> {
    return this.bundler.simulateWrite("simulateBundleExactIn", {
      createData,
      params: { ...params },
    });
  }

  public async bundle(
    createData: CreateParams,
    commands: FunctionArgs<BundlerABI, "bundle">["commands"],
    inputs: FunctionArgs<BundlerABI, "bundle">["inputs"],
    options?: TransactionOptions
  ): Promise<Hex> {
    return this.bundler.write(
      "bundle",
      { createData, commands, inputs },
      options
    );
  }

  /**
   * Update default configurations
   * @param configs Partial configuration overrides
   */
  public updateDefaultConfigs(configs: {
    defaultV3PoolConfig?: Partial<V3PoolConfig>;
    defaultVestingConfig?: Partial<VestingConfig>;
    defaultSaleConfig?: Partial<SaleConfig>;
    defaultGovernanceConfig?: Partial<GovernanceConfig>;
  }) {
    this.defaultV3PoolConfig = this.mergeWithDefaults(
      configs.defaultV3PoolConfig || {},
      this.defaultV3PoolConfig
    );

    this.defaultVestingConfig = this.mergeWithDefaults(
      configs.defaultVestingConfig || {},
      this.defaultVestingConfig
    );

    this.defaultSaleConfig = this.mergeWithDefaults(
      configs.defaultSaleConfig || {},
      this.defaultSaleConfig
    );

    this.defaultGovernanceConfig = this.mergeWithDefaults(
      configs.defaultGovernanceConfig || {},
      this.defaultGovernanceConfig
    );
  }

  /**
   * Sort beneficiaries by address in ascending order
   * @param beneficiaries Array of beneficiary data
   * @returns Sorted array of beneficiaries
   */
  public sortBeneficiaries(
    beneficiaries: BeneficiaryData[]
  ): BeneficiaryData[] {
    return [...beneficiaries].sort((a, b) => {
      const aNum = BigInt(a.beneficiary);
      const bNum = BigInt(b.beneficiary);
      return aNum < bNum ? -1 : aNum > bNum ? 1 : 0;
    });
  }

  /**
   * Validate beneficiary data
   * @param beneficiaries Array of beneficiary data to validate
   * @throws Error if validation fails
   */
  private validateBeneficiaries(beneficiaries: BeneficiaryData[]): void {
    if (beneficiaries.length === 0) {
      throw new Error("At least one beneficiary is required");
    }

    // Check that beneficiaries are sorted
    for (let i = 1; i < beneficiaries.length; i++) {
      if (
        BigInt(beneficiaries[i].beneficiary) <=
        BigInt(beneficiaries[i - 1].beneficiary)
      ) {
        throw new Error(
          "Beneficiaries must be sorted in ascending order by address"
        );
      }
    }

    // Check that all shares are positive
    let totalShares = BigInt(0);
    for (const beneficiary of beneficiaries) {
      if (beneficiary.shares <= 0) {
        throw new Error("All beneficiary shares must be positive");
      }
      totalShares += beneficiary.shares;
    }

    // Check that shares sum to WAD
    if (totalShares !== WAD) {
      throw new Error(
        `Total shares must equal ${WAD} (100%), but got ${totalShares}`
      );
    }
  }

  /**
   * Encode V4 migrator data for Uniswap V4 migration with StreamableFeesLocker
   * @param data V4 migrator configuration
   * @param includeDefaultBeneficiary Whether to include the airlock owner as a default 5% beneficiary
   * @returns Encoded hex data
   */
  public async encodeV4MigratorData(
    data: V4MigratorData,
    includeDefaultBeneficiary: boolean = true
  ): Promise<Hex> {
    let beneficiaries = [...data.beneficiaries];

    if (includeDefaultBeneficiary) {
      // Get the airlock owner address
      const airlockOwner = await this.owner();

      // Check if airlock owner is already in the beneficiaries list
      const existingOwnerIndex = beneficiaries.findIndex(
        (b) => b.beneficiary.toLowerCase() === airlockOwner.toLowerCase()
      );

      if (existingOwnerIndex === -1) {
        // Add airlock owner as 5% beneficiary
        const ownerShares = BigInt(0.05e18); // 5% in WAD

        // Scale down other beneficiaries proportionally
        const remainingShares = WAD - ownerShares; // 95% remaining
        const currentTotal = beneficiaries.reduce(
          (sum, b) => sum + b.shares,
          BigInt(0)
        );

        beneficiaries = beneficiaries.map((b) => ({
          ...b,
          shares: (b.shares * remainingShares) / currentTotal,
        }));

        // Add the owner beneficiary
        beneficiaries.push({
          beneficiary: airlockOwner,
          shares: ownerShares,
        });

        // Sort beneficiaries by address
        beneficiaries = this.sortBeneficiaries(beneficiaries);
      }
    }

    // Validate beneficiaries before encoding
    this.validateBeneficiaries(beneficiaries);

    return encodeAbiParameters(
      [
        { type: "uint24" }, // fee
        { type: "int24" }, // tickSpacing
        { type: "uint32" }, // lockDuration
        {
          type: "tuple[]",
          components: [
            { type: "address", name: "beneficiary" },
            { type: "uint96", name: "shares" },
          ],
        },
      ],
      [
        data.fee,
        data.tickSpacing,
        data.lockDuration,
        beneficiaries.map((b) => ({
          beneficiary: b.beneficiary,
          shares: b.shares,
        })),
      ]
    );
  }
}
