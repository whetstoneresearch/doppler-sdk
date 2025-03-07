import {
  ReadWriteContract,
  ReadWriteAdapter,
  Drift,
  ContractWriteOptions,
  OnMinedParam,
} from '@delvtech/drift';
import { ReadFactory, AirlockABI } from './ReadFactory';
import {Address, encodeAbiParameters, Hex} from 'viem';

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
 * Parameters required for creating a new Doppler V4 pool
 * @property initialSupply - The initial supply of the pool
 * @property numTokensToSell - The number of tokens to sell
 * @property numeraire Address of the numéraire token
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
  hook: Hex;
  token: Hex;
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

export class ReadWriteFactory extends ReadFactory {
  declare airlock: ReadWriteContract<AirlockABI>;

  constructor(address: Address, drift: Drift<ReadWriteAdapter>) {
    super(address, drift);
  }

  public async create(
    params: CreateParams,
    options?: ContractWriteOptions & OnMinedParam
  ): Promise<Hex> {
    return this.airlock.write('create', { createData: params }, options);
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
}
