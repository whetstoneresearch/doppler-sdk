import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DopplerFactory } from '../../../src/entities/DopplerFactory';
import { DynamicAuctionBuilder } from '../../../src/builders';
import {
  createMockPublicClient,
  createMockWalletClient,
  createMockTransactionReceipt,
  createMockTransactionReceiptWithCreateEvent,
} from '../../setup/fixtures/clients';
import {
  mockAddresses,
  mockHookAddress,
  mockTokenAddress,
  mockPoolAddress,
} from '../../setup/fixtures/addresses';
import type {
  CreateStaticAuctionParams,
  CreateDynamicAuctionParams,
  CreateMulticurveParams,
} from '../../../src/types';
import {
  parseEther,
  decodeAbiParameters,
  encodeAbiParameters,
  keccak256,
  type Address,
} from 'viem';
import { MAX_TICK, isToken0Expected } from '../../../src/utils';
import {
  DAY_SECONDS,
  DYNAMIC_FEE_FLAG,
  DECAY_MAX_START_FEE,
  ZERO_ADDRESS,
} from '../../../src/constants';

vi.mock('../../../src/addresses', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../src/addresses')>();
  return {
    ...actual,
    getAddresses: vi.fn(() => mockAddresses),
  };
});

describe('DopplerFactory', () => {
  let factory: DopplerFactory;
  let publicClient: ReturnType<typeof createMockPublicClient>;
  let walletClient: ReturnType<typeof createMockWalletClient>;

  beforeEach(() => {
    publicClient = createMockPublicClient();
    walletClient = createMockWalletClient();
    factory = new DopplerFactory(publicClient, walletClient, 1); // mainnet
  });

  describe('encodeCreateMulticurveParams', () => {
    const multicurveParams = (): CreateMulticurveParams => ({
      token: {
        name: 'MC Token',
        symbol: 'MCT',
        tokenURI: 'https://example.com/mc-token',
      },
      sale: {
        initialSupply: parseEther('1000000'),
        numTokensToSell: parseEther('400000'),
        numeraire: mockAddresses.weth,
      },
      pool: {
        fee: 3000,
        tickSpacing: 60,
        curves: [
          {
            tickLower: -140000,
            tickUpper: -70000,
            numPositions: 8,
            shares: parseEther('0.6'),
          },
          {
            tickLower: -90000,
            tickUpper: -50000,
            numPositions: 4,
            shares: parseEther('0.3'),
          },
        ],
      },
      governance: { type: 'default' },
      migration: { type: 'uniswapV2' },
      userAddress: '0x1234567890123456789012345678901234567890' as Address,
    });

    it('appends a fallback curve when shares total less than 100%', () => {
      const params = multicurveParams();
      const createParams = factory.encodeCreateMulticurveParams(params);

      // Basic UniswapV4MulticurveInitializer expects 4-field InitData struct
      const [poolInitData] = decodeAbiParameters(
        [
          {
            type: 'tuple',
            components: [
              { name: 'fee', type: 'uint24' },
              { name: 'tickSpacing', type: 'int24' },
              {
                name: 'curves',
                type: 'tuple[]',
                components: [
                  { name: 'tickLower', type: 'int24' },
                  { name: 'tickUpper', type: 'int24' },
                  { name: 'numPositions', type: 'uint16' },
                  { name: 'shares', type: 'uint256' },
                ],
              },
              {
                name: 'beneficiaries',
                type: 'tuple[]',
                components: [
                  { name: 'beneficiary', type: 'address' },
                  { name: 'shares', type: 'uint96' },
                ],
              },
            ],
          },
        ],
        createParams.poolInitializerData,
      ) as any;

      const curves = poolInitData.curves as Array<{
        tickLower: bigint;
        tickUpper: bigint;
        numPositions: number | bigint;
        shares: bigint;
      }>;
      const tickSpacing = Number(poolInitData.tickSpacing);
      expect(curves).toHaveLength(params.pool.curves.length + 1);

      const fallback = curves[curves.length - 1];
      const expectedShare =
        parseEther('1') -
        params.pool.curves.reduce((acc, curve) => acc + curve.shares, 0n);
      const expectedTickUpper =
        Math.floor(MAX_TICK / tickSpacing) * tickSpacing;
      const mostPositiveTickUpper = params.pool.curves.reduce(
        (max, curve) => Math.max(max, curve.tickUpper),
        params.pool.curves[0]!.tickUpper,
      );

      expect(fallback.shares).toBe(expectedShare);
      expect(Number(fallback.tickLower)).toBe(mostPositiveTickUpper);
      expect(Number(fallback.tickUpper)).toBe(expectedTickUpper);
      expect(Number(fallback.numPositions)).toBe(
        params.pool.curves[params.pool.curves.length - 1]!.numPositions,
      );
    });

    it('allows curves with non-positive ticks', () => {
      const params = multicurveParams();
      params.pool.curves = [
        {
          tickLower: -120000,
          tickUpper: 0,
          numPositions: 2,
          shares: parseEther('0.5'),
        },
      ];

      // Non-positive ticks are valid - tick sign depends on price ratio
      expect(() => factory.encodeCreateMulticurveParams(params)).not.toThrow();
    });

    it('encodes decay multicurve params with decay initializer', () => {
      const params = multicurveParams();
      params.initializer = {
        type: 'decay',
        startTime: 1_800_000_000,
        startFee: 5_000,
        durationSeconds: 86_400,
      };

      const createParams = factory.encodeCreateMulticurveParams(params);
      expect(createParams.poolInitializer).toBe(
        mockAddresses.v4DecayMulticurveInitializer,
      );

      const [decoded] = decodeAbiParameters(
        [
          {
            type: 'tuple',
            components: [
              { name: 'startFee', type: 'uint24' },
              { name: 'fee', type: 'uint24' },
              { name: 'durationSeconds', type: 'uint32' },
              { name: 'tickSpacing', type: 'int24' },
              {
                name: 'curves',
                type: 'tuple[]',
                components: [
                  { name: 'tickLower', type: 'int24' },
                  { name: 'tickUpper', type: 'int24' },
                  { name: 'numPositions', type: 'uint16' },
                  { name: 'shares', type: 'uint256' },
                ],
              },
              {
                name: 'beneficiaries',
                type: 'tuple[]',
                components: [
                  { name: 'beneficiary', type: 'address' },
                  { name: 'shares', type: 'uint96' },
                ],
              },
              { name: 'startingTime', type: 'uint32' },
            ],
          },
        ],
        createParams.poolInitializerData,
      ) as any;

      expect(Number(decoded.startFee)).toBe(5_000);
      expect(Number(decoded.fee)).toBe(params.pool.fee);
      expect(Number(decoded.durationSeconds)).toBe(86_400);
      expect(Number(decoded.tickSpacing)).toBe(params.pool.tickSpacing);
      expect(Number(decoded.startingTime)).toBe(1_800_000_000);
    });

    it('computes decay multicurve poolId with dynamic fee flag', async () => {
      const params = multicurveParams();
      params.initializer = {
        type: 'decay',
        startTime: 1_800_000_000,
        startFee: 8_000,
        durationSeconds: 10_000,
      };

      vi.mocked(publicClient.readContract).mockResolvedValueOnce(
        mockPoolAddress as any,
      );

      const result = await factory.simulateCreateMulticurve(params);

      const numeraire = params.sale.numeraire;
      const currency0 =
        mockTokenAddress < numeraire ? mockTokenAddress : numeraire;
      const currency1 =
        mockTokenAddress < numeraire ? numeraire : mockTokenAddress;
      const expectedPoolId = keccak256(
        encodeAbiParameters(
          [
            { type: 'address' },
            { type: 'address' },
            { type: 'uint24' },
            { type: 'int24' },
            { type: 'address' },
          ],
          [
            currency0,
            currency1,
            DYNAMIC_FEE_FLAG,
            params.pool.tickSpacing,
            mockPoolAddress,
          ],
        ),
      );

      expect(result.poolId).toBe(expectedPoolId);
    });

    it('computes rehype multicurve poolId using configured hook address', async () => {
      const params = multicurveParams();
      params.initializer = {
        type: 'rehype',
        config: {
          hookAddress: mockHookAddress,
          buybackDestination:
            '0x1234567890123456789012345678901234567890' as Address,
          startFee: 3000,
          endFee: 3000,
          durationSeconds: 0,
          feeRoutingMode: 0,
          feeDistributionInfo: {
            assetFeesToAssetBuybackWad: parseEther('0.25'),
            assetFeesToNumeraireBuybackWad: parseEther('0.25'),
            assetFeesToBeneficiaryWad: parseEther('0.25'),
            assetFeesToLpWad: parseEther('0.25'),
            numeraireFeesToAssetBuybackWad: parseEther('0.25'),
            numeraireFeesToNumeraireBuybackWad: parseEther('0.25'),
            numeraireFeesToBeneficiaryWad: parseEther('0.25'),
            numeraireFeesToLpWad: parseEther('0.25'),
          },
        },
      };
      params.modules = {
        dopplerHookInitializer:
          '0x7100000000000000000000000000000000000011' as Address,
      };

      const result = await factory.simulateCreateMulticurve(params);

      const numeraire = params.sale.numeraire;
      const currency0 =
        mockTokenAddress < numeraire ? mockTokenAddress : numeraire;
      const currency1 =
        mockTokenAddress < numeraire ? numeraire : mockTokenAddress;
      const expectedPoolId = keccak256(
        encodeAbiParameters(
          [
            { type: 'address' },
            { type: 'address' },
            { type: 'uint24' },
            { type: 'int24' },
            { type: 'address' },
          ],
          [
            currency0,
            currency1,
            params.pool.fee,
            params.pool.tickSpacing,
            mockHookAddress,
          ],
        ),
      );

      expect(result.poolId).toBe(expectedPoolId);
      expect(publicClient.readContract).not.toHaveBeenCalled();
    });

    it('encodes rehype initialization calldata using the new hook InitData layout', () => {
      const params = multicurveParams();
      params.initializer = {
        type: 'rehype',
        config: {
          hookAddress: mockHookAddress,
          buybackDestination:
            '0x1234567890123456789012345678901234567890' as Address,
          startFee: 5000,
          endFee: 3000,
          durationSeconds: 3600,
          startingTime: 1_800_000_000,
          feeRoutingMode: 1,
          feeDistributionInfo: {
            assetFeesToAssetBuybackWad: parseEther('0.2'),
            assetFeesToNumeraireBuybackWad: parseEther('0.3'),
            assetFeesToBeneficiaryWad: parseEther('0.1'),
            assetFeesToLpWad: parseEther('0.4'),
            numeraireFeesToAssetBuybackWad: parseEther('0.2'),
            numeraireFeesToNumeraireBuybackWad: parseEther('0.3'),
            numeraireFeesToBeneficiaryWad: parseEther('0.1'),
            numeraireFeesToLpWad: parseEther('0.4'),
          },
          farTick: 100_000,
        },
      };
      params.modules = {
        dopplerHookInitializer:
          '0x7100000000000000000000000000000000000011' as Address,
      };

      const createParams = factory.encodeCreateMulticurveParams(params);
      const [decodedPoolInitData] = decodeAbiParameters(
        [
          {
            type: 'tuple',
            components: [
              { name: 'fee', type: 'uint24' },
              { name: 'tickSpacing', type: 'int24' },
              { name: 'farTick', type: 'int24' },
              {
                name: 'curves',
                type: 'tuple[]',
                components: [
                  { name: 'tickLower', type: 'int24' },
                  { name: 'tickUpper', type: 'int24' },
                  { name: 'numPositions', type: 'uint16' },
                  { name: 'shares', type: 'uint256' },
                ],
              },
              {
                name: 'beneficiaries',
                type: 'tuple[]',
                components: [
                  { name: 'beneficiary', type: 'address' },
                  { name: 'shares', type: 'uint96' },
                ],
              },
              { name: 'dopplerHook', type: 'address' },
              { name: 'onInitializationDopplerHookCalldata', type: 'bytes' },
              { name: 'graduationDopplerHookCalldata', type: 'bytes' },
            ],
          },
        ],
        createParams.poolInitializerData,
      ) as any;

      expect(decodedPoolInitData.dopplerHook).toBe(mockHookAddress);
      expect(Number(decodedPoolInitData.farTick)).toBe(100_000);

      const [decodedHookInitData] = decodeAbiParameters(
        [
          {
            type: 'tuple',
            components: [
              { name: 'numeraire', type: 'address' },
              { name: 'buybackDst', type: 'address' },
              { name: 'startFee', type: 'uint24' },
              { name: 'endFee', type: 'uint24' },
              { name: 'durationSeconds', type: 'uint32' },
              { name: 'startingTime', type: 'uint32' },
              { name: 'feeRoutingMode', type: 'uint8' },
              {
                name: 'feeDistributionInfo',
                type: 'tuple',
                components: [
                  { name: 'assetFeesToAssetBuybackWad', type: 'uint256' },
                  { name: 'assetFeesToNumeraireBuybackWad', type: 'uint256' },
                  { name: 'assetFeesToBeneficiaryWad', type: 'uint256' },
                  { name: 'assetFeesToLpWad', type: 'uint256' },
                  { name: 'numeraireFeesToAssetBuybackWad', type: 'uint256' },
                  {
                    name: 'numeraireFeesToNumeraireBuybackWad',
                    type: 'uint256',
                  },
                  { name: 'numeraireFeesToBeneficiaryWad', type: 'uint256' },
                  { name: 'numeraireFeesToLpWad', type: 'uint256' },
                ],
              },
            ],
          },
        ],
        decodedPoolInitData.onInitializationDopplerHookCalldata,
      ) as any;

      expect(decodedHookInitData.numeraire).toBe(params.sale.numeraire);
      expect(decodedHookInitData.buybackDst).toBe(
        '0x1234567890123456789012345678901234567890',
      );
      expect(Number(decodedHookInitData.startFee)).toBe(5000);
      expect(Number(decodedHookInitData.endFee)).toBe(3000);
      expect(Number(decodedHookInitData.durationSeconds)).toBe(3600);
      expect(Number(decodedHookInitData.startingTime)).toBe(1_800_000_000);
      expect(Number(decodedHookInitData.feeRoutingMode)).toBe(1);
      expect(
        decodedHookInitData.feeDistributionInfo.assetFeesToNumeraireBuybackWad,
      ).toBe(parseEther('0.3'));
      expect(decodedHookInitData.feeDistributionInfo.numeraireFeesToLpWad).toBe(
        parseEther('0.4'),
      );
    });

    it('computes rehype multicurve poolId with zero hook when no hook config is set', async () => {
      const params = multicurveParams();
      params.modules = {
        dopplerHookInitializer:
          '0x7100000000000000000000000000000000000011' as Address,
      };

      const result = await factory.simulateCreateMulticurve(params);

      const numeraire = params.sale.numeraire;
      const currency0 =
        mockTokenAddress < numeraire ? mockTokenAddress : numeraire;
      const currency1 =
        mockTokenAddress < numeraire ? numeraire : mockTokenAddress;
      const expectedPoolId = keccak256(
        encodeAbiParameters(
          [
            { type: 'address' },
            { type: 'address' },
            { type: 'uint24' },
            { type: 'int24' },
            { type: 'address' },
          ],
          [
            currency0,
            currency1,
            params.pool.fee,
            params.pool.tickSpacing,
            ZERO_ADDRESS,
          ],
        ),
      );

      expect(result.poolId).toBe(expectedPoolId);
      expect(publicClient.readContract).not.toHaveBeenCalled();
    });

    it('rejects conflicting decay initializer and legacy schedule fields', () => {
      const params = multicurveParams();
      params.initializer = {
        type: 'decay',
        startTime: 1_800_000_000,
        startFee: 6_000,
        durationSeconds: 1_000,
      };
      params.schedule = { startTime: 1_800_000_000 };

      expect(() => factory.encodeCreateMulticurveParams(params)).toThrow(
        "Initializer type 'decay' cannot be combined with legacy schedule/dopplerHook fields",
      );
    });

    it('rejects dopplerHook migration for multicurve auctions', () => {
      const params = multicurveParams();
      params.migration = {
        type: 'dopplerHook',
        fee: 3000,
        tickSpacing: 60,
        lockDuration: 30 * DAY_SECONDS,
        beneficiaries: [
          {
            beneficiary:
              '0x1234567890123456789012345678901234567890' as Address,
            shares: parseEther('1'),
          },
        ],
      };

      expect(() => factory.encodeCreateMulticurveParams(params)).toThrow(
        'dopplerHook migration is only supported for dynamic auctions',
      );
    });

    it('accepts decay startFee up to 80%', () => {
      const params = multicurveParams();
      params.initializer = {
        type: 'decay',
        startTime: 1_800_000_000,
        startFee: DECAY_MAX_START_FEE,
        durationSeconds: 1_000,
      };

      expect(() => factory.encodeCreateMulticurveParams(params)).not.toThrow();
    });

    it('rejects decay startFee above 80%', () => {
      const params = multicurveParams();
      params.initializer = {
        type: 'decay',
        startTime: 1_800_000_000,
        startFee: DECAY_MAX_START_FEE + 1,
        durationSeconds: 1_000,
      };

      expect(() => factory.encodeCreateMulticurveParams(params)).toThrow(
        `Decay multicurve startFee must be between 0 and ${DECAY_MAX_START_FEE}`,
      );
    });
  });

  describe('createStaticAuction', () => {
    const validParams: CreateStaticAuctionParams = {
      token: {
        name: 'Test Token',
        symbol: 'TEST',
        tokenURI: 'https://example.com/token',
      },
      sale: {
        initialSupply: parseEther('1000000'),
        numTokensToSell: parseEther('500000'),
        numeraire: mockAddresses.weth,
      },
      pool: {
        startTick: 174960,
        endTick: 225000,
        fee: 3000,
      },
      governance: { type: 'noOp' },
      migration: {
        type: 'uniswapV2',
      },
      userAddress: '0x1234567890123456789012345678901234567890',
    };

    it('should validate parameters', async () => {
      const invalidParams = {
        ...validParams,
        sale: {
          ...validParams.sale,
          numTokensToSell: parseEther('2000000'), // More than initial supply
        },
      };

      await expect(factory.createStaticAuction(invalidParams)).rejects.toThrow(
        'Cannot sell more tokens than initial supply',
      );
    });

    it('rejects dopplerHook migration for static auctions', async () => {
      const invalidParams = {
        ...validParams,
        migration: {
          type: 'dopplerHook' as const,
          fee: 3000,
          tickSpacing: 60,
          lockDuration: 30 * DAY_SECONDS,
          beneficiaries: [
            {
              beneficiary:
                '0x1234567890123456789012345678901234567890' as Address,
              shares: parseEther('1'),
            },
          ],
        },
      };

      await expect(factory.createStaticAuction(invalidParams)).rejects.toThrow(
        'dopplerHook migration is only supported for dynamic auctions',
      );
    });

    it('should validate tick spacing alignment when ticks provided manually', async () => {
      const invalidParams = {
        ...validParams,
        pool: {
          ...validParams.pool,
          startTick: validParams.pool.startTick + 30, // Not divisible by 60
        },
      };

      await expect(factory.createStaticAuction(invalidParams)).rejects.toThrow(
        'Pool ticks must be multiples of tick spacing 60 for fee tier 3000',
      );
    });

    it('should create a static auction successfully', async () => {
      const mockTxHash =
        '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

      // Mock the contract calls
      vi.mocked(publicClient.estimateContractGas).mockImplementationOnce(
        async () => 9_500_000n,
      );
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: {
          address: mockAddresses.airlock,
          functionName: 'create',
          args: [{}, {}],
        },
        result: [mockTokenAddress, mockPoolAddress],
      } as any);

      vi.mocked(walletClient.writeContract).mockResolvedValueOnce(
        mockTxHash as `0x${string}`,
      );

      vi.mocked(publicClient.waitForTransactionReceipt).mockResolvedValueOnce(
        createMockTransactionReceiptWithCreateEvent(),
      );

      const result = await factory.createStaticAuction(validParams);

      expect(result).toEqual({
        poolAddress: mockPoolAddress,
        tokenAddress: mockTokenAddress,
        transactionHash: mockTxHash,
      });

      expect(walletClient.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({ gas: 13_500_000n }),
      );

      expect(publicClient.simulateContract).toHaveBeenCalledWith(
        expect.objectContaining({
          address: mockAddresses.airlock,
          functionName: 'create',
        }),
      );
    });

    it('should honor explicit gas override when creating a static auction', async () => {
      const mockTxHash =
        '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd';

      vi.mocked(publicClient.estimateContractGas).mockImplementationOnce(
        async () => 9_500_000n,
      );
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: {
          address: mockAddresses.airlock,
          functionName: 'create',
          args: [{}, {}],
        },
        result: [mockTokenAddress, mockPoolAddress],
      } as any);
      vi.mocked(walletClient.writeContract).mockResolvedValueOnce(
        mockTxHash as `0x${string}`,
      );
      vi.mocked(publicClient.waitForTransactionReceipt).mockResolvedValueOnce(
        createMockTransactionReceiptWithCreateEvent(),
      );

      await factory.createStaticAuction({ ...validParams, gas: 21_000_000n });

      expect(walletClient.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({ gas: 21_000_000n }),
      );
    });

    it('should encode migration data correctly for V2', async () => {
      const params = {
        ...validParams,
        migration: { type: 'uniswapV2' as const },
      };
      const mockTxHash =
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: {
          address: mockAddresses.airlock,
          functionName: 'create',
          args: [{}, {}],
        },
        result: [mockTokenAddress, mockPoolAddress],
      } as any);
      vi.mocked(walletClient.writeContract).mockResolvedValueOnce(
        mockTxHash as `0x${string}`,
      );
      vi.mocked(publicClient.waitForTransactionReceipt).mockResolvedValueOnce(
        createMockTransactionReceiptWithCreateEvent(),
      );

      await factory.createStaticAuction(params);

      const call = vi.mocked(publicClient.simulateContract).mock.calls[0][0];
      expect((call as any).args[0].liquidityMigrator).toBe(
        mockAddresses.v2Migrator,
      );
      expect((call as any).args[0].liquidityMigratorData).toBe('0x');
    });

    it('should include gas estimate when simulating static auction', async () => {
      vi.mocked(publicClient.estimateContractGas).mockImplementationOnce(
        async () => 11_000_000n,
      );
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: {},
        result: [mockTokenAddress, mockPoolAddress],
      } as any);

      const result = await factory.simulateCreateStaticAuction(validParams);

      expect(result.gasEstimate).toBe(11_000_000n);
      expect(result.asset).toBe(mockTokenAddress);
      expect(result.pool).toBe(mockPoolAddress);
    });
  });

  describe('createDynamicAuction', () => {
    const validParams: CreateDynamicAuctionParams = {
      token: {
        name: 'Test Token',
        symbol: 'TEST',
        tokenURI: 'https://example.com/token',
      },
      sale: {
        initialSupply: parseEther('1000000'),
        numTokensToSell: parseEther('500000'),
        numeraire: mockAddresses.weth,
      },
      auction: {
        duration: 7 * DAY_SECONDS,
        epochLength: 3600, // 1 hour
        startTick: isToken0Expected(mockAddresses.weth) ? 92103 : -92103, // ~0.0001 ETH per token
        endTick: isToken0Expected(mockAddresses.weth) ? 69080 : -69080, // ~0.001 ETH per token
        minProceeds: parseEther('100'),
        maxProceeds: parseEther('10000'),
      },
      pool: {
        fee: 3000,
        tickSpacing: 10, // Must be <= 30 for dynamic auctions (Doppler.sol MAX_TICK_SPACING)
      },
      governance: { type: 'noOp' },
      migration: {
        type: 'uniswapV4',
        fee: 3000,
        tickSpacing: 10, // Must be <= 30 for dynamic auctions (Doppler.sol MAX_TICK_SPACING)
        streamableFees: {
          lockDuration: 365 * 24 * 60 * 60, // 1 year
          beneficiaries: [
            {
              beneficiary:
                '0x1234567890123456789012345678901234567890' as Address,
              shares: parseEther('1'),
            }, // 100%
          ],
        },
      },
      userAddress: '0x1234567890123456789012345678901234567890',
    };

    it('should validate descending ticks for token0', async () => {
      const invalidParams = {
        ...validParams,
        auction: {
          ...validParams.auction,
          startTick: -92103,
          endTick: -69080,
        },
        sale: {
          ...validParams.sale,
          numeraire: '0xffffffffffffffffffffffffffffffffffffffff' as Address,
        },
      };

      await expect(factory.createDynamicAuction(invalidParams)).rejects.toThrow(
        'Start tick must be greater than end tick if base token is currency0',
      );
    });

    it('should validate ascending ticks for token1', async () => {
      const invalidParams = {
        ...validParams,
        auction: {
          ...validParams.auction,
          startTick: 92103,
          endTick: 69080,
        },
        sale: {
          ...validParams.sale,
          numeraire: '0x0000000000000000000000000000000000000000' as Address,
        },
      };

      await expect(factory.createDynamicAuction(invalidParams)).rejects.toThrow(
        'Start tick must be less than end tick if base token is currency1',
      );
    });

    it('should validate duration', async () => {
      const invalidParams = {
        ...validParams,
        auction: {
          ...validParams.auction,
          duration: -1, // Negative duration
        },
      };

      await expect(factory.createDynamicAuction(invalidParams)).rejects.toThrow(
        'Auction duration must be positive',
      );
    });

    it('should calculate gamma if not provided', async () => {
      const mockTxHash =
        '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: {
          address: mockAddresses.airlock,
          functionName: 'create',
          args: [{}, {}],
        },
        result: [mockTokenAddress, mockPoolAddress],
      } as any);
      vi.mocked(walletClient.writeContract).mockResolvedValueOnce(
        mockTxHash as `0x${string}`,
      );
      vi.mocked(publicClient.waitForTransactionReceipt).mockResolvedValueOnce(
        createMockTransactionReceiptWithCreateEvent(),
      );

      await factory.createDynamicAuction(validParams);

      const call = vi.mocked(publicClient.simulateContract).mock.calls[0][0];
      const poolInitializerData = (call as any).args[0].poolInitializerData;

      // Should contain encoded data with calculated gamma
      expect(poolInitializerData).toMatch(/^0x[a-fA-F0-9]+$/);
      expect(poolInitializerData.length).toBeGreaterThan(2);
    });

    it('should create a dynamic auction successfully', async () => {
      const mockTxHash =
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: {
          address: mockAddresses.airlock,
          functionName: 'create',
          args: [{}, {}],
        },
        result: [mockTokenAddress, mockPoolAddress],
      } as any);
      vi.mocked(walletClient.writeContract).mockResolvedValueOnce(
        mockTxHash as `0x${string}`,
      );
      vi.mocked(publicClient.waitForTransactionReceipt).mockResolvedValueOnce(
        createMockTransactionReceiptWithCreateEvent(),
      );

      const result = await factory.createDynamicAuction(validParams);

      expect(result).toEqual({
        hookAddress: mockPoolAddress,
        tokenAddress: mockTokenAddress,
        poolId: expect.any(String),
        transactionHash: mockTxHash,
      });

      expect(publicClient.estimateContractGas).toHaveBeenCalledWith(
        expect.objectContaining({ functionName: 'create' }),
      );
      expect(walletClient.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({ gas: 13_500_000n }),
      );
    });

    it('should simulate dynamic auction creation and compute poolId', async () => {
      vi.mocked(publicClient.estimateContractGas).mockImplementationOnce(
        async () => 12_250_000n,
      );
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: {},
        result: [mockTokenAddress, mockPoolAddress],
      } as any);

      const { createParams, hookAddress, tokenAddress, poolId, gasEstimate } =
        await factory.simulateCreateDynamicAuction(validParams);

      expect(createParams).toBeDefined();
      expect(hookAddress).toBe(mockPoolAddress);
      expect(tokenAddress).toBe(mockTokenAddress);
      expect(typeof poolId).toBe('string');
      expect(poolId.startsWith('0x')).toBe(true);
      expect(gasEstimate).toBe(12_250_000n);
    });

    it('encodes dopplerHook migration with rehype helper for dynamic auctions', async () => {
      const marketCapParams = DynamicAuctionBuilder.forChain(1)
        .tokenConfig({
          name: 'Test Token',
          symbol: 'TEST',
          tokenURI: 'https://example.com/token',
        })
        .saleConfig({
          initialSupply: parseEther('1000000'),
          numTokensToSell: parseEther('500000'),
          numeraire: mockAddresses.weth,
        })
        .withMarketCapRange({
          marketCap: { start: 500_000, min: 50_000 },
          numerairePrice: 3000,
          minProceeds: parseEther('100'),
          maxProceeds: parseEther('10000'),
          fee: 3000,
          tickSpacing: 10,
          duration: 7 * DAY_SECONDS,
          epochLength: 3600,
        })
        .withGovernance({ type: 'noOp' })
        .withMigration({ type: 'uniswapV4', fee: 3000, tickSpacing: 10 })
        .withUserAddress(
          '0x1234567890123456789012345678901234567890' as Address,
        )
        .build();

      const params: CreateDynamicAuctionParams = {
        ...marketCapParams,
        migration: {
          type: 'dopplerHook',
          fee: 3000,
          tickSpacing: 10,
          lockDuration: 30 * DAY_SECONDS,
          beneficiaries: [
            {
              beneficiary:
                '0x1234567890123456789012345678901234567890' as Address,
              shares: parseEther('1'),
            },
          ],
          rehype: {
            buybackDestination:
              '0x1234567890123456789012345678901234567890' as Address,
            customFee: 3000,
            feeRoutingMode: 'routeToBeneficiaryFees',
            feeDistributionInfo: {
              assetFeesToAssetBuybackWad: parseEther('0.25'),
              assetFeesToNumeraireBuybackWad: parseEther('0.15'),
              assetFeesToBeneficiaryWad: parseEther('0.35'),
              assetFeesToLpWad: parseEther('0.25'),
              numeraireFeesToAssetBuybackWad: parseEther('0.25'),
              numeraireFeesToNumeraireBuybackWad: parseEther('0.15'),
              numeraireFeesToBeneficiaryWad: parseEther('0.35'),
              numeraireFeesToLpWad: parseEther('0.25'),
            },
          },
        },
      };

      const { createParams } =
        await factory.encodeCreateDynamicAuctionParams(params);

      expect(createParams.liquidityMigrator).toBe(
        mockAddresses.dopplerHookMigrator,
      );

      const decoded = decodeAbiParameters(
        [
          { type: 'uint24' },
          { type: 'bool' },
          { type: 'int24' },
          { type: 'uint32' },
          {
            type: 'tuple[]',
            components: [
              { type: 'address', name: 'beneficiary' },
              { type: 'uint96', name: 'shares' },
            ],
          },
          { type: 'address' },
          { type: 'bytes' },
          { type: 'address' },
          { type: 'uint256' },
        ],
        createParams.liquidityMigratorData,
      ) as readonly [
        number,
        boolean,
        number,
        number,
        readonly { beneficiary: Address; shares: bigint }[],
        Address,
        `0x${string}`,
        Address,
        bigint,
      ];

      expect(decoded[0]).toBe(3000);
      expect(decoded[1]).toBe(false);
      expect(decoded[2]).toBe(10);
      expect(decoded[3]).toBe(30 * DAY_SECONDS);
      expect(decoded[4]).toHaveLength(1);
      expect(decoded[5]).toBe(mockAddresses.rehypeDopplerHookMigrator);
      expect(decoded[7]).toBe(ZERO_ADDRESS);
      expect(decoded[8]).toBe(0n);

      const [rehypeInit] = decodeAbiParameters(
        [
          {
            type: 'tuple',
            components: [
              { name: 'numeraire', type: 'address' },
              { name: 'buybackDst', type: 'address' },
              { name: 'customFee', type: 'uint24' },
              { name: 'feeRoutingMode', type: 'uint8' },
              {
                name: 'feeDistributionInfo',
                type: 'tuple',
                components: [
                  { name: 'assetFeesToAssetBuybackWad', type: 'uint256' },
                  { name: 'assetFeesToNumeraireBuybackWad', type: 'uint256' },
                  { name: 'assetFeesToBeneficiaryWad', type: 'uint256' },
                  { name: 'assetFeesToLpWad', type: 'uint256' },
                  { name: 'numeraireFeesToAssetBuybackWad', type: 'uint256' },
                  {
                    name: 'numeraireFeesToNumeraireBuybackWad',
                    type: 'uint256',
                  },
                  { name: 'numeraireFeesToBeneficiaryWad', type: 'uint256' },
                  { name: 'numeraireFeesToLpWad', type: 'uint256' },
                ],
              },
            ],
          },
        ],
        decoded[6],
      ) as any;

      expect(rehypeInit.numeraire).toBe(marketCapParams.sale.numeraire);
      expect(rehypeInit.buybackDst).toBe(
        '0x1234567890123456789012345678901234567890',
      );
      expect(Number(rehypeInit.customFee)).toBe(3000);
      expect(Number(rehypeInit.feeRoutingMode)).toBe(1);
      expect(rehypeInit.feeDistributionInfo.assetFeesToBeneficiaryWad).toBe(
        parseEther('0.35'),
      );
      expect(rehypeInit.feeDistributionInfo.numeraireFeesToLpWad).toBe(
        parseEther('0.25'),
      );
    });

    it('normalizes legacy dopplerHook rehype migration fields into the new migrator layout', async () => {
      const marketCapParams = DynamicAuctionBuilder.forChain(1)
        .tokenConfig({
          name: 'Test Token',
          symbol: 'TEST',
          tokenURI: 'https://example.com/token',
        })
        .saleConfig({
          initialSupply: parseEther('1000000'),
          numTokensToSell: parseEther('500000'),
          numeraire: mockAddresses.weth,
        })
        .withMarketCapRange({
          marketCap: { start: 500_000, min: 50_000 },
          numerairePrice: 3000,
          minProceeds: parseEther('100'),
          maxProceeds: parseEther('10000'),
          fee: 3000,
          tickSpacing: 10,
          duration: 7 * DAY_SECONDS,
          epochLength: 3600,
        })
        .withGovernance({ type: 'noOp' })
        .withMigration({ type: 'uniswapV4', fee: 3000, tickSpacing: 10 })
        .withUserAddress(
          '0x1234567890123456789012345678901234567890' as Address,
        )
        .build();

      const params: CreateDynamicAuctionParams = {
        ...marketCapParams,
        migration: {
          type: 'dopplerHook',
          fee: 3000,
          tickSpacing: 10,
          lockDuration: 30 * DAY_SECONDS,
          beneficiaries: [
            {
              beneficiary:
                '0x1234567890123456789012345678901234567890' as Address,
              shares: parseEther('1'),
            },
          ],
          rehype: {
            buybackDestination:
              '0x1234567890123456789012345678901234567890' as Address,
            customFee: 3000,
            assetBuybackPercentWad: parseEther('0.25'),
            numeraireBuybackPercentWad: parseEther('0.25'),
            beneficiaryPercentWad: parseEther('0.25'),
            lpPercentWad: parseEther('0.25'),
          },
        },
      };

      const { createParams } =
        await factory.encodeCreateDynamicAuctionParams(params);
      const decoded = decodeAbiParameters(
        [
          { type: 'uint24' },
          { type: 'bool' },
          { type: 'int24' },
          { type: 'uint32' },
          {
            type: 'tuple[]',
            components: [
              { type: 'address', name: 'beneficiary' },
              { type: 'uint96', name: 'shares' },
            ],
          },
          { type: 'address' },
          { type: 'bytes' },
          { type: 'address' },
          { type: 'uint256' },
        ],
        createParams.liquidityMigratorData,
      ) as readonly [
        number,
        boolean,
        number,
        number,
        readonly { beneficiary: Address; shares: bigint }[],
        Address,
        `0x${string}`,
        Address,
        bigint,
      ];

      const [rehypeInit] = decodeAbiParameters(
        [
          {
            type: 'tuple',
            components: [
              { name: 'numeraire', type: 'address' },
              { name: 'buybackDst', type: 'address' },
              { name: 'customFee', type: 'uint24' },
              { name: 'feeRoutingMode', type: 'uint8' },
              {
                name: 'feeDistributionInfo',
                type: 'tuple',
                components: [
                  { name: 'assetFeesToAssetBuybackWad', type: 'uint256' },
                  { name: 'assetFeesToNumeraireBuybackWad', type: 'uint256' },
                  { name: 'assetFeesToBeneficiaryWad', type: 'uint256' },
                  { name: 'assetFeesToLpWad', type: 'uint256' },
                  { name: 'numeraireFeesToAssetBuybackWad', type: 'uint256' },
                  {
                    name: 'numeraireFeesToNumeraireBuybackWad',
                    type: 'uint256',
                  },
                  { name: 'numeraireFeesToBeneficiaryWad', type: 'uint256' },
                  { name: 'numeraireFeesToLpWad', type: 'uint256' },
                ],
              },
            ],
          },
        ],
        decoded[6],
      ) as any;

      expect(Number(rehypeInit.feeRoutingMode)).toBe(0);
      expect(rehypeInit.feeDistributionInfo.assetFeesToAssetBuybackWad).toBe(
        parseEther('0.25'),
      );
      expect(
        rehypeInit.feeDistributionInfo.numeraireFeesToAssetBuybackWad,
      ).toBe(parseEther('0.25'));
      expect(rehypeInit.feeDistributionInfo.numeraireFeesToLpWad).toBe(
        parseEther('0.25'),
      );
    });

    it('rejects dopplerHook rehype migration configs where a distribution row does not sum to WAD', async () => {
      const marketCapParams = DynamicAuctionBuilder.forChain(1)
        .tokenConfig({
          name: 'Test Token',
          symbol: 'TEST',
          tokenURI: 'https://example.com/token',
        })
        .saleConfig({
          initialSupply: parseEther('1000000'),
          numTokensToSell: parseEther('500000'),
          numeraire: mockAddresses.weth,
        })
        .withMarketCapRange({
          marketCap: { start: 500_000, min: 50_000 },
          numerairePrice: 3000,
          minProceeds: parseEther('100'),
          maxProceeds: parseEther('10000'),
          fee: 3000,
          tickSpacing: 10,
          duration: 7 * DAY_SECONDS,
          epochLength: 3600,
        })
        .withGovernance({ type: 'noOp' })
        .withMigration({ type: 'uniswapV4', fee: 3000, tickSpacing: 10 })
        .withUserAddress(
          '0x1234567890123456789012345678901234567890' as Address,
        )
        .build();

      const params: CreateDynamicAuctionParams = {
        ...marketCapParams,
        migration: {
          type: 'dopplerHook',
          fee: 3000,
          tickSpacing: 10,
          lockDuration: 30 * DAY_SECONDS,
          beneficiaries: [
            {
              beneficiary:
                '0x1234567890123456789012345678901234567890' as Address,
              shares: parseEther('1'),
            },
          ],
          rehype: {
            buybackDestination:
              '0x1234567890123456789012345678901234567890' as Address,
            customFee: 3000,
            feeDistributionInfo: {
              assetFeesToAssetBuybackWad: parseEther('0.5'),
              assetFeesToNumeraireBuybackWad: parseEther('0.2'),
              assetFeesToBeneficiaryWad: parseEther('0.1'),
              assetFeesToLpWad: parseEther('0.1'),
              numeraireFeesToAssetBuybackWad: parseEther('0.25'),
              numeraireFeesToNumeraireBuybackWad: parseEther('0.25'),
              numeraireFeesToBeneficiaryWad: parseEther('0.25'),
              numeraireFeesToLpWad: parseEther('0.25'),
            },
          },
        },
      };

      await expect(
        factory.encodeCreateDynamicAuctionParams(params),
      ).rejects.toThrow('Rehype asset fee distribution must sum');
    });

    it('encodes dopplerHook migration with generic hook + proceeds split', async () => {
      const genericHook =
        '0x9999999999999999999999999999999999999999' as Address;
      const proceedsRecipient =
        '0x1111111111111111111111111111111111111111' as Address;

      const marketCapParams = DynamicAuctionBuilder.forChain(1)
        .tokenConfig({
          name: 'Test Token',
          symbol: 'TEST',
          tokenURI: 'https://example.com/token',
        })
        .saleConfig({
          initialSupply: parseEther('1000000'),
          numTokensToSell: parseEther('500000'),
          numeraire: mockAddresses.weth,
        })
        .withMarketCapRange({
          marketCap: { start: 500_000, min: 50_000 },
          numerairePrice: 3000,
          minProceeds: parseEther('100'),
          maxProceeds: parseEther('10000'),
          fee: 3000,
          tickSpacing: 10,
          duration: 7 * DAY_SECONDS,
          epochLength: 3600,
        })
        .withGovernance({ type: 'noOp' })
        .withMigration({ type: 'uniswapV4', fee: 3000, tickSpacing: 10 })
        .withUserAddress(
          '0x1234567890123456789012345678901234567890' as Address,
        )
        .build();

      const params: CreateDynamicAuctionParams = {
        ...marketCapParams,
        migration: {
          type: 'dopplerHook',
          fee: 500,
          useDynamicFee: true,
          tickSpacing: 20,
          lockDuration: DAY_SECONDS,
          beneficiaries: [
            {
              beneficiary:
                '0x1234567890123456789012345678901234567890' as Address,
              shares: parseEther('1'),
            },
          ],
          hook: {
            hookAddress: genericHook,
            onInitializationCalldata: '0x1234',
          },
          proceedsSplit: {
            recipient: proceedsRecipient,
            share: parseEther('0.1'),
          },
        },
      };

      const { createParams } =
        await factory.encodeCreateDynamicAuctionParams(params);

      const decoded = decodeAbiParameters(
        [
          { type: 'uint24' },
          { type: 'bool' },
          { type: 'int24' },
          { type: 'uint32' },
          {
            type: 'tuple[]',
            components: [
              { type: 'address', name: 'beneficiary' },
              { type: 'uint96', name: 'shares' },
            ],
          },
          { type: 'address' },
          { type: 'bytes' },
          { type: 'address' },
          { type: 'uint256' },
        ],
        createParams.liquidityMigratorData,
      ) as readonly [
        number,
        boolean,
        number,
        number,
        readonly { beneficiary: Address; shares: bigint }[],
        Address,
        `0x${string}`,
        Address,
        bigint,
      ];

      expect(decoded[0]).toBe(500);
      expect(decoded[1]).toBe(true);
      expect(decoded[2]).toBe(20);
      expect(decoded[3]).toBe(DAY_SECONDS);
      expect(decoded[5]).toBe(genericHook);
      expect(decoded[6]).toBe('0x1234');
      expect(decoded[7]).toBe(proceedsRecipient);
      expect(decoded[8]).toBe(parseEther('0.1'));
    });

    it('should allow overriding gas when creating a dynamic auction', async () => {
      const mockTxHash =
        '0xfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeed';

      vi.mocked(publicClient.estimateContractGas).mockImplementationOnce(
        async () => 10_000_000n,
      );
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: {
          address: mockAddresses.airlock,
          functionName: 'create',
          args: [{}, {}],
        },
        result: [mockTokenAddress, mockPoolAddress],
      } as any);
      vi.mocked(walletClient.writeContract).mockResolvedValueOnce(
        mockTxHash as `0x${string}`,
      );
      vi.mocked(publicClient.waitForTransactionReceipt).mockResolvedValueOnce(
        createMockTransactionReceiptWithCreateEvent(),
      );

      await factory.createDynamicAuction({ ...validParams, gas: 18_000_000n });

      expect(walletClient.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({ gas: 18_000_000n }),
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle missing wallet client', async () => {
      factory = new DopplerFactory(publicClient, undefined, 1);

      const params: CreateStaticAuctionParams = {
        token: {
          name: 'Test',
          symbol: 'TEST',
          tokenURI: 'https://example.com',
        },
        sale: {
          initialSupply: parseEther('1000'),
          numTokensToSell: parseEther('500'),
          numeraire: mockAddresses.weth,
        },
        pool: { startTick: 174960, endTick: 225000, fee: 3000 },
        governance: { type: 'noOp' },
        migration: { type: 'uniswapV2' },
        userAddress: '0x1234567890123456789012345678901234567890',
      };

      await expect(factory.createStaticAuction(params)).rejects.toThrow(
        'Wallet client required for write operations',
      );
    });

    it('should throw error when transaction receipt has no Create event', async () => {
      const mockTxHash =
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: {
          address: mockAddresses.airlock,
          functionName: 'create',
          args: [{}, {}],
        },
        result: [mockTokenAddress, mockPoolAddress],
      } as any);
      vi.mocked(walletClient.writeContract).mockResolvedValueOnce(
        mockTxHash as `0x${string}`,
      );
      vi.mocked(publicClient.waitForTransactionReceipt).mockResolvedValueOnce(
        createMockTransactionReceipt([]), // No logs
      );

      const params: CreateStaticAuctionParams = {
        token: {
          name: 'Test',
          symbol: 'TEST',
          tokenURI: 'https://example.com',
        },
        sale: {
          initialSupply: parseEther('1000'),
          numTokensToSell: parseEther('500'),
          numeraire: mockAddresses.weth,
        },
        pool: { startTick: 174960, endTick: 225000, fee: 3000 },
        governance: { type: 'noOp' },
        migration: { type: 'uniswapV2' },
        userAddress: '0x1234567890123456789012345678901234567890',
      };

      // Should throw error when Create event is missing (no more fallback to simulation)
      await expect(factory.createStaticAuction(params)).rejects.toThrow(
        'Failed to extract addresses from Create event in transaction logs',
      );
    });
  });
});
