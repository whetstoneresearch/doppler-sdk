import type { Address, Hash, Hex, PublicClient, WalletClient } from 'viem';
import { LockablePoolStatus, type MulticurvePoolState } from '../../../types';
import type { ChainAddresses } from '../../../addresses';
import {
  dopplerHookInitializerAbi,
  v4MulticurveInitializerAbi,
} from '../../../abis';
import { computePoolId } from '../../../utils/poolKey';

export type MulticurveCollectedFees = {
  fees0: bigint;
  fees1: bigint;
  transactionHash: Hash;
};

type FeeCollectionClient = Pick<
  PublicClient,
  'simulateContract' | 'waitForTransactionReceipt'
>;

export async function collectMulticurveFees({
  client,
  walletClient,
  initializerAddress,
  state,
  addresses,
}: {
  client: FeeCollectionClient;
  walletClient: WalletClient;
  initializerAddress: Address;
  state: MulticurvePoolState;
  addresses: ChainAddresses;
}): Promise<MulticurveCollectedFees> {
  if (state.status === LockablePoolStatus.Locked) {
    const poolId = computePoolId(state.poolKey);
    const collectFeesAbi =
      initializerAddress === addresses.dopplerHookInitializer
        ? dopplerHookInitializerAbi
        : v4MulticurveInitializerAbi;
    return collectFeesFromContract({
      client,
      walletClient,
      contractAddress: initializerAddress,
      abi: collectFeesAbi,
      poolId,
    });
  }

  throw new Error('Multicurve pool is not locked or was migrated');
}

async function collectFeesFromContract({
  client,
  walletClient,
  contractAddress,
  abi,
  poolId,
}: {
  client: FeeCollectionClient;
  walletClient: WalletClient;
  contractAddress: Address;
  abi: typeof dopplerHookInitializerAbi | typeof v4MulticurveInitializerAbi;
  poolId: Hex;
}): Promise<MulticurveCollectedFees> {
  const { request, result } = await client.simulateContract({
    address: contractAddress,
    abi,
    functionName: 'collectFees',
    args: [poolId],
    account: walletClient.account,
  });

  const hash = await walletClient.writeContract(request);

  await client.waitForTransactionReceipt({ hash, confirmations: 1 });

  const [fees0, fees1] = result as readonly [bigint, bigint];

  return {
    fees0,
    fees1,
    transactionHash: hash,
  };
}
