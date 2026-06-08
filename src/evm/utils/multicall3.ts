import {
  decodeFunctionResult,
  encodeFunctionData,
  multicall3Abi,
  type Address,
  type Hex,
  zeroAddress,
} from 'viem';

export type Aggregate3Call = {
  target: Address;
  allowFailure: boolean;
  callData: Hex;
};

export type Aggregate3Result = {
  success: boolean;
  returnData: Hex;
};

export type Multicall3Client = {
  chain?: {
    contracts?: {
      multicall3?: {
        address?: Address;
      };
    };
  };
  call(request: { to: Address; data: Hex }): Promise<{ data?: Hex }>;
};

export function getMulticall3Address(
  client: Pick<Multicall3Client, 'chain'>,
): Address {
  const multicall3Address = client.chain?.contracts?.multicall3?.address;
  if (!multicall3Address || multicall3Address === zeroAddress) {
    throw new Error(
      'Multicall3 address is not configured on this chain. ' +
        'Configure the viem chain multicall3 contract before previewing pending fees.',
    );
  }

  return multicall3Address;
}

export async function callAggregate3(
  client: Multicall3Client,
  calls: readonly Aggregate3Call[],
): Promise<readonly Aggregate3Result[]> {
  const response = await client.call({
    to: getMulticall3Address(client),
    data: encodeFunctionData({
      abi: multicall3Abi,
      functionName: 'aggregate3',
      args: [calls],
    }),
  });

  if (!response.data) {
    throw new Error('Multicall3 aggregate3 returned no data');
  }

  return decodeFunctionResult({
    abi: multicall3Abi,
    functionName: 'aggregate3',
    data: response.data,
  });
}
