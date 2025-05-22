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
  parseEther,
} from 'viem';
import { ReadFactory, AirlockABI } from './ReadFactory';
import { CreateParams } from './types';
import { DERC20Bytecode, DopplerBytecode } from '@/abis';
import { DAY_SECONDS, DEFAULT_PD_SLUGS, WAD_STRING } from '@/constants';
import { encodeSqrtRatioX96, TickMath } from '@uniswap/v3-sdk';
import { DopplerData, TokenFactoryData } from './types';
import {
  DopplerPreDeploymentConfig,
  DopplerV4Addresses,
  PriceRange,
} from '@/types';

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

export class ReadWriteFactory extends ReadFactory {
  declare airlock: ReadWriteContract<AirlockABI>;

  constructor(address: Address, drift: Drift<ReadWriteAdapter>) {
    super(address, drift);
  }

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
    if (
      params.priceRange &&
      params.priceRange.startPrice <= params.priceRange.endPrice
    ) {
      throw new Error('Invalid price range');
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

  private computeTicks(priceRange: PriceRange, tickSpacing: number) {
    const startPriceString = parseEther(
      priceRange.startPrice.toString()
    ).toString();
    const endPriceString = parseEther(
      priceRange.endPrice.toString()
    ).toString();

    const minSqrtRatio = encodeSqrtRatioX96(WAD_STRING, startPriceString);
    const maxSqrtRatio = encodeSqrtRatioX96(WAD_STRING, endPriceString);

    const startTick = TickMath.getTickAtSqrtRatio(minSqrtRatio);
    const endTick = TickMath.getTickAtSqrtRatio(maxSqrtRatio);

    return {
      startTick: Math.floor(startTick / tickSpacing) * tickSpacing,
      endTick: Math.ceil(endTick / tickSpacing) * tickSpacing,
    };
  }

  // Computes optimal gamma parameter based on price range and time parameters
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

  public buildConfig(
    params: DopplerPreDeploymentConfig,
    addresses: DopplerV4Addresses
  ): {
    createParams: CreateParams;
    hook: Hex;
    token: Hex;
  } {
    this.validateBasicParams(params);

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

    const [salt, hook, token, poolInitializerData, tokenFactoryData] =
      this.mineHookAddress({
        airlock,
        poolManager,
        deployer: dopplerDeployer,
        initialSupply: params.totalSupply,
        numTokensToSell: params.numTokensToSell,
        numeraire:
          params.numeraire ?? '0x0000000000000000000000000000000000000000',
        tokenFactory,
        tokenFactoryData: tokenParams,
        poolInitializer: v4Initializer,
        poolInitializerData: dopplerParams,
      });

    const governanceFactoryData = encodeAbiParameters(
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
    );

    return {
      createParams: {
        initialSupply: params.totalSupply,
        numTokensToSell: params.numTokensToSell,
        numeraire:
          params.numeraire ?? '0x0000000000000000000000000000000000000000',
        tokenFactory,
        tokenFactoryData,
        governanceFactory: governanceFactory,
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
   * @param params Create parameters
   * @returns [salt, hook, token, poolInitializerData, tokenFactoryData]
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
   * Creates a new doppler token, hook, migrator, and governance
   * @param params Create parameters
   * @param options Optional contract write options
   * @returns Transaction hash
   */
  public async create(
    params: CreateParams,
    options?: TransactionOptions
  ): Promise<Hex> {
    return this.airlock.write('create', { createData: params }, options);
  }

  /**
   * Simulates a pool creation transaction
   * @param params Create parameters
   * @returns Simulation results
   */
  public async simulateCreate(
    params: CreateParams
  ): Promise<FunctionReturn<AirlockABI, 'create'>> {
    return this.airlock.simulateWrite('create', { createData: params });
  }

  /**
   * Migrates an asset's liquidity
   * @param asset The address of the asset to migrate
   * @param options Optional contract write options
   * @returns Transaction hash
   */
  public async migrate(
    asset: Address,
    options?: TransactionOptions
  ): Promise<Hex> {
    return this.airlock.write('migrate', { asset }, options);
  }
}
