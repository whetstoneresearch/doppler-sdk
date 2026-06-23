import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContractFunctionRevertedError } from 'viem';
import { v4MulticurveInitializerAbi } from '@/abis';
import { DYNAMIC_FEE_FLAG } from '@/constants';
import { LockablePoolStatus } from '@/types';
import { mockAddresses } from '@test/setup/fixtures/addresses';
import {
  createAbsentPoolDiscoveryError,
  createMulticurvePoolHarness,
  createState,
  createZeroState,
  defaultAddresses,
  mockFarTick,
  mockNumeraire,
  mockPoolKey,
  mockRehypeHook,
  mockTokenAddress,
  type MockPublicClient,
} from './multicurvePoolTestHelpers';
import type { MulticurvePool } from '@/entities/auction/MulticurvePool';

vi.mock('@/addresses', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/addresses')>();
  return {
    ...actual,
    getAddresses: vi.fn(() => mockAddresses),
  };
});

describe('MulticurvePool initializer discovery', () => {
  let publicClient: MockPublicClient;
  let multicurvePool: MulticurvePool;

  beforeEach(async () => {
    ({ publicClient, multicurvePool } = await createMulticurvePoolHarness());
  });

  it('fetches and returns pool state', async () => {
    vi.mocked(publicClient.readContract).mockResolvedValueOnce(createState());

    const state = await multicurvePool.getState();

    expect(state).toEqual({
      asset: mockTokenAddress,
      numeraire: mockNumeraire,
      fee: 3000,
      tickSpacing: 60,
      status: LockablePoolStatus.Initialized,
      poolKey: mockPoolKey,
      farTick: mockFarTick,
    });
    expect(publicClient.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: mockAddresses.dopplerHookInitializer,
        functionName: 'getState',
        args: [mockTokenAddress],
      }),
    );
  });

  it('throws if no initializer addresses are configured', async () => {
    const { getAddresses } = await import('@/addresses');
    vi.mocked(getAddresses).mockReturnValue({
      ...defaultAddresses,
      dopplerHookInitializer: undefined,
    });

    await expect(multicurvePool.getState()).rejects.toThrow(
      'No V4 multicurve initializer addresses configured for this chain',
    );
  });

  it('throws with tried initializers when an absent-pool custom error reverts discovery', async () => {
    vi.mocked(publicClient.readContract).mockRejectedValueOnce(
      createAbsentPoolDiscoveryError(),
    );

    await expect(multicurvePool.getState()).rejects.toThrow(
      `Pool not found for token ${mockTokenAddress}. Tried initializers:`,
    );
    expect(publicClient.readContract).toHaveBeenCalledTimes(1);
    expect(publicClient.readContract).toHaveBeenLastCalledWith(
      expect.objectContaining({
        address: mockAddresses.dopplerHookInitializer,
      }),
    );
  });

  it('throws with tried initializers after a zero-state absence', async () => {
    vi.mocked(publicClient.readContract).mockResolvedValueOnce(
      createZeroState(),
    );

    await expect(multicurvePool.getState()).rejects.toThrow(
      `Pool not found for token ${mockTokenAddress}. Tried initializers:`,
    );
    expect(publicClient.readContract).toHaveBeenCalledTimes(1);
  });

  it('preserves provider failures during initializer discovery', async () => {
    vi.mocked(publicClient.readContract).mockRejectedValueOnce(
      new Error('HTTP request failed'),
    );

    await expect(multicurvePool.getState()).rejects.toThrow(
      'HTTP request failed',
    );
    expect(publicClient.readContract).toHaveBeenCalledTimes(1);
  });

  it('preserves selector or decode failures', async () => {
    vi.mocked(publicClient.readContract).mockRejectedValueOnce(
      new Error('Unknown function selector'),
    );

    await expect(multicurvePool.getState()).rejects.toThrow(
      'Unknown function selector',
    );
    expect(publicClient.readContract).toHaveBeenCalledTimes(1);
  });

  it('preserves structured contract reverts during initializer discovery', async () => {
    vi.mocked(publicClient.readContract).mockRejectedValueOnce(
      new ContractFunctionRevertedError({
        abi: v4MulticurveInitializerAbi,
        functionName: 'getState',
        message: 'Pool storage corrupted',
      }),
    );

    await expect(multicurvePool.getState()).rejects.toThrow(
      'Pool storage corrupted',
    );
    expect(publicClient.readContract).toHaveBeenCalledTimes(1);
  });

  it('throws with tried initializers when pool is not found', async () => {
    vi.mocked(publicClient.readContract).mockResolvedValue(createZeroState());

    await expect(multicurvePool.getState()).rejects.toThrow(
      `Pool not found for token ${mockTokenAddress}. Tried initializers:`,
    );
  });

  it('aggregates absent-pool failures when the candidate reverts', async () => {
    vi.mocked(publicClient.readContract).mockRejectedValueOnce(
      createAbsentPoolDiscoveryError(),
    );

    try {
      await multicurvePool.getState();
      throw new Error('Expected getState to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain(
        `Pool not found for token ${mockTokenAddress}. Tried initializers:`,
      );

      const aggregate = (error as { cause?: { errors?: unknown[] } }).cause;
      expect(aggregate?.errors).toHaveLength(1);
      const messages = (aggregate?.errors ?? []).map(
        (entry) => (entry as Error).message,
      );
      expect(messages[0]).toContain(
        `${mockAddresses.dopplerHookInitializer} getState failed:`,
      );
      expect(messages[0]).toContain('PoolNotInitialized');
    }
  });

  it('decodes pool state from DopplerHookInitializer using the rehype layout', async () => {
    vi.mocked(publicClient.readContract).mockResolvedValueOnce([
      mockNumeraire,
      400000n,
      mockRehypeHook,
      '0x1234',
      LockablePoolStatus.Locked,
      {
        currency0: mockTokenAddress,
        currency1: mockNumeraire,
        fee: DYNAMIC_FEE_FLAG,
        tickSpacing: 60,
        hooks: mockAddresses.dopplerHookInitializer,
      },
      mockFarTick,
    ]);

    const state = await multicurvePool.getState();

    expect(state).toEqual({
      asset: mockTokenAddress,
      numeraire: mockNumeraire,
      fee: DYNAMIC_FEE_FLAG,
      tickSpacing: 60,
      status: LockablePoolStatus.Locked,
      poolKey: {
        currency0: mockTokenAddress,
        currency1: mockNumeraire,
        fee: DYNAMIC_FEE_FLAG,
        tickSpacing: 60,
        hooks: mockAddresses.dopplerHookInitializer,
      },
      farTick: mockFarTick,
    });
    expect(publicClient.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: mockAddresses.dopplerHookInitializer,
        functionName: 'getState',
        args: [mockTokenAddress],
      }),
    );
  });
});
