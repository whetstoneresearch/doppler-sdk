import { Address, Hex } from 'viem';

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
}

/**
 * Parameters required for migrating an asset
 * @property asset Address of the asset to migrate
 */
export interface MigrateParams {
  asset: Address;
}
