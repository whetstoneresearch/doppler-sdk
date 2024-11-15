import { DopplerABI } from '../abis/DopplerABI';
import { DopplerState } from '../types';
import { Address, Client, keccak256, encodePacked } from 'viem';
import { getChainId, readContract } from 'viem/actions';
import { DopplerAddressProvider } from '../AddressProvider';
import { StateViewABI } from '../abis/StateViewABI';

export type ViewOverrides = {
  blockNumber?: bigint;
  blockTag?: 'latest' | 'earliest' | 'pending' | 'safe' | 'finalized';
};

export type FetchDopplerStateParams = {
  chainId?: number;
  overrides?: ViewOverrides;
};

export async function fetchDopplerState(
  dopplerAddress: Address,
  poolId: `0x${string}`,
  addressProvider: DopplerAddressProvider,
  client: Client,
  { chainId, overrides = {} }: FetchDopplerStateParams = {}
): Promise<DopplerState> {
  // Ensure we have the chain ID
  chainId = chainId ?? (await getChainId(client));

  const poolManager = addressProvider.getAddresses().poolManager;

  const [state, poolState] = await Promise.all([
    readContract(client, {
      ...overrides,
      address: dopplerAddress,
      abi: DopplerABI,
      functionName: 'state',
    }),
    readContract(client, {
      ...overrides,
      address: poolManager,
      abi: StateViewABI,
      functionName: 'getSlot0',
      args: [poolId],
    })
  ]);


  // Process the fees data
  const feesAccrued = state[5];
  const amount0 = feesAccrued >> BigInt(128);
  const amount1 = feesAccrued & ((BigInt(1) << BigInt(128)) - BigInt(1));


  // Return a well-structured state object
  return {
    currentTick: poolState[1],
    lastEpoch: state[0],
    tickAccumulator: state[1],
    totalTokensSold: state[2],
    totalProceeds: state[3],
    totalTokensSoldLastEpoch: state[4],
    feesAccrued: { amount0, amount1 },
  };
}
