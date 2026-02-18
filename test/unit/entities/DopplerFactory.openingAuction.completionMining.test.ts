import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Address, Hash } from 'viem';
import { encodeAbiParameters, getAddress, zeroAddress } from 'viem';
import { DopplerFactory } from '../../../src/entities/DopplerFactory';
import type { OpeningAuctionState } from '../../../src/types';
import { OpeningAuctionStatus } from '../../../src/types';
import {
  createMockPublicClient,
  createMockWalletClient,
} from '../../setup/fixtures/clients';
import { mockAddresses } from '../../setup/fixtures/addresses';
import { MAX_TICK, MIN_TICK } from '../../../src/utils/tickMath';

vi.mock('../../../src/addresses', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/addresses')>();
  return {
    ...actual,
    getAddresses: vi.fn(() => mockAddresses),
  };
});

const toSalt = (n: bigint): Hash =>
  `0x${n.toString(16).padStart(64, '0')}` as Hash;

const encodeDopplerInitData = (data: {
  minimumProceeds: bigint;
  maximumProceeds: bigint;
  startingTime: bigint;
  endingTime: bigint;
  startingTick: number;
  endingTick: number;
  epochLength: bigint;
  gamma: number;
  isToken0: boolean;
  numPDSlugs: bigint;
  lpFee: number;
  tickSpacing: number;
}): `0x${string}` => {
  return encodeAbiParameters(
    [
      { type: 'uint256' }, // minimumProceeds
      { type: 'uint256' }, // maximumProceeds
      { type: 'uint256' }, // startingTime
      { type: 'uint256' }, // endingTime
      { type: 'int24' }, // startingTick
      { type: 'int24' }, // endingTick
      { type: 'uint256' }, // epochLength
      { type: 'int24' }, // gamma
      { type: 'bool' }, // isToken0
      { type: 'uint256' }, // numPDSlugs
      { type: 'uint24' }, // lpFee
      { type: 'int24' }, // tickSpacing
    ],
    [
      data.minimumProceeds,
      data.maximumProceeds,
      data.startingTime,
      data.endingTime,
      data.startingTick,
      data.endingTick,
      data.epochLength,
      data.gamma,
      data.isToken0,
      data.numPDSlugs,
      data.lpFee,
      data.tickSpacing,
    ],
  ) as `0x${string}`;
};

const buildOpeningAuctionState = (params: {
  asset: Address;
  openingAuctionHook: Address;
  dopplerInitData: `0x${string}`;
  isToken0: boolean;
  tickSpacing: number;
}): OpeningAuctionState => {
  return {
    numeraire: mockAddresses.weth,
    auctionStartTime: 1n,
    auctionEndTime: 2n,
    auctionTokens: 3n,
    dopplerTokens: 4n,
    status: OpeningAuctionStatus.DopplerActive,
    openingAuctionHook: params.openingAuctionHook,
    dopplerHook: zeroAddress,
    openingAuctionPoolKey: {
      currency0: params.isToken0 ? params.asset : mockAddresses.weth,
      currency1: params.isToken0 ? mockAddresses.weth : params.asset,
      fee: 3000,
      tickSpacing: params.tickSpacing,
      hooks: params.openingAuctionHook,
    },
    dopplerInitData: params.dopplerInitData,
    isToken0: params.isToken0,
  };
};

