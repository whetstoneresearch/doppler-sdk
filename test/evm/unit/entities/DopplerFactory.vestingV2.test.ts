import { beforeEach, describe, expect, it, vi } from 'vitest';
import { decodeAbiParameters, getAddress, parseEther, type Address } from 'viem';
import { DAY_SECONDS, WAD } from '../../../../src/evm/constants';
import {
  DynamicAuctionBuilder,
  MulticurveBuilder,
  OpeningAuctionBuilder,
  StaticAuctionBuilder,
} from '../../../../src/evm/builders';
import { DopplerFactory } from '../../../../src/evm/entities/DopplerFactory';
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
const secondaryRecipient =
  '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address;
const tertiaryRecipient =
  '0xfedcfedcfedcfedcfedcfedcfedcfedcfedcfedc' as Address;

const STANDARD_TOKEN_V2_DATA_ABI = [
  { type: 'string' },
  { type: 'string' },
  { type: 'uint256' },
  {
    type: 'tuple[]',
    components: [
      { type: 'uint64', name: 'cliff' },
      { type: 'uint64', name: 'duration' },
    ],
  },
  { type: 'address[]' },
  { type: 'uint256[]' },
  { type: 'uint256[]' },
  { type: 'string' },
] as const;

function decodeV2TokenFactoryData(data: `0x${string}`) {
  return decodeAbiParameters(STANDARD_TOKEN_V2_DATA_ABI, data) as readonly [
    string,
    string,
    bigint,
    readonly { cliff: bigint; duration: bigint }[],
    readonly Address[],
    readonly bigint[],
    readonly bigint[],
    string,
  ];
}

