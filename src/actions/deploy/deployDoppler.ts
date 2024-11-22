import { Doppler } from '../../entities/Doppler';
import { DeploymentConfig } from '../../types';
import { Token } from '@uniswap/sdk-core';
import {
  BaseError,
  ContractFunctionRevertedError,
  encodeAbiParameters,
  getContract,
  toHex,
  Hex,
} from 'viem';
import { Pool } from '@uniswap/v4-sdk';
import { DopplerAddressProvider } from '../../AddressProvider';
import { AirlockABI } from '../../abis/AirlockABI';
import { waitForTransactionReceipt } from 'viem/actions';
import { Clients } from '../../DopplerSDK';
import {
  fetchDopplerImmutables,
  fetchDopplerState,
} from '../../fetch/doppler/DopplerState';
import { fetchPoolState } from '../../fetch/doppler/PoolState';

/**
 * Represents a price range with start and end prices.
 */
export interface PriceRange {
  startPrice: number;
  endPrice: number;
}

/**
 * Parameters for configuring the Doppler deployment.
 */
export interface DopplerConfigParams {
  // Token details
  name: string;
  symbol: string;
  totalSupply: bigint;
  numTokensToSell: bigint;

  // Time parameters
  blockTimestamp: number;
  startTimeOffset: number; // in days from now
  duration: number; // in days
  epochLength: number; // in seconds

  // Price parameters
  priceRange: PriceRange;
  tickSpacing: number;
  fee: number; // In bips

  // Sale parameters
  minProceeds: bigint;
  maxProceeds: bigint;
  numPdSlugs?: number; // uses a default if not set
}

/**
 * Deploys a Doppler contract with the given configuration.
 * @param clients The clients for interacting with the blockchain.
 * @param addressProvider The address provider for Doppler addresses.
 * @param config The deployment configuration.
 * @returns The deployed Doppler instance.
 */
export async function deployDoppler(
  clients: Clients,
  addressProvider: DopplerAddressProvider,
  config: DeploymentConfig
): Promise<Doppler> {
  const { walletClient, publicClient } = clients;
  if (!walletClient?.account?.address || !walletClient?.chain?.id) {
    throw new Error('No wallet account found. Please connect a wallet first.');
  }

  const chainId = walletClient.chain.id;

  const {
    airlock,
    stateView,
    tokenFactory,
    governanceFactory,
    dopplerFactory,
    migrator,
  } = addressProvider.addresses;

  const dopplerFactoryData = encodeAbiParameters(
    [
      { name: 'minimumProceeds', type: 'uint256' },
      { name: 'maximumProceeds', type: 'uint256' },
      { name: 'startingTime', type: 'uint256' },
      { name: 'endingTime', type: 'uint256' },
      { name: 'startTick', type: 'int24' },
      { name: 'endTick', type: 'int24' },
      { name: 'epochLength', type: 'uint256' },
      { name: 'gamma', type: 'int24' },
      { name: 'isToken0', type: 'bool' },
      { name: 'numPDSlugs', type: 'uint256' },
      { name: 'airlock', type: 'address' },
    ],
    [
      config.hook.minProceeds,
      config.hook.maxProceeds,
      BigInt(config.hook.startTime),
      BigInt(config.hook.endTime),
      config.hook.startTick,
      config.hook.endTick,
      BigInt(config.hook.epochLength),
      config.hook.gamma,
      false,
      BigInt(config.hook.numPdSlugs),
      airlock,
    ]
  );

  const airlockContract = getContract({
    address: airlock,
    abi: AirlockABI,
    client: walletClient,
  });

  const poolKey = {
    ...config.poolKey,
    currency0: config.poolKey.currency0 as Hex,
    currency1: config.poolKey.currency1 as Hex,
    hooks: config.poolKey.hooks as Hex,
  };

  const currency0 = new Token(chainId, poolKey.currency0, 18);
  const currency1 = new Token(chainId, poolKey.currency1, 18);

  const poolId = Pool.getPoolId(
    currency0,
    currency1,
    poolKey.fee,
    poolKey.tickSpacing,
    poolKey.hooks
  ) as Hex;

  const createArgs = [
    config.token.name,
    config.token.symbol,
    config.token.totalSupply,
    config.token.totalSupply,
    poolKey,
    [] as Hex[],
    [] as bigint[],
    tokenFactory,
    toHex(''),
    governanceFactory,
    toHex(''),
    dopplerFactory,
    dopplerFactoryData,
    migrator,
    config.salt,
  ] as const;

  try {
    await airlockContract.simulate.create(createArgs);
  } catch (err) {
    if (err instanceof BaseError) {
      const revertError = err.walk(
        err => err instanceof ContractFunctionRevertedError
      );
      if (revertError instanceof ContractFunctionRevertedError) {
        const errorName = revertError.data?.errorName ?? '';
        if (errorName === 'DUPLICATE_POOL_KEY') {
          throw new Error('Pool key already exists');
        }
      }
    }
  }
  // TODO: this is a hack to get the timestamp of the block
  // where the airlock contract was deployed
  // TODO: find a better way to get the deployment block
  const createHash = await airlockContract.write.create(createArgs, {
    account: walletClient.account,
    chain: walletClient.chain,
  });
  await waitForTransactionReceipt(publicClient, {
    hash: createHash,
  });
  const { timestamp } = await publicClient.getBlock();

  const dopplerConfig = await fetchDopplerImmutables(
    config.dopplerAddress,
    publicClient
  );
  const dopplerState = await fetchDopplerState(
    config.dopplerAddress,
    publicClient
  );
  const poolState = await fetchPoolState(
    config.dopplerAddress,
    stateView,
    publicClient,
    poolId
  );

  const doppler = new Doppler({
    address: config.dopplerAddress,
    stateView,
    assetToken: config.hook.assetToken,
    quoteToken: config.hook.quoteToken,
    poolKey,
    poolId,
    config: dopplerConfig,
    state: dopplerState,
    timestamp,
    poolState,
  });

  return doppler;
}
