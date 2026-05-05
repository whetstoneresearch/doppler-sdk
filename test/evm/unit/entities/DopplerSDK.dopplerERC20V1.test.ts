import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Address, Hex, PublicClient } from 'viem';
import { DopplerSDK } from '../../../../src/evm/DopplerSDK';
import { DopplerERC20V1 } from '../../../../src/evm/entities/token/derc20/DopplerERC20V1';
import { CHAIN_IDS } from '../../../../src/evm/addresses';
import {
  createMockPublicClient,
  createMockWalletClient,
} from '../../setup/fixtures/clients';
import { mockTokenAddress } from '../../setup/fixtures/addresses';

describe('DopplerSDK DopplerERC20V1 helper', () => {
  let publicClient: PublicClient;
  let walletClient: ReturnType<typeof createMockWalletClient>;

  beforeEach(() => {
    publicClient = createMockPublicClient() as PublicClient;
    walletClient = createMockWalletClient();
  });

  it('returns a token wired to the SDK clients and address', async () => {
    const sdk = new DopplerSDK({
      publicClient,
      walletClient,
      chainId: CHAIN_IDS.BASE,
    });
    const token = sdk.getDopplerERC20V1(mockTokenAddress);

    expect(token).toBeInstanceOf(DopplerERC20V1);

    vi.mocked(publicClient.readContract).mockResolvedValueOnce('Token Name');
    vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
      request: {
        address: mockTokenAddress,
        abi: [],
        functionName: 'approve',
        args: ['0x2345678901234567890123456789012345678901', 1n],
      },
    } as never);
    vi.mocked(walletClient.writeContract).mockResolvedValueOnce(
      '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as Hex,
    );

    await expect(token.getName()).resolves.toBe('Token Name');
    await expect(
      token.approve(
        '0x2345678901234567890123456789012345678901' as Address,
        1n,
      ),
    ).resolves.toBe(
      '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    );

    expect(publicClient.readContract).toHaveBeenCalledWith({
      address: mockTokenAddress,
      abi: expect.any(Array),
      functionName: 'name',
    });
    expect(publicClient.simulateContract).toHaveBeenCalledWith({
      address: mockTokenAddress,
      abi: expect.any(Array),
      functionName: 'approve',
      args: ['0x2345678901234567890123456789012345678901', 1n],
      account: walletClient.account,
    });
    expect(walletClient.writeContract).toHaveBeenCalledWith({
      address: mockTokenAddress,
      abi: [],
      functionName: 'approve',
      args: ['0x2345678901234567890123456789012345678901', 1n],
    });
  });
});
