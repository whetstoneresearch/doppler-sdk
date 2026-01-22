import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DopplerFactory } from '../../../src/entities/DopplerFactory';
import {
  createMockPublicClient,
  createMockWalletClient,
} from '../../setup/fixtures/clients';
import { mockAddresses } from '../../setup/fixtures/addresses';
import type { CreateStaticAuctionParams } from '../../../src/types';
import {
  parseEther,
  keccak256,
  toBytes,
  decodeErrorResult,
  type Address,
  type Hex,
} from 'viem';
import { airlockAbi } from '../../../src/abis';

vi.mock('../../../src/addresses', () => ({
  getAddresses: vi.fn(() => mockAddresses),
}));

describe('Tick Validation (Issue #34)', () => {
  let factory: DopplerFactory;
  let publicClient: ReturnType<typeof createMockPublicClient>;
  let walletClient: ReturnType<typeof createMockWalletClient>;

  const createValidStaticAuctionParams = (
    overrides?: Partial<CreateStaticAuctionParams['pool']>,
  ): CreateStaticAuctionParams => ({
    token: {
      name: 'Test Token',
      symbol: 'TEST',
      tokenURI: 'https://example.com/token',
    },
    sale: {
      initialSupply: parseEther('1000000000'),
      numTokensToSell: parseEther('900000000'),
      numeraire: '0x4200000000000000000000000000000000000006' as Address, // WETH on Base
    },
    pool: {
      startTick: 174960, // Aligned to tickSpacing 60
      endTick: 225000, // Aligned to tickSpacing 60
      fee: 3000,
      ...overrides,
    },
    governance: { type: 'default' },
    migration: { type: 'uniswapV2' },
    userAddress: '0x1234567890123456789012345678901234567890' as Address,
  });

  beforeEach(() => {
    publicClient = createMockPublicClient();
    walletClient = createMockWalletClient();
    factory = new DopplerFactory(publicClient, walletClient, 1);
  });

  describe('SDK validation catches misaligned ticks', () => {
    it('should reject startTick that is not aligned to tickSpacing', async () => {
      const params = createValidStaticAuctionParams({
        startTick: 175000, // NOT aligned: 175000 % 60 = 40
        endTick: 225000,
        fee: 3000,
      });

      await expect(
        factory.encodeCreateStaticAuctionParams(params),
      ).rejects.toThrow(
        'Pool ticks must be multiples of tick spacing 60 for fee tier 3000',
      );
    });

    it('should reject endTick that is not aligned to tickSpacing', async () => {
      const params = createValidStaticAuctionParams({
        startTick: 174960, // Aligned
        endTick: 225001, // NOT aligned: 225001 % 60 = 1
        fee: 3000,
      });

      await expect(
        factory.encodeCreateStaticAuctionParams(params),
      ).rejects.toThrow(
        'Pool ticks must be multiples of tick spacing 60 for fee tier 3000',
      );
    });

    it('should accept ticks that are properly aligned to tickSpacing', async () => {
      const params = createValidStaticAuctionParams({
        startTick: 174960, // Aligned: 174960 % 60 = 0
        endTick: 225000, // Aligned: 225000 % 60 = 0
        fee: 3000,
      });

      // Should not throw - validation passes
      // Note: Will fail at simulation since we're using mocks, but validation should pass
      publicClient.simulateContract.mockResolvedValueOnce({
        result: [
          '0xfaaa000000000000000000000000000000000001' as Address,
          '0xbbbb000000000000000000000000000000000002' as Address,
        ],
        request: {},
      } as any);

      await expect(
        factory.encodeCreateStaticAuctionParams(params),
      ).resolves.toBeDefined();
    });

    it('should validate different fee tiers with correct tick spacing', async () => {
      // Fee 500 has tickSpacing 10
      const params500 = createValidStaticAuctionParams({
        startTick: 174965, // NOT aligned to 10: 174965 % 10 = 5
        endTick: 225000,
        fee: 500,
      });

      await expect(
        factory.encodeCreateStaticAuctionParams(params500),
      ).rejects.toThrow(
        'Pool ticks must be multiples of tick spacing 10 for fee tier 500',
      );

      // Fee 10000 has tickSpacing 200
      const params10000 = createValidStaticAuctionParams({
        startTick: 174960, // NOT aligned to 200: 174960 % 200 = 160
        endTick: 225000,
        fee: 10000,
      });

      await expect(
        factory.encodeCreateStaticAuctionParams(params10000),
      ).rejects.toThrow(
        'Pool ticks must be multiples of tick spacing 200 for fee tier 10000',
      );
    });
  });

  describe('Error signature decoding', () => {
    it('should have InvalidTickRange error in airlockAbi', () => {
      // Calculate the expected error selector
      const expectedSelector = keccak256(
        toBytes('InvalidTickRange(int24,int24)'),
      ).slice(0, 10);
      expect(expectedSelector).toBe('0x5bbbea32');

      // Verify the error is in the ABI
      const invalidTickRangeError = airlockAbi.find(
        (item) => item.type === 'error' && item.name === 'InvalidTickRange',
      );
      expect(invalidTickRangeError).toBeDefined();
      expect(invalidTickRangeError?.inputs).toHaveLength(2);
    });

    it('should decode InvalidTickRange error from raw bytes', () => {
      // This is the actual error from issue #34:
      // 0x5bbbea32 + tick (175000) + tickSpacing (60)
      const errorData =
        '0x5bbbea32000000000000000000000000000000000000000000000000000000000002ab98000000000000000000000000000000000000000000000000000000000000003c' as Hex;

      const decoded = decodeErrorResult({
        abi: airlockAbi,
        data: errorData,
      });

      expect(decoded.errorName).toBe('InvalidTickRange');
      expect(decoded.args).toHaveLength(2);
      expect(decoded.args?.[0]).toBe(175000); // tick
      expect(decoded.args?.[1]).toBe(60); // tickSpacing
    });

    it('should decode InvalidTickRangeMisordered error', () => {
      const invalidTickRangeMisorderedError = airlockAbi.find(
        (item) =>
          item.type === 'error' && item.name === 'InvalidTickRangeMisordered',
      );
      expect(invalidTickRangeMisorderedError).toBeDefined();
    });

    it('should decode InvalidFee error', () => {
      const invalidFeeError = airlockAbi.find(
        (item) => item.type === 'error' && item.name === 'InvalidFee',
      );
      expect(invalidFeeError).toBeDefined();
      expect(invalidFeeError?.inputs).toHaveLength(1);
    });
  });

  describe('Tick alignment math', () => {
    it('should correctly identify aligned vs misaligned ticks', () => {
      const tickSpacing = 60; // for fee 3000

      // These should be aligned
      expect(174960 % tickSpacing).toBe(0);
      expect(225000 % tickSpacing).toBe(0);
      expect(0 % tickSpacing).toBe(0);
      expect(Math.abs(-174960 % tickSpacing)).toBe(0);

      // These should NOT be aligned
      expect(175000 % tickSpacing).toBe(40);
      expect(225001 % tickSpacing).toBe(1);
      expect(1 % tickSpacing).toBe(1);
    });
  });
});
