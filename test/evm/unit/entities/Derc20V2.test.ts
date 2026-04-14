import { describe, it, expect, beforeEach, vi } from 'vitest';
import { parseEther, type Address } from 'viem';
import { Derc20V2 } from '../../../../src/evm/entities/token/derc20/Derc20V2';
import {
  createMockPublicClient,
  createMockWalletClient,
} from '../../setup/fixtures/clients';
import { mockTokenAddress } from '../../setup/fixtures/addresses';

describe('Derc20V2', () => {
  let derc20V2: Derc20V2;
  let publicClient: ReturnType<typeof createMockPublicClient>;
  let walletClient: ReturnType<typeof createMockWalletClient>;

  const beneficiary = '0x1234567890123456789012345678901234567890' as Address;

  beforeEach(() => {
    publicClient = createMockPublicClient();
    walletClient = createMockWalletClient();
    derc20V2 = new Derc20V2(publicClient, walletClient, mockTokenAddress);
  });

  it('reads the vesting schedule count', async () => {
    vi.mocked(publicClient.readContract).mockResolvedValueOnce(2n);

    await expect(derc20V2.getVestingScheduleCount()).resolves.toBe(2n);
    expect(publicClient.readContract).toHaveBeenCalledWith({
      address: mockTokenAddress,
      abi: expect.any(Array),
      functionName: 'vestingScheduleCount',
    });
  });

  it('reads an individual vesting schedule', async () => {
    vi.mocked(publicClient.readContract).mockResolvedValueOnce([90n, 180n] as any);

    await expect(derc20V2.getVestingSchedule(0n)).resolves.toEqual({
      cliffDuration: 90n,
      duration: 180n,
    });
    expect(publicClient.readContract).toHaveBeenCalledWith({
      address: mockTokenAddress,
      abi: expect.any(Array),
      functionName: 'vestingSchedules',
      args: [0n],
    });
  });

  it('reads schedule ids for a beneficiary', async () => {
    vi.mocked(publicClient.readContract).mockResolvedValueOnce([0n, 1n] as any);

    await expect(derc20V2.getScheduleIdsOf(beneficiary)).resolves.toEqual([
      0n,
      1n,
    ]);
    expect(publicClient.readContract).toHaveBeenCalledWith({
      address: mockTokenAddress,
      abi: expect.any(Array),
      functionName: 'getScheduleIdsOf',
      args: [beneficiary],
    });
  });

  it('reads the total allocated amount for a beneficiary', async () => {
    const allocated = parseEther('100000');
    vi.mocked(publicClient.readContract).mockResolvedValueOnce(allocated);

    await expect(derc20V2.getTotalAllocatedOf(beneficiary)).resolves.toBe(
      allocated,
    );
    expect(publicClient.readContract).toHaveBeenCalledWith({
      address: mockTokenAddress,
      abi: expect.any(Array),
      functionName: 'totalAllocatedOf',
      args: [beneficiary],
    });
  });

  it('reads the vested amount available for a schedule', async () => {
    const available = parseEther('1234');
    vi.mocked(publicClient.readContract).mockResolvedValueOnce(available);

    await expect(
      derc20V2.getAvailableVestedAmountForSchedule(beneficiary, 0n),
    ).resolves.toBe(available);
    expect(publicClient.readContract).toHaveBeenCalledWith({
      address: mockTokenAddress,
      abi: expect.any(Array),
      functionName: 'computeAvailableVestedAmount',
      args: [beneficiary, 0n],
    });
  });

  it('reads vesting data for a schedule', async () => {
    const totalAmount = parseEther('10000');
    const releasedAmount = parseEther('2500');
    vi.mocked(publicClient.readContract).mockResolvedValueOnce([
      totalAmount,
      releasedAmount,
    ] as any);

    await expect(
      derc20V2.getVestingDataForSchedule(beneficiary, 0n),
    ).resolves.toEqual({
      totalAmount,
      releasedAmount,
    });
    expect(publicClient.readContract).toHaveBeenCalledWith({
      address: mockTokenAddress,
      abi: expect.any(Array),
      functionName: 'vestingOf',
      args: [beneficiary, 0n],
    });
  });

  it('releases vested tokens for the caller under a schedule', async () => {
    const txHash =
      '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

    vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
      request: {
        address: mockTokenAddress,
        functionName: 'release',
        args: [0n],
      },
    } as any);
    vi.mocked(walletClient.writeContract).mockResolvedValueOnce(
      txHash as `0x${string}`,
    );

    await expect(derc20V2.releaseSchedule(0n)).resolves.toBe(txHash);
    expect(publicClient.simulateContract).toHaveBeenCalledWith({
      address: mockTokenAddress,
      abi: expect.any(Array),
      functionName: 'release',
      args: [0n],
      account: walletClient.account,
    });
  });

  it('releases all vested tokens for a beneficiary', async () => {
    const txHash =
      '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

    vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
      request: {
        address: mockTokenAddress,
        functionName: 'releaseFor',
        args: [beneficiary],
      },
    } as any);
    vi.mocked(walletClient.writeContract).mockResolvedValueOnce(
      txHash as `0x${string}`,
    );

    await expect(derc20V2.releaseFor(beneficiary)).resolves.toBe(txHash);
    expect(publicClient.simulateContract).toHaveBeenCalledWith({
      address: mockTokenAddress,
      abi: expect.any(Array),
      functionName: 'releaseFor',
      args: [beneficiary],
      account: walletClient.account,
    });
  });

  it('releases vested tokens for a beneficiary under a specific schedule', async () => {
    const txHash =
      '0xfedcfedcfedcfedcfedcfedcfedcfedcfedcfedcfedcfedcfedcfedcfedcfedc';

    vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
      request: {
        address: mockTokenAddress,
        functionName: 'releaseFor',
        args: [beneficiary, 1n],
      },
    } as any);
    vi.mocked(walletClient.writeContract).mockResolvedValueOnce(
      txHash as `0x${string}`,
    );

    await expect(derc20V2.releaseFor(beneficiary, 1n)).resolves.toBe(txHash);
    expect(publicClient.simulateContract).toHaveBeenCalledWith({
      address: mockTokenAddress,
      abi: expect.any(Array),
      functionName: 'releaseFor',
      args: [beneficiary, 1n],
      account: walletClient.account,
    });
  });

  it('throws on write methods without a wallet client', async () => {
    const readOnly = new Derc20V2(publicClient, undefined, mockTokenAddress);

    await expect(readOnly.releaseSchedule(0n)).rejects.toThrow(
      'Wallet client required for write operations',
    );
    await expect(readOnly.releaseFor(beneficiary)).rejects.toThrow(
      'Wallet client required for write operations',
    );
  });
});
