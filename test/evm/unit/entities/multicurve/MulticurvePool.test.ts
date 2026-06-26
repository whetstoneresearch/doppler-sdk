import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MulticurvePool } from '@/entities/auction/MulticurvePool';
import {
  createMockPublicClient,
  createMockWalletClient,
} from '@test/setup/fixtures/clients';
import { mockAddresses } from '@test/setup/fixtures/addresses';
import { type Address } from 'viem';
import { LockablePoolStatus } from '@/types';

vi.mock('@/addresses', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/addresses')>();
  return {
    ...actual,
    getAddresses: vi.fn(() => mockAddresses),
  };
});

type MockPublicClient = ReturnType<typeof createMockPublicClient> & {
  readContract: ReturnType<typeof vi.fn>;
};

describe('MulticurvePool', () => {
  const mockTokenAddress =
    '0x1234567890123456789012345678901234567890' as Address;
  const mockNumeraire = '0x4200000000000000000000000000000000000006' as Address;
  const mockHook = '0xcccccccccccccccccccccccccccccccccccccccc' as Address;
  const mockPoolKey = {
    currency0: mockTokenAddress,
    currency1: mockNumeraire,
    fee: 3000,
    tickSpacing: 60,
    hooks: mockHook,
  };
  const mockFarTick = 120;
  const defaultAddresses = {
    ...mockAddresses,
  };

  let publicClient: MockPublicClient;
  let walletClient: ReturnType<typeof createMockWalletClient>;
  let multicurvePool: MulticurvePool;

  beforeEach(async () => {
    publicClient = createMockPublicClient() as MockPublicClient;
    walletClient = createMockWalletClient();
    multicurvePool = new MulticurvePool(
      publicClient,
      walletClient,
      mockTokenAddress,
    );
    vi.clearAllMocks();
    // Reset getAddresses mock to default behavior
    const { getAddresses } = await import('@/addresses');
    vi.mocked(getAddresses).mockReturnValue(defaultAddresses as any);
  });

  describe('getTokenAddress', () => {
    it('should return the token address', () => {
      expect(multicurvePool.getTokenAddress()).toBe(mockTokenAddress);
    });
  });

  describe('getNumeraireAddress', () => {
    it('should return the numeraire address from state', async () => {
      // DopplerHookInitializer state layout:
      // [0]=numeraire, [4]=status, [5]=poolKey, [6]=farTick
      vi.mocked(publicClient.readContract).mockResolvedValueOnce([
        mockNumeraire,
        0n,
        mockHook,
        '0x',
        LockablePoolStatus.Initialized,
        mockPoolKey,
        mockFarTick,
      ] as any);

      const numeraireAddress = await multicurvePool.getNumeraireAddress();

      expect(numeraireAddress).toBe(mockNumeraire);
    });
  });
});
