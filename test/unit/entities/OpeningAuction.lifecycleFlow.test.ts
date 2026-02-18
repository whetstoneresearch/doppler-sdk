import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseEther, type Address, type Hash, zeroAddress } from 'viem';
import { DopplerFactory } from '../../../src/entities/DopplerFactory';
import type { CreateOpeningAuctionParams, CreateParams } from '../../../src/types';
import {
  createMockPublicClient,
  createMockWalletClient,
} from '../../setup/fixtures/clients';
import { mockAddresses } from '../../setup/fixtures/addresses';

vi.mock('../../../src/addresses', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/addresses')>();
  return {
    ...actual,
    getAddresses: vi.fn(() => mockAddresses),
  };
});

const TEST_USER = '0x1234567890123456789012345678901234567890' as Address;
const INITIALIZER_OVERRIDE =
  '0x9100000000000000000000000000000000000001' as Address;

const buildOpeningAuctionParams = (): CreateOpeningAuctionParams => ({
  token: {
    name: 'Opening Auction Token',
    symbol: 'OAT',
    tokenURI: 'https://example.com/oat.json',
  },
  sale: {
    initialSupply: parseEther('1000000'),
    numTokensToSell: parseEther('500000'),
    numeraire: mockAddresses.weth,
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
    startTick: 1000,
    endTick: 900,
    epochLength: 3600,
    duration: 24 * 3600,
    fee: 3000,
    tickSpacing: 10,
  },
  governance: { type: 'default' },
  migration: { type: 'uniswapV2' },
  userAddress: TEST_USER,
  blockTimestamp: 1_700_000_000,
  modules: {
    airlock: mockAddresses.airlock,
    openingAuctionInitializer: INITIALIZER_OVERRIDE,
  },
});

