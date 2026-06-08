import { describe, expect, it, vi } from 'vitest';
import {
  decodeFunctionData,
  encodeFunctionResult,
  multicall3Abi,
  type Address,
  type Chain,
  type Hex,
} from 'viem';
import { mainnet } from 'viem/chains';
import {
  callAggregate3,
  getMulticall3Address,
  type Aggregate3Call,
  type Multicall3Client,
} from '@/utils/multicall3';

type MockMulticall3Client = Omit<Multicall3Client, 'call'> & {
  call: ReturnType<typeof vi.fn<Multicall3Client['call']>>;
};

const target = '0x1234567890123456789012345678901234567890' as Address;
const callData = '0x1234' as Hex;
const returnData = '0xabcd' as Hex;

function createMockClient(chain: Chain = mainnet): MockMulticall3Client {
  return {
    chain,
    call: vi.fn<Multicall3Client['call']>(),
  };
}

describe('multicall3 utilities', () => {
  describe('getMulticall3Address', () => {
    it('returns the configured chain Multicall3 address', () => {
      const client = createMockClient();

      expect(getMulticall3Address(client)).toBe(
        mainnet.contracts.multicall3.address,
      );
    });

    it('throws when multicall3 is not configured', () => {
      const client = createMockClient({
        ...mainnet,
        contracts: {},
      });

      expect(() => getMulticall3Address(client)).toThrow(
        'Multicall3 address is not configured on this chain',
      );
    });
  });

  describe('callAggregate3', () => {
    it('calls aggregate3 with encoded calls', async () => {
      const client = createMockClient();
      const calls: readonly Aggregate3Call[] = [
        {
          target,
          allowFailure: true,
          callData,
        },
      ];
      const aggregateResults = [{ success: true, returnData }] as const;
      client.call.mockResolvedValueOnce({
        data: encodeFunctionResult({
          abi: multicall3Abi,
          functionName: 'aggregate3',
          result: aggregateResults,
        }),
      });

      const result = await callAggregate3(client, calls);

      expect(result).toEqual(aggregateResults);
      expect(client.call).toHaveBeenCalledTimes(1);
      const [request] = client.call.mock.calls[0]!;
      expect(request.to).toBe(mainnet.contracts.multicall3.address);
      const decoded = decodeFunctionData({
        abi: multicall3Abi,
        data: request.data,
      });
      expect(decoded.functionName).toBe('aggregate3');
      expect(decoded.args[0]).toEqual(calls);
    });

    it('throws when multicall3 is not configured', async () => {
      const client = createMockClient({
        ...mainnet,
        contracts: {},
      });

      await expect(callAggregate3(client, [])).rejects.toThrow(
        'Multicall3 address is not configured on this chain',
      );
    });

    it('throws when aggregate3 returns no data', async () => {
      const client = createMockClient();
      client.call.mockResolvedValueOnce({});

      await expect(callAggregate3(client, [])).rejects.toThrow(
        'Multicall3 aggregate3 returned no data',
      );
    });
  });
});
