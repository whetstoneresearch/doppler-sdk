import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RehypeDopplerHook } from '../../../../src/evm/entities/auction/RehypeDopplerHook';
import {
  createMockPublicClient,
  createMockWalletClient,
} from '../../setup/fixtures/clients';
import {
  mockHookAddress,
  mockTokenAddress,
} from '../../setup/fixtures/addresses';

describe('RehypeDopplerHook', () => {
  let rehypeHook: RehypeDopplerHook;
  let publicClient: ReturnType<typeof createMockPublicClient>;
  let walletClient: ReturnType<typeof createMockWalletClient>;

  beforeEach(() => {
    publicClient = createMockPublicClient();
    walletClient = createMockWalletClient();
    rehypeHook = new RehypeDopplerHook(publicClient, walletClient, mockHookAddress);
  });

  it('collectFees decodes BalanceDelta and returns tx hash', async () => {
    const txHash =
      '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    const amount0 = 5n;
    const amount1 = -3n;
    const packedDelta =
      (BigInt.asIntN(128, amount0) << 128n) | BigInt.asUintN(128, amount1);

    vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
      request: {
        address: mockHookAddress,
        functionName: 'collectFees',
        args: [mockTokenAddress],
      },
      result: packedDelta,
    } as any);
    vi.mocked(walletClient.writeContract).mockResolvedValueOnce(
      txHash as `0x${string}`,
    );
    vi.mocked(publicClient.waitForTransactionReceipt).mockResolvedValueOnce(
      {} as any,
    );

    const result = await rehypeHook.collectFees(mockTokenAddress);
    expect(result.amount0).toBe(amount0);
    expect(result.amount1).toBe(amount1);
    expect(result.transactionHash).toBe(txHash);
  });

  it('claimAirlockOwnerFees returns claimed amounts', async () => {
    const txHash =
      '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

    vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
      request: {
        address: mockHookAddress,
        functionName: 'claimAirlockOwnerFees',
        args: [mockTokenAddress],
      },
      result: [11n, 22n],
    } as any);
    vi.mocked(walletClient.writeContract).mockResolvedValueOnce(
      txHash as `0x${string}`,
    );
    vi.mocked(publicClient.waitForTransactionReceipt).mockResolvedValueOnce(
      {} as any,
    );

    const result = await rehypeHook.claimAirlockOwnerFees(mockTokenAddress);
    expect(result.fees0).toBe(11n);
    expect(result.fees1).toBe(22n);
    expect(result.transactionHash).toBe(txHash);
  });

  it('getHookFees parses extended hook fee struct', async () => {
    vi.mocked(publicClient.readContract).mockResolvedValueOnce({
      fees0: 1n,
      fees1: 2n,
      beneficiaryFees0: 3n,
      beneficiaryFees1: 4n,
      airlockOwnerFees0: 5n,
      airlockOwnerFees1: 6n,
      customFee: 3000,
    } as any);

    const result = await rehypeHook.getHookFees(
      '0x1111111111111111111111111111111111111111111111111111111111111111',
    );
    expect(result).toEqual({
      fees0: 1n,
      fees1: 2n,
      beneficiaryFees0: 3n,
      beneficiaryFees1: 4n,
      airlockOwnerFees0: 5n,
      airlockOwnerFees1: 6n,
      customFee: 3000,
    });
  });
});
