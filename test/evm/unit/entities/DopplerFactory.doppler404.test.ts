import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  decodeAbiParameters,
  parseEther,
  type Address,
  type PublicClient,
} from 'viem';
import {
  DynamicAuctionBuilder,
  MulticurveBuilder,
  OpeningAuctionBuilder,
  StaticAuctionBuilder,
} from '../../../../src/evm/builders';
import { DAY_SECONDS, WAD } from '../../../../src/evm/constants';
import { DopplerFactory } from '../../../../src/evm/entities/DopplerFactory';
import type {
  CreateDynamicAuctionParams,
  CreateMulticurveParams,
  CreateOpeningAuctionParams,
  CreateStaticAuctionParams,
  VestingConfig,
} from '../../../../src/evm/types';
import {
  createMockPublicClient,
  createMockWalletClient,
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

const userAddress = '0x1234567890123456789012345678901234567890' as Address;
const customTokenFactory =
  '0x2222222222222222222222222222222222222222' as Address;
const configuredDoppler404Factory = mockAddresses.doppler404Factory;
const vesting: VestingConfig = {
  duration: 180 * DAY_SECONDS,
  cliffDuration: 0,
};

const DOPPLER_404_TOKEN_DATA_ABI = [
  { type: 'string' },
  { type: 'string' },
  { type: 'string' },
  { type: 'uint256' },
] as const;

function tokenConfig(unit?: bigint) {
  return unit === undefined
    ? {
        type: 'doppler404' as const,
        name: 'Doppler 404',
        symbol: 'D404',
        baseURI: 'ipfs://doppler-404/',
      }
    : {
        type: 'doppler404' as const,
        name: 'Doppler 404',
        symbol: 'D404',
        baseURI: 'ipfs://doppler-404/',
        unit,
      };
}

function decodeUnit(data: `0x${string}`): bigint {
  return decodeAbiParameters(DOPPLER_404_TOKEN_DATA_ABI, data)[3];
}

function buildStatic(unit?: bigint): CreateStaticAuctionParams<1> {
  return StaticAuctionBuilder.forChain(1)
    .tokenConfig(tokenConfig(unit))
    .saleConfig({
      initialSupply: parseEther('1000000'),
      numTokensToSell: parseEther('900000'),
      numeraire: mockAddresses.weth,
    })
    .poolByTicks({ startTick: -120000, endTick: -60000, fee: 3000 })
    .withGovernance({ type: 'noOp' })
    .withMigration({ type: 'uniswapV2' })
    .withUserAddress(userAddress)
    .build();
}

function buildDynamic(unit?: bigint): CreateDynamicAuctionParams<1> {
  return DynamicAuctionBuilder.forChain(1)
    .tokenConfig(tokenConfig(unit))
    .saleConfig({
      initialSupply: parseEther('1000000'),
      numTokensToSell: parseEther('900000'),
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
    .withUserAddress(userAddress)
    .build();
}

function buildOpening(unit?: bigint): CreateOpeningAuctionParams<1> {
  return OpeningAuctionBuilder.forChain(1)
    .tokenConfig(tokenConfig(unit))
    .saleConfig({
      initialSupply: parseEther('1000000'),
      numTokensToSell: parseEther('900000'),
      numeraire: mockAddresses.weth,
    })
    .openingAuctionConfig({
      auctionDuration: DAY_SECONDS,
      minAcceptableTickToken0: -120000,
      minAcceptableTickToken1: -120000,
      incentiveShareBps: 100,
      tickSpacing: 10,
      fee: 3000,
      minLiquidity: 1000n,
      shareToAuctionBps: 8000,
    })
    .dopplerConfig({
      minProceeds: parseEther('100'),
      maxProceeds: parseEther('10000'),
      startTick: -60000,
      endTick: -120000,
      duration: 7 * DAY_SECONDS,
      epochLength: 3600,
      fee: 3000,
      tickSpacing: 10,
    })
    .withGovernance({ type: 'noOp' })
    .withMigration({ type: 'uniswapV2' })
    .withUserAddress(userAddress)
    .withOpeningAuctionInitializer(mockAddresses.v4Initializer)
    .build();
}

function buildMulticurve(unit?: bigint): CreateMulticurveParams<1> {
  return MulticurveBuilder.forChain(1)
    .tokenConfig(tokenConfig(unit))
    .saleConfig({
      initialSupply: parseEther('1000000'),
      numTokensToSell: parseEther('900000'),
      numeraire: mockAddresses.weth,
    })
    .poolConfig({
      fee: 0,
      tickSpacing: 8,
      curves: [
        {
          tickLower: 0,
          tickUpper: 80000,
          numPositions: 8,
          shares: WAD,
        },
      ],
    })
    .withGovernance({ type: 'noOp' })
    .withMigration({ type: 'uniswapV2' })
    .withUserAddress(userAddress)
    .build();
}

type LaunchStyle = 'static' | 'dynamic' | 'opening' | 'multicurve';
type Doppler404LaunchParams =
  | CreateStaticAuctionParams<1>
  | CreateDynamicAuctionParams<1>
  | CreateOpeningAuctionParams<1>
  | CreateMulticurveParams<1>;

function buildLaunch(style: LaunchStyle): Doppler404LaunchParams {
  switch (style) {
    case 'static':
      return buildStatic();
    case 'dynamic':
      return buildDynamic();
    case 'opening':
      return buildOpening();
    case 'multicurve':
      return buildMulticurve();
  }
}

async function encodeLaunch(
  factory: DopplerFactory<1>,
  style: LaunchStyle,
  params: Doppler404LaunchParams,
): Promise<void> {
  switch (style) {
    case 'static':
      await factory.encodeCreateStaticAuctionParams(
        params as CreateStaticAuctionParams<1>,
      );
      return;
    case 'dynamic':
      await factory.encodeCreateDynamicAuctionParams(
        params as CreateDynamicAuctionParams<1>,
      );
      return;
    case 'opening':
      await factory.encodeCreateOpeningAuctionParams(
        params as CreateOpeningAuctionParams<1>,
      );
      return;
    case 'multicurve':
      factory.encodeCreateMulticurveParams(params as CreateMulticurveParams<1>);
  }
}

async function encodeTokenFactory(
  factory: DopplerFactory<1>,
  style: LaunchStyle,
  params: Doppler404LaunchParams,
): Promise<Address> {
  switch (style) {
    case 'static':
      return (
        await factory.encodeCreateStaticAuctionParams(
          params as CreateStaticAuctionParams<1>,
        )
      ).tokenFactory;
    case 'dynamic':
      return (
        await factory.encodeCreateDynamicAuctionParams(
          params as CreateDynamicAuctionParams<1>,
        )
      ).createParams.tokenFactory;
    case 'opening':
      return (
        await factory.encodeCreateOpeningAuctionParams(
          params as CreateOpeningAuctionParams<1>,
        )
      ).createParams.tokenFactory;
    case 'multicurve':
      return factory.encodeCreateMulticurveParams(
        params as CreateMulticurveParams<1>,
      ).tokenFactory;
  }
}

describe('DopplerFactory Doppler404 token routing', () => {
  let factory: DopplerFactory<1>;
  let publicClient: ReturnType<typeof createMockPublicClient>;

  beforeEach(() => {
    mockAddresses.doppler404Factory = configuredDoppler404Factory;
    publicClient = createMockPublicClient();
    vi.mocked((publicClient as PublicClient).readContract)
      .mockResolvedValueOnce(mockAddresses.poolManager)
      .mockResolvedValueOnce(mockAddresses.dopplerDeployer);
    factory = new DopplerFactory(publicClient, createMockWalletClient(), 1);
  });

  it('defaults unit to one whole token for every launch style', async () => {
    const staticParams =
      await factory.encodeCreateStaticAuctionParams(buildStatic());
    const dynamicParams =
      await factory.encodeCreateDynamicAuctionParams(buildDynamic());
    const openingParams =
      await factory.encodeCreateOpeningAuctionParams(buildOpening());
    const multicurveParams =
      factory.encodeCreateMulticurveParams(buildMulticurve());

    expect([
      decodeUnit(staticParams.tokenFactoryData),
      decodeUnit(dynamicParams.createParams.tokenFactoryData),
      decodeUnit(openingParams.createParams.tokenFactoryData),
      decodeUnit(multicurveParams.tokenFactoryData),
    ]).toEqual([WAD, WAD, WAD, WAD]);
  });

  it.each<LaunchStyle>(['static', 'dynamic', 'opening', 'multicurve'])(
    'preserves an explicitly configured unit for %s launches',
    async (launchStyle) => {
      const customUnit = 25n * WAD;
      const params = buildLaunch(launchStyle);
      params.token = tokenConfig(customUnit);

      switch (launchStyle) {
        case 'static':
          expect(
            decodeUnit(
              (
                await factory.encodeCreateStaticAuctionParams(
                  params as CreateStaticAuctionParams<1>,
                )
              ).tokenFactoryData,
            ),
          ).toBe(customUnit);
          break;
        case 'dynamic':
          expect(
            decodeUnit(
              (
                await factory.encodeCreateDynamicAuctionParams(
                  params as CreateDynamicAuctionParams<1>,
                )
              ).createParams.tokenFactoryData,
            ),
          ).toBe(customUnit);
          break;
        case 'opening':
          expect(
            decodeUnit(
              (
                await factory.encodeCreateOpeningAuctionParams(
                  params as CreateOpeningAuctionParams<1>,
                )
              ).createParams.tokenFactoryData,
            ),
          ).toBe(customUnit);
          break;
        case 'multicurve':
          expect(
            decodeUnit(
              factory.encodeCreateMulticurveParams(
                params as CreateMulticurveParams<1>,
              ).tokenFactoryData,
            ),
          ).toBe(customUnit);
      }
    },
  );

  it.each<LaunchStyle>(['static', 'dynamic', 'opening', 'multicurve'])(
    'rejects vesting for %s launches',
    async (launchStyle) => {
      const params = buildLaunch(launchStyle);
      params.vesting = vesting;

      await expect(encodeLaunch(factory, launchStyle, params)).rejects.toThrow(
        'Doppler404 tokens do not support vesting',
      );
      expect(publicClient.getBlock).not.toHaveBeenCalled();
      expect(publicClient.readContract).not.toHaveBeenCalled();
      expect(publicClient.simulateContract).not.toHaveBeenCalled();
    },
  );

  it.each<LaunchStyle>(['static', 'dynamic', 'opening', 'multicurve'])(
    'accepts a compatible token factory override for %s launches on a configured chain',
    async (launchStyle) => {
      const params = buildLaunch(launchStyle);
      params.modules = { ...params.modules, tokenFactory: customTokenFactory };

      await expect(
        encodeTokenFactory(factory, launchStyle, params),
      ).resolves.toBe(customTokenFactory);
    },
  );

  it.each<LaunchStyle>(['static', 'dynamic', 'opening', 'multicurve'])(
    'rejects a generic token factory override for %s launches when the chain lacks Doppler404',
    async (launchStyle) => {
      mockAddresses.doppler404Factory = undefined;
      const params = buildLaunch(launchStyle);
      params.modules = { ...params.modules, tokenFactory: customTokenFactory };

      await expect(encodeLaunch(factory, launchStyle, params)).rejects.toThrow(
        'Doppler404 factory address not configured for this chain',
      );
      expect(publicClient.getBlock).not.toHaveBeenCalled();
      expect(publicClient.readContract).not.toHaveBeenCalled();
      expect(publicClient.simulateContract).not.toHaveBeenCalled();
    },
  );
});