describe('OpeningAuction lifecycle flow (mocked)', () => {
  let publicClient: ReturnType<typeof createMockPublicClient>;
  let walletClient: ReturnType<typeof createMockWalletClient>;
  let factory: DopplerFactory;

  beforeEach(() => {
    publicClient = createMockPublicClient();
    walletClient = createMockWalletClient();
    factory = new DopplerFactory(publicClient, walletClient, 1);
  });

  it('simulateCreateOpeningAuction -> execute -> settleAuction(auto) -> completeOpeningAuction(auto-mined) -> recover/sweep simulations', async () => {
    const asset = '0x01000000000000000000000000000000000000aa' as Address;
    const openingAuctionHook =
      '0x92000000000000000000000000000000000000aa' as Address;

    const minedSalt =
      '0x00000000000000000000000000000000000000000000000000000000000000bb' as Hash;

    const createTx =
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Hash;
    const settleTx =
      '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as Hash;
    const completeTx =
      '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc' as Hash;

    const minedCompletionSalt =
      '0x00000000000000000000000000000000000000000000000000000000000000cc' as Hash;
    const minedDopplerHook =
      '0x93000000000000000000000000000000000000cc' as Address;

    const params = buildOpeningAuctionParams();

    const createParams: CreateParams = {
      initialSupply: params.sale.initialSupply,
      numTokensToSell: params.sale.numTokensToSell,
      numeraire: params.sale.numeraire,
      tokenFactory: mockAddresses.tokenFactory,
      tokenFactoryData: '0x1234',
      governanceFactory: mockAddresses.governanceFactory!,
      governanceFactoryData: '0x',
      poolInitializer: INITIALIZER_OVERRIDE,
      poolInitializerData: '0xabcd',
      liquidityMigrator: mockAddresses.v2Migrator!,
      liquidityMigratorData: '0x',
      integrator: zeroAddress,
      salt: minedSalt,
    };

    const encodeSpy = vi
      .spyOn(factory, 'encodeCreateOpeningAuctionParams')
      .mockResolvedValue({
        createParams,
        hookAddress: openingAuctionHook,
        tokenAddress: asset,
        minedSalt,
      });

    const extractSpy = vi
      .spyOn(factory as any, 'extractAddressesFromCreateEvent')
      .mockReturnValue({
        tokenAddress: asset,
        poolOrHookAddress: openingAuctionHook,
      });

    const mineCompletionSpy = vi
      .spyOn(factory as any, 'mineDopplerCompletionSalt')
      .mockResolvedValue({
        dopplerSalt: minedCompletionSalt,
        dopplerHookAddress: minedDopplerHook,
      });

    vi.mocked(publicClient.readContract).mockImplementation(async (call: any) => {
      switch (call?.functionName) {
        case 'getState':
          return {
            numeraire: mockAddresses.weth,
            auctionStartTime: 1n,
            auctionEndTime: 2n,
            auctionTokens: 3n,
            dopplerTokens: 4n,
            status: 1,
            openingAuctionHook,
            dopplerHook: zeroAddress,
            openingAuctionPoolKey: {
              currency0: asset,
              currency1: mockAddresses.weth,
              fee: 3000,
              tickSpacing: 60,
              hooks: openingAuctionHook,
            },
            dopplerInitData: '0x',
            isToken0: true,
          };
        case 'phase':
          // Force autoSettle path in completeOpeningAuction().
          return 2;
        case 'getDopplerHook':
          // Force SDK to fall back to mined hook address.
          return zeroAddress;
        default:
          throw new Error(`Unexpected readContract: ${call?.functionName}`);
      }
    });

    vi.mocked(publicClient.simulateContract).mockImplementation(
      async (call: any) => {
        switch (call?.functionName) {
          case 'create':
            return {
              request: call,
              result: [asset, openingAuctionHook],
            } as any;
          case 'settleAuction':
          case 'completeAuction':
          case 'recoverOpeningAuctionIncentives':
          case 'sweepOpeningAuctionIncentives':
            return { request: call } as any;
          default:
            throw new Error(`Unexpected simulateContract: ${call?.functionName}`);
        }
      },
    );

    // Provide a deterministic gas estimate only for the top-level simulation.
    vi.mocked(publicClient.estimateContractGas).mockResolvedValueOnce(123n);

    vi.mocked(walletClient.writeContract)
      .mockResolvedValueOnce(createTx)
      .mockResolvedValueOnce(settleTx)
      .mockResolvedValueOnce(completeTx);

    vi.mocked(publicClient.waitForTransactionReceipt)
      .mockResolvedValueOnce({} as any) // create()
      .mockResolvedValueOnce({} as any) // settleAuction()
      .mockResolvedValueOnce({ status: 'success' } as any); // completeAuction()

    const simulation = await factory.simulateCreateOpeningAuction(params);

    expect(simulation.tokenAddress).toBe(asset);
    expect(simulation.openingAuctionHookAddress).toBe(openingAuctionHook);
    expect(simulation.minedSalt).toBe(minedSalt);
    expect(simulation.gasEstimate).toBe(123n);
    expect(typeof simulation.execute).toBe('function');

    const createResult = await simulation.execute();

    expect(encodeSpy).toHaveBeenCalledTimes(1);
    expect(extractSpy).toHaveBeenCalledTimes(1);
    expect(createResult).toEqual({
      tokenAddress: asset,
      openingAuctionHookAddress: openingAuctionHook,
      transactionHash: createTx,
      createParams,
      minedSalt,
    });

    const completeResult = await factory.completeOpeningAuction({
      asset,
      initializerAddress: INITIALIZER_OVERRIDE,
    });

    expect(mineCompletionSpy).toHaveBeenCalledTimes(1);
    expect(completeResult).toEqual({
      asset,
      dopplerHookAddress: minedDopplerHook,
      transactionHash: completeTx,
      dopplerSalt: minedCompletionSalt,
    });

    const recoverSim = await factory.simulateRecoverOpeningAuctionIncentives({
      asset,
      initializerAddress: INITIALIZER_OVERRIDE,
    });
    const sweepSim = await factory.simulateSweepOpeningAuctionIncentives({
      asset,
      initializerAddress: INITIALIZER_OVERRIDE,
    });

    expect(recoverSim.request).toEqual(
      expect.objectContaining({
        address: INITIALIZER_OVERRIDE,
        functionName: 'recoverOpeningAuctionIncentives',
        args: [asset],
      }),
    );
    expect(sweepSim.request).toEqual(
      expect.objectContaining({
        address: INITIALIZER_OVERRIDE,
        functionName: 'sweepOpeningAuctionIncentives',
        args: [asset],
      }),
    );

    const simulateNames = vi
      .mocked(publicClient.simulateContract)
      .mock.calls.map(([call]) => call?.functionName);

    expect(simulateNames).toEqual([
      'create',
      'create',
      'settleAuction',
      'completeAuction',
      'recoverOpeningAuctionIncentives',
      'sweepOpeningAuctionIncentives',
    ]);

    expect(walletClient.writeContract).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ functionName: 'create' }),
    );
    expect(walletClient.writeContract).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ functionName: 'settleAuction' }),
    );
    expect(walletClient.writeContract).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ functionName: 'completeAuction' }),
    );

    expect(publicClient.waitForTransactionReceipt).toHaveBeenNthCalledWith(1, {
      hash: createTx,
    });
    expect(publicClient.waitForTransactionReceipt).toHaveBeenNthCalledWith(2, {
      hash: settleTx,
    });
    expect(publicClient.waitForTransactionReceipt).toHaveBeenNthCalledWith(3, {
      hash: completeTx,
    });
  });
});