describe('DopplerFactory opening-auction completion mining correctness', () => {
  let factory: DopplerFactory;
  let publicClient: ReturnType<typeof createMockPublicClient>;
  let walletClient: ReturnType<typeof createMockWalletClient>;

  const asset = getAddress('0x01000000000000000000000000000000000000aa') as Address;
  const openingAuctionHook = getAddress(
    '0x92000000000000000000000000000000000000aa',
  ) as Address;
  const initializerAddress = getAddress(
    '0x91000000000000000000000000000000000000aa',
  ) as Address;
  const poolManager = getAddress(
    '0x91000000000000000000000000000000000000bb',
  ) as Address;
  const dopplerDeployer = getAddress(
    '0x91000000000000000000000000000000000000cc',
  ) as Address;

  beforeEach(() => {
    publicClient = createMockPublicClient();
    walletClient = createMockWalletClient();
    factory = new DopplerFactory(publicClient, walletClient, 1);
  });

  it.each([
    {
      name: 'subtracts reserved incentives from asset balance',
      rawAssetBalance: 1000n,
      incentiveTokensTotal: 900n,
      totalIncentivesClaimed: 200n,
      expectedUnsoldTokens: 300n, // reserved=700
    },
    {
      name: 'floors reserved incentives at 0 when claimed >= total',
      rawAssetBalance: 1000n,
      incentiveTokensTotal: 900n,
      totalIncentivesClaimed: 1000n,
      expectedUnsoldTokens: 1000n, // reserved=0
    },
    {
      name: 'floors unsold tokens at 0 when reserved > balance',
      rawAssetBalance: 500n,
      incentiveTokensTotal: 900n,
      totalIncentivesClaimed: 200n,
      expectedUnsoldTokens: 0n, // reserved=700
    },
  ])('$name', async (t) => {
    const dopplerInitData = encodeDopplerInitData({
      minimumProceeds: 1n,
      maximumProceeds: 2n,
      startingTime: 1_000n,
      endingTime: 2_000n,
      startingTick: 0,
      endingTick: 0,
      epochLength: 1n,
      gamma: 0,
      isToken0: true,
      numPDSlugs: 0n,
      lpFee: 3000,
      tickSpacing: 60,
    });
    const state = buildOpeningAuctionState({
      asset,
      openingAuctionHook,
      dopplerInitData,
      isToken0: true,
      tickSpacing: 60,
    });

    vi.mocked(publicClient.getBytecode).mockResolvedValue('0x');
    vi.mocked(publicClient.readContract).mockImplementation(async (call: any) => {
      switch (call?.functionName) {
        case 'phase':
          return 3;
        case 'clearingTick':
          return 0;
        case 'incentiveTokensTotal':
          return t.incentiveTokensTotal;
        case 'totalIncentivesClaimed':
          return t.totalIncentivesClaimed;
        case 'balanceOf':
          return t.rawAssetBalance;
        case 'poolManager':
          return poolManager;
        case 'dopplerDeployer':
          return dopplerDeployer;
        default:
          throw new Error(`Unexpected readContract: ${call?.functionName}`);
      }
    });

    const mineHookSaltSpy = vi
      .spyOn(factory as any, 'mineDopplerHookSalt')
      .mockReturnValue({
        salt: toSalt(1n),
        hookAddress: getAddress('0x9300000000000000000000000000000000000001') as Address,
      });

    await (factory as any).mineDopplerCompletionSalt({
      asset,
      initializerAddress,
      state,
      blockTimestamp: 0,
    });

    expect(mineHookSaltSpy).toHaveBeenCalledTimes(1);
    expect(mineHookSaltSpy.mock.calls[0][0].unsoldTokens).toBe(
      t.expectedUnsoldTokens,
    );
  });

  it('aligns clearingTick by direction and clamps to aligned MIN/MAX bounds', async () => {
    const tickSpacing = 60;
    const dopplerInitDataT0 = encodeDopplerInitData({
      minimumProceeds: 1n,
      maximumProceeds: 2n,
      startingTime: 1_000n,
      endingTime: 2_000n,
      startingTick: 0,
      endingTick: 0,
      epochLength: 1n,
      gamma: 0,
      isToken0: true,
      numPDSlugs: 0n,
      lpFee: 3000,
      tickSpacing,
    });
    const dopplerInitDataT1 = encodeDopplerInitData({
      minimumProceeds: 1n,
      maximumProceeds: 2n,
      startingTime: 1_000n,
      endingTime: 2_000n,
      startingTick: 0,
      endingTick: 0,
      epochLength: 1n,
      gamma: 0,
      isToken0: false,
      numPDSlugs: 0n,
      lpFee: 3000,
      tickSpacing,
    });

    const alignTickTowardZero = (tick: number) => tick - (tick % tickSpacing);
    const minAligned = alignTickTowardZero(MIN_TICK);
    const maxAligned = alignTickTowardZero(MAX_TICK);

    const mineHookSaltSpy = vi
      .spyOn(factory as any, 'mineDopplerHookSalt')
      .mockReturnValue({
        salt: toSalt(1n),
        hookAddress: getAddress('0x9300000000000000000000000000000000000002') as Address,
      });

    vi.mocked(publicClient.getBytecode).mockResolvedValue('0x');
    vi.mocked(publicClient.readContract).mockImplementation(async (call: any) => {
      switch (call?.functionName) {
        case 'phase':
          return 3;
        case 'clearingTick':
          return 1;
        case 'incentiveTokensTotal':
          return 0n;
        case 'totalIncentivesClaimed':
          return 0n;
        case 'balanceOf':
          return 0n;
        case 'poolManager':
          return poolManager;
        case 'dopplerDeployer':
          return dopplerDeployer;
        default:
          throw new Error(`Unexpected readContract: ${call?.functionName}`);
      }
    });

    // Alignment differs based on isToken0 direction.
    await (factory as any).mineDopplerCompletionSalt({
      asset,
      initializerAddress,
      state: buildOpeningAuctionState({
        asset,
        openingAuctionHook,
        dopplerInitData: dopplerInitDataT0,
        isToken0: true,
        tickSpacing,
      }),
      blockTimestamp: 0,
    });
    await (factory as any).mineDopplerCompletionSalt({
      asset,
      initializerAddress,
      state: buildOpeningAuctionState({
        asset,
        openingAuctionHook,
        dopplerInitData: dopplerInitDataT1,
        isToken0: false,
        tickSpacing,
      }),
      blockTimestamp: 0,
    });

    expect(mineHookSaltSpy).toHaveBeenCalledTimes(2);
    expect(mineHookSaltSpy.mock.calls[0][0].dopplerData.startingTick).toBe(0);
    expect(mineHookSaltSpy.mock.calls[1][0].dopplerData.startingTick).toBe(60);

    // Clamp above MAX_TICK
    vi.mocked(publicClient.readContract).mockImplementation(async (call: any) => {
      switch (call?.functionName) {
        case 'phase':
          return 3;
        case 'clearingTick':
          return 900_000;
        case 'incentiveTokensTotal':
          return 0n;
        case 'totalIncentivesClaimed':
          return 0n;
        case 'balanceOf':
          return 0n;
        case 'poolManager':
          return poolManager;
        case 'dopplerDeployer':
          return dopplerDeployer;
        default:
          throw new Error(`Unexpected readContract: ${call?.functionName}`);
      }
    });
    await (factory as any).mineDopplerCompletionSalt({
      asset,
      initializerAddress,
      state: buildOpeningAuctionState({
        asset,
        openingAuctionHook,
        dopplerInitData: dopplerInitDataT0,
        isToken0: true,
        tickSpacing,
      }),
      blockTimestamp: 0,
    });
    expect(mineHookSaltSpy.mock.calls[2][0].dopplerData.startingTick).toBe(
      maxAligned,
    );

    // Clamp below MIN_TICK
    vi.mocked(publicClient.readContract).mockImplementation(async (call: any) => {
      switch (call?.functionName) {
        case 'phase':
          return 3;
        case 'clearingTick':
          return -900_000;
        case 'incentiveTokensTotal':
          return 0n;
        case 'totalIncentivesClaimed':
          return 0n;
        case 'balanceOf':
          return 0n;
        case 'poolManager':
          return poolManager;
        case 'dopplerDeployer':
          return dopplerDeployer;
        default:
          throw new Error(`Unexpected readContract: ${call?.functionName}`);
      }
    });
    await (factory as any).mineDopplerCompletionSalt({
      asset,
      initializerAddress,
      state: buildOpeningAuctionState({
        asset,
        openingAuctionHook,
        dopplerInitData: dopplerInitDataT0,
        isToken0: true,
        tickSpacing,
      }),
      blockTimestamp: 0,
    });
    expect(mineHookSaltSpy.mock.calls[3][0].dopplerData.startingTick).toBe(
      minAligned,
    );
  });

  it('shifts startingTime/endingTime when latest block timestamp is >= doppler startingTime', async () => {
    const dopplerInitData = encodeDopplerInitData({
      minimumProceeds: 1n,
      maximumProceeds: 2n,
      startingTime: 1_000n,
      endingTime: 1_300n, // duration=300
      startingTick: 0,
      endingTick: 0,
      epochLength: 1n,
      gamma: 0,
      isToken0: true,
      numPDSlugs: 0n,
      lpFee: 3000,
      tickSpacing: 60,
    });
    const state = buildOpeningAuctionState({
      asset,
      openingAuctionHook,
      dopplerInitData,
      isToken0: true,
      tickSpacing: 60,
    });

    vi.mocked(publicClient.getBytecode).mockResolvedValue('0x');
    vi.mocked(publicClient.getBlock).mockResolvedValue({ timestamp: 2_000n } as any);
    vi.mocked(publicClient.readContract).mockImplementation(async (call: any) => {
      switch (call?.functionName) {
        case 'phase':
          return 3;
        case 'clearingTick':
          return 0;
        case 'incentiveTokensTotal':
          return 0n;
        case 'totalIncentivesClaimed':
          return 0n;
        case 'balanceOf':
          return 0n;
        case 'poolManager':
          return poolManager;
        case 'dopplerDeployer':
          return dopplerDeployer;
        default:
          throw new Error(`Unexpected readContract: ${call?.functionName}`);
      }
    });

    const mineHookSaltSpy = vi
      .spyOn(factory as any, 'mineDopplerHookSalt')
      .mockReturnValue({
        salt: toSalt(1n),
        hookAddress: getAddress('0x9300000000000000000000000000000000000003') as Address,
      });

    await (factory as any).mineDopplerCompletionSalt({
      asset,
      initializerAddress,
      state,
    });

    expect(publicClient.getBlock).toHaveBeenCalledWith(
      expect.objectContaining({ blockTag: 'latest' }),
    );
    expect(mineHookSaltSpy).toHaveBeenCalledTimes(1);
    expect(mineHookSaltSpy.mock.calls[0][0].dopplerData.startingTime).toBe(2001n);
    expect(mineHookSaltSpy.mock.calls[0][0].dopplerData.endingTime).toBe(2301n);
  });

  it('advances startSalt and retries when first mined hook address has bytecode', async () => {
    const dopplerInitData = encodeDopplerInitData({
      minimumProceeds: 1n,
      maximumProceeds: 2n,
      startingTime: 1_000n,
      endingTime: 2_000n,
      startingTick: 0,
      endingTick: 0,
      epochLength: 1n,
      gamma: 0,
      isToken0: true,
      numPDSlugs: 0n,
      lpFee: 3000,
      tickSpacing: 60,
    });
    const state = buildOpeningAuctionState({
      asset,
      openingAuctionHook,
      dopplerInitData,
      isToken0: true,
      tickSpacing: 60,
    });

    vi.mocked(publicClient.getBytecode)
      .mockResolvedValueOnce('0x6000')
      .mockResolvedValueOnce('0x');
    vi.mocked(publicClient.readContract).mockImplementation(async (call: any) => {
      switch (call?.functionName) {
        case 'phase':
          return 3;
        case 'clearingTick':
          return 0;
        case 'incentiveTokensTotal':
          return 0n;
        case 'totalIncentivesClaimed':
          return 0n;
        case 'balanceOf':
          return 0n;
        case 'poolManager':
          return poolManager;
        case 'dopplerDeployer':
          return dopplerDeployer;
        default:
          throw new Error(`Unexpected readContract: ${call?.functionName}`);
      }
    });

    const mineHookSaltSpy = vi
      .spyOn(factory as any, 'mineDopplerHookSalt')
      .mockReturnValueOnce({
        salt: toSalt(10n),
        hookAddress: getAddress('0x930000000000000000000000000000000000000a') as Address,
      })
      .mockReturnValueOnce({
        salt: toSalt(11n),
        hookAddress: getAddress('0x930000000000000000000000000000000000000b') as Address,
      });

    const mined = await (factory as any).mineDopplerCompletionSalt({
      asset,
      initializerAddress,
      state,
      blockTimestamp: 0,
      startSalt: 10n,
    });

    expect(mineHookSaltSpy).toHaveBeenCalledTimes(2);
    expect(mineHookSaltSpy.mock.calls[0][0].startSalt).toBe(10n);
    expect(mineHookSaltSpy.mock.calls[1][0].startSalt).toBe(11n);
    expect(mined).toEqual({
      dopplerSalt: toSalt(11n),
      dopplerHookAddress: getAddress(
        '0x930000000000000000000000000000000000000b',
      ) as Address,
    });
  });
});

