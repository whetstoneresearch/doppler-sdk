import { BaseError, ContractFunctionRevertedError, Client, Hex } from 'viem';
import { simulateContract, writeContract } from 'viem/actions';
import { DopplerAddressProvider } from '../../AddressProvider';
import { CustomRouterABI } from '../../abis/CustomRouter';
import { Doppler } from '../../entities/Doppler/Doppler';

/**
 * Buys an asset with an exact input amount.
 * @param doppler The Doppler instance.
 * @param addressProvider The address provider for Doppler addresses.
 * @param amountIn The exact input amount.
 * @param client The client for interacting with the blockchain.
 * @returns A promise that resolves to the transaction hash.
 */
export async function buyAssetExactIn(
  doppler: Doppler,
  addressProvider: DopplerAddressProvider,
  amountIn: bigint,
  client: Client
): Promise<Hex> {
  const chain = client.chain;
  const account = client?.account;

  if (!account) {
    throw new Error('Account not found');
  }

  const customRouter = addressProvider.addresses.customRouter;

  try {
    await simulateContract(client, {
      address: customRouter,
      abi: CustomRouterABI,
      functionName: 'buyExactIn',
      value: amountIn,
      args: [
        {
          ...doppler.poolKey,
          currency0: doppler.poolKey.currency0 as Hex,
          currency1: doppler.poolKey.currency1 as Hex,
          hooks: doppler.poolKey.hooks as Hex,
        },
        amountIn,
      ],
    });
  } catch (err) {
    if (err instanceof BaseError) {
      const revertError = err.walk(
        err => err instanceof ContractFunctionRevertedError
      );
      if (revertError instanceof ContractFunctionRevertedError) {
        throw new Error(revertError.data?.errorName);
      }
    }
  }

  return writeContract(client, {
    chain,
    account,
    address: customRouter,
    abi: CustomRouterABI,
    functionName: 'buyExactIn',
    value: amountIn,
    args: [
      {
        ...doppler.poolKey,
        currency0: doppler.poolKey.currency0 as Hex,
        currency1: doppler.poolKey.currency1 as Hex,
        hooks: doppler.poolKey.hooks as Hex,
      },
      amountIn,
    ],
  });
}

/**
 * Buys an asset with an exact output amount.
 * @param doppler The Doppler instance.
 * @param addressProvider The address provider for Doppler addresses.
 * @param amountOut The exact output amount.
 * @param client The client for interacting with the blockchain.
 * @returns A promise that resolves to the transaction hash.
 */
export async function buyAssetExactOut(
  doppler: Doppler,
  addressProvider: DopplerAddressProvider,
  amountOut: bigint,
  client: Client
): Promise<Hex> {
  const chain = client.chain;
  const account = client?.account;
  const customRouter = addressProvider.addresses.customRouter;

  if (!account) {
    throw new Error('Account not found');
  }

  const { result: ethNeeded } = await simulateContract(client, {
    address: customRouter,
    abi: CustomRouterABI,
    functionName: 'computeBuyExactOut',
    args: [
      {
        ...doppler.poolKey,
        currency0: doppler.poolKey.currency0 as Hex,
        currency1: doppler.poolKey.currency1 as Hex,
        hooks: doppler.poolKey.hooks as Hex,
      },
      amountOut,
    ],
  });

  try {
    await simulateContract(client, {
      address: customRouter,
      abi: CustomRouterABI,
      functionName: 'buyExactOut',
      value: ethNeeded,
      args: [
        {
          ...doppler.poolKey,
          currency0: doppler.poolKey.currency0 as Hex,
          currency1: doppler.poolKey.currency1 as Hex,
          hooks: doppler.poolKey.hooks as Hex,
        },
        amountOut,
      ],
    });
  } catch (err) {
    if (err instanceof BaseError) {
      const revertError = err.walk(
        err => err instanceof ContractFunctionRevertedError
      );
      if (revertError instanceof ContractFunctionRevertedError) {
        const errorName = revertError.data?.errorName ?? '';
        throw new Error(errorName);
      }
    }
  }

  return writeContract(client, {
    chain,
    account,
    address: customRouter,
    abi: CustomRouterABI,
    functionName: 'buyExactOut',
    value: ethNeeded,
    args: [
      {
        ...doppler.poolKey,
        currency0: doppler.poolKey.currency0 as Hex,
        currency1: doppler.poolKey.currency1 as Hex,
        hooks: doppler.poolKey.hooks as Hex,
      },
      amountOut,
    ],
  });
}
