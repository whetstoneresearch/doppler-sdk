import {
  ContractWriteOptions,
  createDrift,
  Drift,
  FunctionArgs,
  FunctionReturn,
  HexString,
  OnMinedParam,
  ReadWriteAdapter,
  ReadWriteContract,
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
} from "viem";
import { BundlerAbi } from "../../abis";
import { DERC20Bytecode } from "../../abis/bytecodes";
import { VANITY_ADDRESS_ENDING } from "../../constants";
import { AirlockABI, ReadFactory } from "./ReadFactory";

// Constants for default configuration values
const ONE_YEAR_IN_SECONDS = 365 * 24 * 60 * 60;
const DEFAULT_START_TICK = 175000;
const DEFAULT_END_TICK = 225000;
const DEFAULT_NUM_POSITIONS = 15;
const DEFAULT_FEE = 10_000; // 1% fee tier
const DEFAULT_VESTING_DURATION = BigInt(ONE_YEAR_IN_SECONDS);
const DEFAULT_INITIAL_SUPPLY_WAD = parseEther("1000000000");
const DEFAULT_NUM_TOKENS_TO_SELL_WAD = parseEther("900000000");
const DEFAULT_YEARLY_MINT_RATE_WAD = parseEther("0.02");
const DEFAULT_PRE_MINT_WAD = parseEther("9000000"); // 0.9% of the total supply
const DEFAULT_MAX_SHARE_TO_BE_SOLD = parseEther("0.35");

const DEFAULT_INITIAL_VOTING_DELAY = 7200;
const DEFAULT_INITIAL_VOTING_PERIOD = 50400;
const DEFAULT_INITIAL_PROPOSAL_THRESHOLD = BigInt(0);

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
 */
export interface V3PoolConfig {
  startTick: number;
  endTick: number;
  numPositions: number;
  maxShareToBeSold: bigint;
  fee: number;
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
   * Generate a random salt using cryptographic random values
   * @param account User address to incorporate into salt
   * @returns Hex string of generated salt
   */
  private generateRandomSalt = (account: Address): HexString => {
    const array = new Uint8Array(32);

    // Cross-platform random generation
    if (typeof window !== "undefined" && window.crypto) {
      window.crypto.getRandomValues(array);
    } else {
      array.set(require("crypto").randomBytes(32));
    }

    // Incorporate user address into salt
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
    const poolInitializerData = this.encodePoolInitializerData(v3PoolConfig);
    const liquidityMigratorData = "0x" as Hex;

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
    let isToken0 = true;
    let createParams!: CreateParams;
    let asset!: Address;

    while (isToken0) {
      const encoded = this.encode(params);
      createParams = encoded.createParams;
      const simulateResult = await this.simulateCreate(createParams);
      asset = simulateResult.asset;
      isToken0 = Number(asset) < Number(params.numeraire);
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
    options?: ContractWriteOptions & OnMinedParam
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
    options?: ContractWriteOptions & OnMinedParam
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
}
