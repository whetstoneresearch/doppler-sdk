import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseEther, type Address } from 'viem';
import { DopplerFactory } from '../../../../src/evm/entities/DopplerFactory';
import { CHAIN_IDS, getAddresses } from '../../../../src/evm/addresses';
import { DAY_SECONDS, ZERO_ADDRESS } from '../../../../src/evm/constants';
import {
  DynamicAuctionBuilder,
  MulticurveBuilder,
  StaticAuctionBuilder,
} from '../../../../src/evm/builders';
import type {
  CreateDynamicAuctionParams,
  CreateMulticurveParams,
  CreateStaticAuctionParams,
} from '../../../../src/evm/types';
import {
  createMockPublicClient,
  createMockWalletClient,
  type MockedPublicClient,
} from '../../setup/fixtures/clients';
import { mockAddresses } from '../../setup/fixtures/addresses';

vi.mock('../../../../src/evm/addresses', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../../src/evm/addresses')>();
  return {
    ...actual,
    getAddresses: vi.fn(() => mockAddresses),
  };
});

describe('DopplerFactory unsupported contract guards', () => {
  let publicClient: MockedPublicClient;
  let factory: DopplerFactory;

  const staticParams: CreateStaticAuctionParams = {
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
    migration: { type: 'uniswapV2' },
    userAddress: '0x1234567890123456789012345678901234567890' as Address,
  };

  const dynamicParams: CreateDynamicAuctionParams = {
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
      epochLength: 3600,
      startTick: 92103,
      endTick: 69080,
      minProceeds: parseEther('100'),
      maxProceeds: parseEther('10000'),
    },
    pool: {
      fee: 3000,
      tickSpacing: 10,
    },
    governance: { type: 'noOp' },
    migration: {
      type: 'uniswapV4',
      fee: 3000,
      tickSpacing: 10,
    },
    blockTimestamp: 1_700_000_000,
    userAddress: '0x1234567890123456789012345678901234567890' as Address,
  };

  const multicurveParams: CreateMulticurveParams = {
    token: staticParams.token,
    sale: staticParams.sale,
    pool: {
      fee: 3000,
      tickSpacing: 60,
      curves: [
        {
          tickLower: -120000,
          tickUpper: -60000,
          numPositions: 8,
          shares: parseEther('1'),
        },
      ],
    },
    governance: { type: 'noOp' },
    migration: { type: 'uniswapV2' },
    userAddress: staticParams.userAddress,
  };

  beforeEach(() => {
    vi.mocked(getAddresses).mockReturnValue(mockAddresses);
    publicClient = createMockPublicClient();
    factory = new DopplerFactory(publicClient, createMockWalletClient(), 1);
  });

  it('rejects standard static auctions when V3 initializer is not configured', async () => {
    vi.mocked(getAddresses).mockReturnValue({
      ...mockAddresses,
      v3Initializer: ZERO_ADDRESS,
    });

    await expect(
      factory.encodeCreateStaticAuctionParams(staticParams),
    ).rejects.toThrow('UniswapV3Initializer address not configured');
  });

  it('rejects beneficiary static auctions when lockable V3 initializer is not configured', async () => {
    vi.mocked(getAddresses).mockReturnValue({
      ...mockAddresses,
      lockableV3Initializer: ZERO_ADDRESS,
    });

    await expect(
      factory.encodeCreateStaticAuctionParams({
        ...staticParams,
        pool: {
          ...staticParams.pool,
          beneficiaries: [
            {
              beneficiary:
                '0x1234567890123456789012345678901234567890' as Address,
              shares: parseEther('1'),
            },
          ],
        },
      }),
    ).rejects.toThrow('Lockable V3 initializer address not configured');
  });

  it('rejects V2 migration when neither V2 migrator is configured', async () => {
    vi.mocked(getAddresses).mockReturnValue({
      ...mockAddresses,
      v2Migrator: ZERO_ADDRESS,
      v2MigratorSplit: ZERO_ADDRESS,
    });

    await expect(
      factory.encodeCreateStaticAuctionParams(staticParams),
    ).rejects.toThrow(
      'Neither UniswapV2Migrator nor UniswapV2MigratorSplit is deployed',
    );
  });

  it('rejects dynamic auctions when V4 initializer is not configured', async () => {
    vi.mocked(getAddresses).mockReturnValue({
      ...mockAddresses,
      v4Initializer: ZERO_ADDRESS,
    });

    await expect(
      factory.encodeCreateDynamicAuctionParams(dynamicParams),
    ).rejects.toThrow('UniswapV4Initializer address not configured');
  });

  it('rejects V4 migration when the V4 migrator is not configured', async () => {
    vi.mocked(getAddresses).mockReturnValue({
      ...mockAddresses,
      v4Migrator: ZERO_ADDRESS,
    });

    await expect(
      factory.encodeCreateDynamicAuctionParams(dynamicParams),
    ).rejects.toThrow('UniswapV4Migrator not deployed');
  });

  describe('Arc native numeraire', () => {
    const arcError = /Arc native USDC.*V2\/V3.*ERC20 numeraire/;
    const beneficiaries = [
      { beneficiary: staticParams.userAddress, shares: parseEther('1') },
    ];

    beforeEach(() => {
      factory = new DopplerFactory(
        publicClient,
        createMockWalletClient(),
        CHAIN_IDS.ARC,
      );
    });

    it.each(['standard', 'override', 'lockable'] as const)(
      'rejects %s static launches before RPC, including reused create params',
      async (variant) => {
        const reused = factory.encodeCreateMulticurveParams(multicurveParams);
        const params: CreateStaticAuctionParams = {
          ...staticParams,
          sale: { ...staticParams.sale, numeraire: ZERO_ADDRESS },
          migration: dynamicParams.migration,
          pool: {
            ...staticParams.pool,
            beneficiaries: variant === 'lockable' ? beneficiaries : undefined,
          },
          modules:
            variant === 'standard'
              ? undefined
              : { v3Initializer: mockAddresses.v3Initializer },
        };
        await expect(
          factory.encodeCreateStaticAuctionParams(params),
        ).rejects.toThrow(arcError);
        await expect(
          factory.simulateCreateStaticAuction(params),
        ).rejects.toThrow(arcError);
        await expect(factory.createStaticAuction(params)).rejects.toThrow(
          arcError,
        );
        await expect(
          factory.createStaticAuction(params, { _createParams: reused }),
        ).rejects.toThrow(arcError);
        expect(publicClient.simulateContract).not.toHaveBeenCalled();
        expect(publicClient.readContract).not.toHaveBeenCalled();
        expect(publicClient.getBlock).not.toHaveBeenCalled();
      },
    );

    it.each(['uniswapV2', 'uniswapV2Split'] as const)(
      'rejects native %s migrations on every dynamic and multicurve entrypoint',
      async (type) => {
        const reused = factory.encodeCreateMulticurveParams(multicurveParams);
        const dynamic: CreateDynamicAuctionParams = {
          ...dynamicParams,
          sale: { ...dynamicParams.sale, numeraire: ZERO_ADDRESS },
          auction: {
            ...dynamicParams.auction,
            startTick: -92103,
            endTick: -69080,
          },
          migration: { type },
        };
        const multicurve: CreateMulticurveParams = {
          ...multicurveParams,
          sale: dynamic.sale,
          migration: { type },
        };
        await expect(
          factory.encodeCreateDynamicAuctionParams(dynamic),
        ).rejects.toThrow(arcError);
        await expect(
          factory.simulateCreateDynamicAuction(dynamic),
        ).rejects.toThrow(arcError);
        await expect(factory.createDynamicAuction(dynamic)).rejects.toThrow(
          arcError,
        );
        await expect(
          factory.createDynamicAuction(dynamic, { _createParams: reused }),
        ).rejects.toThrow(arcError);
        expect(() => factory.encodeCreateMulticurveParams(multicurve)).toThrow(
          arcError,
        );
        await expect(
          factory.simulateCreateMulticurve(multicurve),
        ).rejects.toThrow(arcError);
        await expect(
          factory.prepareCreateMulticurve(multicurve, {
            account: multicurve.userAddress,
          }),
        ).rejects.toThrow(arcError);
        await expect(factory.createMulticurve(multicurve)).rejects.toThrow(
          arcError,
        );
        await expect(
          factory.createMulticurve(multicurve, { _createParams: reused }),
        ).rejects.toThrow(arcError);
        expect(publicClient.simulateContract).not.toHaveBeenCalled();
        expect(publicClient.readContract).not.toHaveBeenCalled();
        expect(publicClient.getBlock).not.toHaveBeenCalled();
      },
    );

    it('encodes ERC20 V3 launches, including lockable pools, and V2 migrations on Arc', async () => {
      const standard =
        await factory.encodeCreateStaticAuctionParams(staticParams);
      expect(standard.poolInitializer).toBe(mockAddresses.v3Initializer);
      const lockable = await factory.encodeCreateStaticAuctionParams({
        ...staticParams,
        pool: { ...staticParams.pool, beneficiaries },
        modules: { lockableV3Initializer: mockAddresses.v3Initializer },
      });
      expect(lockable.liquidityMigrator).toBe(mockAddresses.v2Migrator);
      const dynamic = await factory.encodeCreateDynamicAuctionParams({
        ...dynamicParams,
        migration: { type: 'uniswapV2Split' },
      });
      expect(dynamic.createParams.liquidityMigrator).toBe(
        mockAddresses.v2MigratorSplit,
      );
      expect(
        factory.encodeCreateMulticurveParams(multicurveParams)
          .liquidityMigrator,
      ).toBe(mockAddresses.v2Migrator);
    });

    it('encodes Arc native V4-only dynamic and multicurve launches', async () => {
      const sale = { ...dynamicParams.sale, numeraire: ZERO_ADDRESS };
      const dynamic = await factory.encodeCreateDynamicAuctionParams({
        ...dynamicParams,
        sale,
        auction: {
          ...dynamicParams.auction,
          startTick: -92103,
          endTick: -69080,
        },
      });
      expect(dynamic.createParams.liquidityMigrator).toBe(
        mockAddresses.v4Migrator,
      );
      const multicurve = factory.encodeCreateMulticurveParams({
        ...multicurveParams,
        sale,
        migration: dynamicParams.migration,
      });
      expect(multicurve.liquidityMigrator).toBe(mockAddresses.v4Migrator);
      const locked = factory.encodeCreateMulticurveParams({
        ...multicurveParams,
        sale,
        pool: { ...multicurveParams.pool, beneficiaries },
        migration: { type: 'noOp' },
      });
      expect(locked.liquidityMigrator).toBe(mockAddresses.noOpMigrator);
    });

    it('does not impose the Arc guard on other chains', async () => {
      factory = new DopplerFactory(
        publicClient,
        createMockWalletClient(),
        CHAIN_IDS.BASE,
      );
      const encoded = await factory.encodeCreateStaticAuctionParams({
        ...staticParams,
        sale: { ...staticParams.sale, numeraire: ZERO_ADDRESS },
      });
      expect(encoded.poolInitializer).toBe(mockAddresses.v3Initializer);
      expect(encoded.liquidityMigrator).toBe(mockAddresses.v2Migrator);
    });

    describe('builders', () => {
      const staticBuilder = () =>
        StaticAuctionBuilder.forChain(CHAIN_IDS.ARC)
          .tokenConfig(staticParams.token)
          .saleConfig({ ...staticParams.sale, numeraire: ZERO_ADDRESS })
          .poolByTicks(staticParams.pool)
          .withMigration(dynamicParams.migration)
          .withUserAddress(staticParams.userAddress);
      const dynamicBuilder = () =>
        DynamicAuctionBuilder.forChain(CHAIN_IDS.ARC)
          .tokenConfig(dynamicParams.token)
          .saleConfig({ ...dynamicParams.sale, numeraire: ZERO_ADDRESS })
          .poolConfig(dynamicParams.pool)
          .auctionByTicks({
            ...dynamicParams.auction,
            startTick: -92103,
            endTick: -69080,
          })
          .withMigration(dynamicParams.migration)
          .withUserAddress(dynamicParams.userAddress);
      const multicurveBuilder = () =>
        MulticurveBuilder.forChain(CHAIN_IDS.ARC)
          .tokenConfig(multicurveParams.token)
          .saleConfig({ ...multicurveParams.sale, numeraire: ZERO_ADDRESS })
          .poolConfig(multicurveParams.pool)
          .withMigration(dynamicParams.migration)
          .withUserAddress(multicurveParams.userAddress);

      it('rejects native static pools regardless of beneficiaries or overrides', () => {
        expect(() => staticBuilder().build()).toThrow(arcError);
        expect(() =>
          staticBuilder()
            .withV3Initializer(mockAddresses.v3Initializer)
            .build(),
        ).toThrow(arcError);
        expect(() =>
          staticBuilder().withBeneficiaries(beneficiaries).build(),
        ).toThrow(arcError);
      });

      it.each(['uniswapV2', 'uniswapV2Split'] as const)(
        'rejects native %s dynamic and multicurve migrations',
        (type) => {
          expect(() =>
            dynamicBuilder().withMigration({ type }).build(),
          ).toThrow(arcError);
          expect(() =>
            multicurveBuilder().withMigration({ type }).build(),
          ).toThrow(arcError);
        },
      );

      it('allows native V4-only and ERC20 builders and rejects mutated builder params at the factory', async () => {
        const dynamic = dynamicBuilder().build();
        expect(
          (await factory.encodeCreateDynamicAuctionParams(dynamic)).createParams
            .liquidityMigrator,
        ).toBe(mockAddresses.v4Migrator);
        const multicurve = multicurveBuilder()
          .poolConfig({ ...multicurveParams.pool, beneficiaries })
          .withMigration({ type: 'noOp' })
          .build();
        expect(
          factory.encodeCreateMulticurveParams(multicurve).liquidityMigrator,
        ).toBe(mockAddresses.noOpMigrator);
        const staticErc20 = staticBuilder()
          .saleConfig(staticParams.sale)
          .build();
        expect(
          (await factory.encodeCreateStaticAuctionParams(staticErc20))
            .poolInitializer,
        ).toBe(mockAddresses.v3Initializer);
        const multicurveErc20 = multicurveBuilder()
          .saleConfig({
            ...multicurveParams.sale,
            numeraire: '0x0000000000000000000000000000000000000001',
          })
          .withMigration({ type: 'uniswapV2Split' })
          .build();
        expect(
          factory.encodeCreateMulticurveParams(multicurveErc20)
            .liquidityMigrator,
        ).toBe(mockAddresses.v2MigratorSplit);
        dynamic.migration = { type: 'uniswapV2' };
        await expect(
          factory.encodeCreateDynamicAuctionParams(dynamic),
        ).rejects.toThrow(arcError);
      });
    });
  });
});