describe('DopplerFactory V2 cliff vesting', () => {
  let factory: DopplerFactory;

  beforeEach(() => {
    factory = new DopplerFactory(
      createMockPublicClient(),
      createMockWalletClient(),
      1,
    );
  });

  it('uses the V2 factory for static auctions with cliffs', async () => {
    const params = StaticAuctionBuilder.forChain(1)
      .tokenConfig({
        name: 'Static Cliff',
        symbol: 'STCL',
        tokenURI: 'ipfs://static-cliff',
      })
      .saleConfig({
        initialSupply: parseEther('1000000'),
        numTokensToSell: parseEther('900000'),
        numeraire: mockAddresses.weth,
      })
      .poolByTicks({
        startTick: -120000,
        endTick: -60000,
        fee: 3000,
      })
      .withVesting({
        duration: 180n * BigInt(DAY_SECONDS),
        cliffDuration: 90 * DAY_SECONDS,
        recipients: [userAddress, secondaryRecipient],
        amounts: [parseEther('60000'), parseEther('40000')],
      })
      .withGovernance({ type: 'noOp' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(userAddress)
      .build();

    const createParams = await factory.encodeCreateStaticAuctionParams(params);
    const decoded = decodeV2TokenFactoryData(createParams.tokenFactoryData);

    expect(createParams.tokenFactory).toBe(mockAddresses.derc20V2Factory);
    expect(decoded[0]).toBe('Static Cliff');
    expect(decoded[1]).toBe('STCL');
    expect(decoded[3]).toEqual([
      { cliff: 90n * BigInt(DAY_SECONDS), duration: 180n * BigInt(DAY_SECONDS) },
    ]);
    expect(decoded[4]).toEqual([
      getAddress(userAddress),
      getAddress(secondaryRecipient),
    ]);
    expect(decoded[5]).toEqual([0n, 0n]);
    expect(decoded[6]).toEqual([parseEther('60000'), parseEther('40000')]);
  });

  it('uses the V2 factory for dynamic auctions with cliffs', async () => {
    const params = DynamicAuctionBuilder.forChain(1)
      .tokenConfig({
        name: 'Dynamic Cliff',
        symbol: 'DYCL',
        tokenURI: 'ipfs://dynamic-cliff',
      })
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
      .withVesting({
        duration: 180n * BigInt(DAY_SECONDS),
        cliffDuration: 90 * DAY_SECONDS,
        recipients: [userAddress],
        amounts: [parseEther('100000')],
      })
      .withGovernance({ type: 'noOp' })
      .withMigration({ type: 'uniswapV4', fee: 3000, tickSpacing: 10 })
      .withUserAddress(userAddress)
      .build();

    const { createParams } = await factory.encodeCreateDynamicAuctionParams(
      params,
    );
    const decoded = decodeV2TokenFactoryData(createParams.tokenFactoryData);

    expect(createParams.tokenFactory).toBe(mockAddresses.derc20V2Factory);
    expect(decoded[3]).toEqual([
      { cliff: 90n * BigInt(DAY_SECONDS), duration: 180n * BigInt(DAY_SECONDS) },
    ]);
    expect(decoded[4]).toEqual([userAddress]);
    expect(decoded[5]).toEqual([0n]);
    expect(decoded[6]).toEqual([parseEther('100000')]);
  });

  it('assigns one custom schedule per allocation', async () => {
    const params = StaticAuctionBuilder.forChain(1)
      .tokenConfig({
        name: 'Scheduled Cliff',
        symbol: 'SCFL',
        tokenURI: 'ipfs://scheduled-cliff',
      })
      .saleConfig({
        initialSupply: parseEther('1000000'),
        numTokensToSell: parseEther('900000'),
        numeraire: mockAddresses.weth,
      })
      .poolByTicks({
        startTick: -120000,
        endTick: -60000,
        fee: 3000,
      })
      .withVesting({
        allocations: [
          {
            recipient: userAddress,
            amount: parseEther('55000'),
            schedule: {
              duration: 180n * BigInt(DAY_SECONDS),
              cliffDuration: 30 * DAY_SECONDS,
            },
          },
          {
            recipient: secondaryRecipient,
            amount: parseEther('45000'),
            schedule: {
              duration: 365n * BigInt(DAY_SECONDS),
              cliffDuration: 90 * DAY_SECONDS,
            },
          },
        ],
      })
      .withGovernance({ type: 'noOp' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(userAddress)
      .build();

    const createParams = await factory.encodeCreateStaticAuctionParams(params);
    const decoded = decodeV2TokenFactoryData(createParams.tokenFactoryData);

    expect(createParams.tokenFactory).toBe(mockAddresses.derc20V2Factory);
    expect(decoded[3]).toEqual([
      { cliff: 30n * BigInt(DAY_SECONDS), duration: 180n * BigInt(DAY_SECONDS) },
      { cliff: 90n * BigInt(DAY_SECONDS), duration: 365n * BigInt(DAY_SECONDS) },
    ]);
    expect(decoded[4]).toEqual([
      getAddress(userAddress),
      getAddress(secondaryRecipient),
    ]);
    expect(decoded[5]).toEqual([0n, 1n]);
    expect(decoded[6]).toEqual([parseEther('55000'), parseEther('45000')]);
  });

  it('dedupes identical allocation schedules across recipients', () => {
    const params = MulticurveBuilder.forChain(1)
      .tokenConfig({
        name: 'Mapped Schedules',
        symbol: 'MAP',
        tokenURI: 'ipfs://mapped-schedules',
      })
      .saleConfig({
        initialSupply: parseEther('1000000'),
        numTokensToSell: parseEther('700000'),
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
      .withVesting({
        allocations: [
          {
            recipient: userAddress,
            amount: parseEther('120000'),
            schedule: {
              duration: 180n * BigInt(DAY_SECONDS),
              cliffDuration: 30 * DAY_SECONDS,
            },
          },
          {
            recipient: secondaryRecipient,
            amount: parseEther('80000'),
            schedule: {
              duration: 365n * BigInt(DAY_SECONDS),
              cliffDuration: 120 * DAY_SECONDS,
            },
          },
          {
            recipient: tertiaryRecipient,
            amount: parseEther('100000'),
            schedule: {
              duration: 365n * BigInt(DAY_SECONDS),
              cliffDuration: 120 * DAY_SECONDS,
            },
          },
        ],
      })
      .withGovernance({ type: 'noOp' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(userAddress)
      .build();

    const createParams = factory.encodeCreateMulticurveParams(params);
    const decoded = decodeV2TokenFactoryData(createParams.tokenFactoryData);

    expect(decoded[3]).toEqual([
      { cliff: 30n * BigInt(DAY_SECONDS), duration: 180n * BigInt(DAY_SECONDS) },
      {
        cliff: 120n * BigInt(DAY_SECONDS),
        duration: 365n * BigInt(DAY_SECONDS),
      },
    ]);
    expect(decoded[5]).toEqual([0n, 1n, 1n]);
    expect(decoded[6]).toEqual([
      parseEther('120000'),
      parseEther('80000'),
      parseEther('100000'),
    ]);
  });

  it('uses the V2 factory for opening auctions with cliffs', async () => {
    const publicClient = createMockPublicClient() as any;
    vi.mocked(publicClient.readContract)
      .mockResolvedValueOnce(mockAddresses.poolManager as any)
      .mockResolvedValueOnce(mockAddresses.dopplerDeployer as any);
    factory = new DopplerFactory(publicClient, createMockWalletClient(), 1);

    const params = OpeningAuctionBuilder.forChain(1)
      .tokenConfig({
        name: 'Opening Cliff',
        symbol: 'OPCL',
        tokenURI: 'ipfs://opening-cliff',
      })
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
      .withVesting({
        duration: 180n * BigInt(DAY_SECONDS),
        cliffDuration: 90 * DAY_SECONDS,
      })
      .withGovernance({ type: 'noOp' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(userAddress)
      .withOpeningAuctionInitializer(mockAddresses.v4Initializer)
      .build();

    const { createParams } = await factory.encodeCreateOpeningAuctionParams(
      params,
    );
    const decoded = decodeV2TokenFactoryData(createParams.tokenFactoryData);

    expect(createParams.tokenFactory).toBe(mockAddresses.derc20V2Factory);
    expect(decoded[3]).toEqual([
      { cliff: 90n * BigInt(DAY_SECONDS), duration: 180n * BigInt(DAY_SECONDS) },
    ]);
    expect(decoded[4]).toEqual([userAddress]);
    expect(decoded[5]).toEqual([0n]);
    expect(decoded[6]).toEqual([parseEther('100000')]);
  });

  it('uses the V2 factory for multicurve auctions with cliffs', () => {
    const params = MulticurveBuilder.forChain(1)
      .tokenConfig({
        name: 'Multicurve Cliff',
        symbol: 'MUCL',
        tokenURI: 'ipfs://multicurve-cliff',
      })
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
      .withVesting({
        duration: 180n * BigInt(DAY_SECONDS),
        cliffDuration: 90 * DAY_SECONDS,
      })
      .withGovernance({ type: 'noOp' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(userAddress)
      .build();

    const createParams = factory.encodeCreateMulticurveParams(params);
    const decoded = decodeV2TokenFactoryData(createParams.tokenFactoryData);

    expect(createParams.tokenFactory).toBe(mockAddresses.derc20V2Factory);
    expect(decoded[3]).toEqual([
      { cliff: 90n * BigInt(DAY_SECONDS), duration: 180n * BigInt(DAY_SECONDS) },
    ]);
    expect(decoded[4]).toEqual([userAddress]);
    expect(decoded[5]).toEqual([0n]);
    expect(decoded[6]).toEqual([parseEther('100000')]);
  });

  it('rejects cliff durations greater than the vesting duration', () => {
    const params = MulticurveBuilder.forChain(1)
      .tokenConfig({
        name: 'Bad Cliff',
        symbol: 'BAD',
        tokenURI: 'ipfs://bad-cliff',
      })
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
      .withVesting({
        duration: 89n * BigInt(DAY_SECONDS),
        cliffDuration: 90 * DAY_SECONDS,
      })
      .withGovernance({ type: 'noOp' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(userAddress)
      .build();

    expect(() => factory.encodeCreateMulticurveParams(params)).toThrow(
      'Vesting cliff duration cannot exceed vesting duration',
    );
  });

  it('rejects cliff vesting durations shorter than one day', () => {
    const params = MulticurveBuilder.forChain(1)
      .tokenConfig({
        name: 'Short Cliff',
        symbol: 'SHRT',
        tokenURI: 'ipfs://short-cliff',
      })
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
      .withVesting({
        duration: 3600n,
        cliffDuration: 1800,
      })
      .withGovernance({ type: 'noOp' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(userAddress)
      .build();

    expect(() => factory.encodeCreateMulticurveParams(params)).toThrow(
      `Vesting duration must be 0 or at least ${DAY_SECONDS} seconds when using cliffs`,
    );
  });

  it('rejects direct factory caller input that mixes allocations with shared vesting fields', () => {
    const params = MulticurveBuilder.forChain(1)
      .tokenConfig({
        name: 'Mixed Schedules',
        symbol: 'MIX',
        tokenURI: 'ipfs://mixed-schedules',
      })
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
      .withVesting({
        duration: 180n * BigInt(DAY_SECONDS),
        allocations: [
          {
            recipient: userAddress,
            amount: parseEther('100000'),
            schedule: {
              duration: 365n * BigInt(DAY_SECONDS),
              cliffDuration: 90 * DAY_SECONDS,
            },
          },
        ],
      } as any)
      .withGovernance({ type: 'noOp' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(userAddress)
      .build();

    // Simulate malformed runtime input from a direct caller bypassing builder typing.
    (params.vesting as any).duration = 180 * DAY_SECONDS;

    expect(() => factory.encodeCreateMulticurveParams(params)).toThrow(
      'Use vesting.allocations instead of top-level duration/cliffDuration/recipients/amounts when configuring per-beneficiary vesting',
    );
  });

  it('rejects empty allocation arrays', () => {
    const params = MulticurveBuilder.forChain(1)
      .tokenConfig({
        name: 'Empty Allocations',
        symbol: 'EMPTY',
        tokenURI: 'ipfs://empty-allocations',
      })
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
      .withVesting({
        allocations: [],
      })
      .withGovernance({ type: 'noOp' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(userAddress)
      .build();

    expect(() => factory.encodeCreateMulticurveParams(params)).toThrow(
      'Vesting allocations array cannot be empty',
    );
  });

  it('rejects non-integer allocation schedule values for direct factory callers', () => {
    const params = MulticurveBuilder.forChain(1)
      .tokenConfig({
        name: 'Fractional Schedule',
        symbol: 'FRACT',
        tokenURI: 'ipfs://fractional-schedule',
      })
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
      .withVesting({
        allocations: [
          {
            recipient: userAddress,
            amount: parseEther('100000'),
            schedule: {
              duration: 180n * BigInt(DAY_SECONDS),
              cliffDuration: 30 * DAY_SECONDS,
            },
          },
        ],
      })
      .withGovernance({ type: 'noOp' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(userAddress)
      .build();

    (params.vesting!.allocations as any)[0].schedule.duration = Number.NaN;

    expect(() => factory.encodeCreateMulticurveParams(params)).toThrow(
      'Vesting allocations[0].schedule.duration must be a finite integer',
    );
  });

  it('rejects non-safe allocation schedule values for direct factory callers', () => {
    const params = MulticurveBuilder.forChain(1)
      .tokenConfig({
        name: 'Unsafe Schedule',
        symbol: 'UNSAFE',
        tokenURI: 'ipfs://unsafe-schedule',
      })
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
      .withVesting({
        allocations: [
          {
            recipient: userAddress,
            amount: parseEther('100000'),
            schedule: {
              duration: 180n * BigInt(DAY_SECONDS),
              cliffDuration: 30 * DAY_SECONDS,
            },
          },
        ],
      })
      .withGovernance({ type: 'noOp' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(userAddress)
      .build();

    (params.vesting!.allocations as any)[0].schedule.duration =
      Number.MAX_SAFE_INTEGER + 1;

    expect(() => factory.encodeCreateMulticurveParams(params)).toThrow(
      'Vesting allocations[0].schedule.duration must be a safe integer',
    );
  });

  it('rejects legacy tokenFactory overrides when cliffs are requested', async () => {
    const params = StaticAuctionBuilder.forChain(1)
      .tokenConfig({
        name: 'Legacy Override',
        symbol: 'LEGO',
        tokenURI: 'ipfs://legacy-override',
      })
      .saleConfig({
        initialSupply: parseEther('1000000'),
        numTokensToSell: parseEther('900000'),
        numeraire: mockAddresses.weth,
      })
      .poolByTicks({
        startTick: -120000,
        endTick: -60000,
        fee: 3000,
      })
      .withVesting({
        duration: 180n * BigInt(DAY_SECONDS),
        cliffDuration: 90 * DAY_SECONDS,
      })
      .withGovernance({ type: 'noOp' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(userAddress)
      .withTokenFactory(mockAddresses.tokenFactory)
      .build();

    await expect(factory.encodeCreateStaticAuctionParams(params)).rejects.toThrow(
      'Cliff vesting requires the DERC20 V2 factory. Remove the tokenFactory override or point it at the chain DERC20 V2 factory.',
    );
  });
});
