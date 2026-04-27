import { beforeEach, describe, expect, it, vi } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import { encodeAbiParameters, parseEther, type Address } from 'viem';
import { DopplerFactory } from '../../../../src/evm/entities/DopplerFactory';
import { CHAIN_IDS, getAddresses } from '../../../../src/evm/addresses';
import type {
  SupportedPublicClient,
  CreateStaticAuctionParams,
  CreateDynamicAuctionParams,
  CreateMulticurveParams,
  CreateOpeningAuctionParams,
} from '../../../../src/evm/types';
import { isToken0Expected } from '../../../../src/evm/utils';

describe('DopplerFactory governance encoding', () => {
  let factory: DopplerFactory;
  let publicClient: SupportedPublicClient;
  let simulateContractMock: ReturnType<typeof vi.fn>;
  let getBlockMock: ReturnType<typeof vi.fn>;
  let readContractMock: ReturnType<typeof vi.fn>;
  const account = privateKeyToAccount(
    '0x1234567890123456789012345678901234567890123456789012345678901234',
  );
  const launchpadMultisig =
    '0x1234567890123456789012345678901234567890' as Address;
  const expectedLaunchpadFactory =
    getAddresses(CHAIN_IDS.BASE_SEPOLIA).launchpadGovernanceFactory;
  const expectedLaunchpadFactoryData = encodeAbiParameters(
    [{ type: 'address' }],
    [launchpadMultisig],
  );

  beforeEach(() => {
    simulateContractMock = vi.fn().mockResolvedValue({
      result: [
        '0xffffffffffffffffffffffffffffffffffffffff',
        '0x0000000000000000000000000000000000000001',
      ],
    });
    getBlockMock = vi.fn().mockResolvedValue({ timestamp: 1n });
    readContractMock = vi.fn();

    publicClient = {
      simulateContract: simulateContractMock,
      getBlock: getBlockMock,
      readContract: readContractMock,
    } as unknown as SupportedPublicClient;

    factory = new DopplerFactory(
      publicClient,
      undefined,
      CHAIN_IDS.BASE_SEPOLIA,
    );
  });

  it('omits governance payload for static auctions with noOp governance', async () => {
    const params: CreateStaticAuctionParams = {
      token: {
        name: 'NoOp Token',
        symbol: 'NOP',
        tokenURI: 'https://example.com/token.json',
      },
      sale: {
        initialSupply: parseEther('1000000'),
        numTokensToSell: parseEther('500000'),
        numeraire: '0x4200000000000000000000000000000000000006' as Address,
      },
      pool: {
        startTick: -276400,
        endTick: -276200,
        fee: 10000,
      },
      governance: { type: 'noOp' },
      migration: {
        type: 'uniswapV2',
      },
      userAddress: account.address,
    };

    const result = await factory.encodeCreateStaticAuctionParams(params);

    expect(result.governanceFactoryData).toBe('0x');
  });

  it('encodes governance payload for static auctions with launchpad governance', async () => {
    const params: CreateStaticAuctionParams = {
      token: {
        name: 'Launchpad Token',
        symbol: 'LCH',
        tokenURI: 'https://example.com/token.json',
      },
      sale: {
        initialSupply: parseEther('1000000'),
        numTokensToSell: parseEther('500000'),
        numeraire: '0x4200000000000000000000000000000000000006' as Address,
      },
      pool: {
        startTick: -276400,
        endTick: -276200,
        fee: 10000,
      },
      governance: { type: 'launchpad', multisig: launchpadMultisig },
      migration: {
        type: 'uniswapV2',
      },
      userAddress: account.address,
    };

    const result = await factory.encodeCreateStaticAuctionParams(params);

    expect(result.governanceFactory).toBe(expectedLaunchpadFactory);
    expect(result.governanceFactoryData).toBe(expectedLaunchpadFactoryData);
  });

  it('omits governance payload for dynamic auctions with noOp governance', async () => {
    const numeraire = '0x4200000000000000000000000000000000000006' as Address;
    const token0Expected = isToken0Expected(numeraire);

    const params: CreateDynamicAuctionParams = {
      token: {
        name: 'NoOp Dynamic Token',
        symbol: 'NOD',
        tokenURI: 'https://example.com/token.json',
      },
      sale: {
        initialSupply: parseEther('2000000'),
        numTokensToSell: parseEther('750000'),
        numeraire,
      },
      auction: {
        duration: 7 * 24 * 60 * 60,
        epochLength: 3600,
        startTick: token0Expected ? 92103 : -92103,
        endTick: token0Expected ? 69080 : -69080,
        gamma: 1200,
        minProceeds: parseEther('100'),
        maxProceeds: parseEther('5000'),
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
          lockDuration: 7 * 24 * 60 * 60,
          beneficiaries: [
            { beneficiary: account.address, shares: parseEther('1') },
          ],
        },
      },
      userAddress: account.address,
      startTimeOffset: 45,
      blockTimestamp: 1,
    };

    const { createParams } =
      await factory.encodeCreateDynamicAuctionParams(params);

    expect(createParams.governanceFactoryData).toBe('0x');
  });

  it('encodes governance payload for dynamic auctions with launchpad governance', async () => {
    const numeraire = '0x4200000000000000000000000000000000000006' as Address;
    const token0Expected = isToken0Expected(numeraire);

    const params: CreateDynamicAuctionParams = {
      token: {
        name: 'Launchpad Dynamic Token',
        symbol: 'LDY',
        tokenURI: 'https://example.com/token.json',
      },
      sale: {
        initialSupply: parseEther('2000000'),
        numTokensToSell: parseEther('750000'),
        numeraire,
      },
      auction: {
        duration: 7 * 24 * 60 * 60,
        epochLength: 3600,
        startTick: token0Expected ? 92103 : -92103,
        endTick: token0Expected ? 69080 : -69080,
        gamma: 1200,
        minProceeds: parseEther('100'),
        maxProceeds: parseEther('5000'),
      },
      pool: {
        fee: 3000,
        tickSpacing: 10,
      },
      governance: { type: 'launchpad', multisig: launchpadMultisig },
      migration: {
        type: 'uniswapV4',
        fee: 3000,
        tickSpacing: 10,
        streamableFees: {
          lockDuration: 7 * 24 * 60 * 60,
          beneficiaries: [
            { beneficiary: account.address, shares: parseEther('1') },
          ],
        },
      },
      userAddress: account.address,
      startTimeOffset: 45,
      blockTimestamp: 1,
    };

    const { createParams } =
      await factory.encodeCreateDynamicAuctionParams(params);

    expect(createParams.governanceFactory).toBe(expectedLaunchpadFactory);
    expect(createParams.governanceFactoryData).toBe(
      expectedLaunchpadFactoryData,
    );
  });

  it('omits governance payload for multicurve auctions with noOp governance', () => {
    const params: CreateMulticurveParams = {
      token: {
        name: 'NoOp Multi Token',
        symbol: 'NOM',
        tokenURI: 'https://example.com/token.json',
      },
      sale: {
        initialSupply: parseEther('3000000'),
        numTokensToSell: parseEther('1000000'),
        numeraire: '0x4200000000000000000000000000000000000006' as Address,
      },
      pool: {
        fee: 3000,
        tickSpacing: 60,
        curves: [
          {
            tickLower: 1000,
            tickUpper: 5000,
            numPositions: 4,
            shares: parseEther('0.5'),
          },
          {
            tickLower: 5000,
            tickUpper: 9000,
            numPositions: 4,
            shares: parseEther('0.5'),
          },
        ],
      },
      governance: { type: 'noOp' },
      migration: { type: 'uniswapV2' },
      userAddress: account.address,
    };

    const createParams = factory.encodeCreateMulticurveParams(params);

    expect(createParams.governanceFactoryData).toBe('0x');
  });

  it('encodes governance payload for multicurve auctions with launchpad governance', () => {
    const params: CreateMulticurveParams = {
      token: {
        name: 'Launchpad Multi Token',
        symbol: 'LMT',
        tokenURI: 'https://example.com/token.json',
      },
      sale: {
        initialSupply: parseEther('3000000'),
        numTokensToSell: parseEther('1000000'),
        numeraire: '0x4200000000000000000000000000000000000006' as Address,
      },
      pool: {
        fee: 3000,
        tickSpacing: 60,
        curves: [
          {
            tickLower: 1000,
            tickUpper: 5000,
            numPositions: 4,
            shares: parseEther('0.5'),
          },
          {
            tickLower: 5000,
            tickUpper: 9000,
            numPositions: 4,
            shares: parseEther('0.5'),
          },
        ],
      },
      governance: { type: 'launchpad', multisig: launchpadMultisig },
      migration: { type: 'uniswapV2' },
      userAddress: account.address,
    };

    const createParams = factory.encodeCreateMulticurveParams(params);

    expect(createParams.governanceFactory).toBe(expectedLaunchpadFactory);
    expect(createParams.governanceFactoryData).toBe(expectedLaunchpadFactoryData);
  });

  it('encodes governance payload for opening auctions with launchpad governance', async () => {
    const openingAuctionInitializer =
      '0x9100000000000000000000000000000000000001' as Address;
    const poolManager =
      '0x9100000000000000000000000000000000000002' as Address;
    const auctionDeployer =
      '0x9100000000000000000000000000000000000003' as Address;
    const minedSalt =
      '0x00000000000000000000000000000000000000000000000000000000000000ac' as const;
    const minedHook = '0x9200000000000000000000000000000000000003' as Address;
    const minedToken = '0x0100000000000000000000000000000000000003' as Address;
    const encodedTokenFactoryData = '0xfeedbeef' as const;

    readContractMock
      .mockResolvedValueOnce(poolManager)
      .mockResolvedValueOnce(auctionDeployer);

    vi.spyOn(
      factory as unknown as {
        mineOpeningAuctionHookAddress: () => readonly [
          `0x${string}`,
          Address,
          Address,
          `0x${string}`,
        ];
      },
      'mineOpeningAuctionHookAddress',
    ).mockReturnValue([
      minedSalt,
      minedHook,
      minedToken,
      encodedTokenFactoryData,
    ]);

    const params: CreateOpeningAuctionParams = {
      token: {
        name: 'Launchpad Opening Token',
        symbol: 'LOT',
        tokenURI: 'https://example.com/token.json',
      },
      sale: {
        initialSupply: parseEther('1000000'),
        numTokensToSell: parseEther('500000'),
        numeraire: '0x4200000000000000000000000000000000000006' as Address,
      },
      openingAuction: {
        auctionDuration: 3600,
        minAcceptableTickToken0: -1200,
        minAcceptableTickToken1: 1200,
        incentiveShareBps: 500,
        tickSpacing: 60,
        fee: 3000,
        minLiquidity: 1n,
        shareToAuctionBps: 2000,
      },
      doppler: {
        minProceeds: parseEther('100'),
        maxProceeds: parseEther('10000'),
        startTick: 900,
        endTick: 1000,
        epochLength: 3600,
        duration: 24 * 3600,
        fee: 3000,
        tickSpacing: 10,
      },
      governance: { type: 'launchpad', multisig: launchpadMultisig },
      migration: { type: 'uniswapV2' },
      userAddress: account.address,
      blockTimestamp: 1_700_000_000,
      modules: {
        openingAuctionInitializer,
      },
    };

    const result = await factory.encodeCreateOpeningAuctionParams(params);

    expect(result.createParams.governanceFactory).toBe(expectedLaunchpadFactory);
    expect(result.createParams.governanceFactoryData).toBe(
      expectedLaunchpadFactoryData,
    );
  });
});
