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
const MOCK_POOL_MANAGER = '0x9100000000000000000000000000000000000002' as Address;
const MOCK_AUCTION_DEPLOYER =
  '0x9100000000000000000000000000000000000003' as Address;

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
});

describe('DopplerFactory opening auction methods', () => {
  let factory: DopplerFactory;
  let publicClient: ReturnType<typeof createMockPublicClient>;
  let walletClient: ReturnType<typeof createMockWalletClient>;

  beforeEach(() => {
    publicClient = createMockPublicClient();
    walletClient = createMockWalletClient();
    factory = new DopplerFactory(publicClient, walletClient, 1);
  });

  it('encodeCreateOpeningAuctionParams fails when initializer is not configured', async () => {
    await expect(
      factory.encodeCreateOpeningAuctionParams(buildOpeningAuctionParams()),
    ).rejects.toThrow('OpeningAuctionInitializer address not configured');

    expect(publicClient.readContract).not.toHaveBeenCalled();
  });

  it('encodeCreateOpeningAuctionParams succeeds with module override and mocked mining', async () => {
    const params: CreateOpeningAuctionParams = {
      ...buildOpeningAuctionParams(),
      modules: {
        openingAuctionInitializer: INITIALIZER_OVERRIDE,
      },
    };

    const minedSalt =
      '0x00000000000000000000000000000000000000000000000000000000000000aa' as Hash;
    const minedHook = '0x9200000000000000000000000000000000000001' as Address;
    const minedToken = '0x0100000000000000000000000000000000000001' as Address;
    const encodedTokenFactoryData = '0xdeadbeef' as const;

    vi.mocked(publicClient.readContract)
      .mockResolvedValueOnce(MOCK_POOL_MANAGER)
      .mockResolvedValueOnce(MOCK_AUCTION_DEPLOYER);

    const mineSpy = vi
      .spyOn(factory as any, 'mineOpeningAuctionHookAddress')
      .mockReturnValue([
        minedSalt,
        minedHook,
        minedToken,
        encodedTokenFactoryData,
      ]);

    const result = await factory.encodeCreateOpeningAuctionParams(params);

    expect(publicClient.readContract).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        address: INITIALIZER_OVERRIDE,
        functionName: 'poolManager',
      }),
    );
    expect(publicClient.readContract).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        address: INITIALIZER_OVERRIDE,
        functionName: 'auctionDeployer',
      }),
    );

    expect(mineSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        auctionDeployer: MOCK_AUCTION_DEPLOYER,
        openingAuctionInitializer: INITIALIZER_OVERRIDE,
        poolManager: MOCK_POOL_MANAGER,
        auctionTokens: parseEther('100000'),
      }),
    );

    expect(result.hookAddress).toBe(minedHook);
    expect(result.tokenAddress).toBe(minedToken);
    expect(result.minedSalt).toBe(minedSalt);
    expect(result.createParams.poolInitializer).toBe(INITIALIZER_OVERRIDE);
    expect(result.createParams.salt).toBe(minedSalt);
    expect(result.createParams.tokenFactoryData).toBe(encodedTokenFactoryData);
  });

  it('simulateCreateOpeningAuction returns hook/token/salt and executable callback', async () => {
    const params: CreateOpeningAuctionParams = {
      ...buildOpeningAuctionParams(),
      modules: {
        openingAuctionInitializer: INITIALIZER_OVERRIDE,
      },
    };

    const minedSalt =
      '0x00000000000000000000000000000000000000000000000000000000000000bb' as Hash;
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

    vi.spyOn(factory, 'encodeCreateOpeningAuctionParams').mockResolvedValue({
      createParams,
      hookAddress: '0x9200000000000000000000000000000000000002' as Address,
      tokenAddress: '0x0100000000000000000000000000000000000002' as Address,
      minedSalt,
    });

    vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
      request: {
        address: mockAddresses.airlock,
        functionName: 'create',
        args: [{ ...createParams }],
      },
      result: [
        '0x01000000000000000000000000000000000000aa',
        '0x92000000000000000000000000000000000000aa',
      ],
    } as any);
    vi.mocked(publicClient.estimateContractGas).mockResolvedValueOnce(456n);

    const createSpy = vi.spyOn(factory, 'createOpeningAuction').mockResolvedValue({
      tokenAddress: '0x01000000000000000000000000000000000000aa',
      openingAuctionHookAddress: '0x92000000000000000000000000000000000000aa',
      transactionHash:
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      createParams,
      minedSalt,
    });

    const simulation = await factory.simulateCreateOpeningAuction(params);

    expect(simulation.tokenAddress).toBe(
      '0x01000000000000000000000000000000000000aa',
    );
    expect(simulation.openingAuctionHookAddress).toBe(
      '0x92000000000000000000000000000000000000aa',
    );
    expect(simulation.minedSalt).toBe(minedSalt);
    expect(simulation.gasEstimate).toBe(456n);
    expect(typeof simulation.execute).toBe('function');

    await simulation.execute();

    expect(createSpy).toHaveBeenCalledWith(params, {
      _createParams: createParams,
      _minedSalt: minedSalt,
    });
  });

  it('completeOpeningAuction auto-settles when phase is not settled and explicit dopplerSalt is provided', async () => {
    const asset = '0x01000000000000000000000000000000000000ff' as Address;
    const openingAuctionHook =
      '0x92000000000000000000000000000000000000ff' as Address;
    const finalDopplerHook = '0x93000000000000000000000000000000000000ff' as Address;
    const explicitDopplerSalt =
      '0x00000000000000000000000000000000000000000000000000000000000000cc' as Hash;
    const settleTx =
      '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as Hash;
    const completeTx =
      '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc' as Hash;

    const state = {
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
    vi.mocked(publicClient.readContract).mockImplementation(async (call: any) => {
      switch (call?.functionName) {
        case 'getState':
          return state;
        case 'phase':
          // Intentionally not settled so autoSettle triggers settleAuction().
          return 2;
        case 'getDopplerHook':
          return finalDopplerHook;
        default:
          throw new Error(`Unexpected readContract: ${call?.functionName}`);
      }
    });

    vi.mocked(publicClient.simulateContract)
      .mockResolvedValueOnce({
        request: {
          address: openingAuctionHook,
          functionName: 'settleAuction',
          account: walletClient.account,
        },
      } as any)
      .mockResolvedValueOnce({
        request: {
          address: INITIALIZER_OVERRIDE,
          functionName: 'completeAuction',
          args: [asset, explicitDopplerSalt],
          account: walletClient.account,
        },
      } as any);

    vi.mocked(walletClient.writeContract)
      .mockResolvedValueOnce(settleTx)
      .mockResolvedValueOnce(completeTx);
    vi.mocked(publicClient.waitForTransactionReceipt)
      .mockResolvedValueOnce({} as any)
      .mockResolvedValueOnce({} as any);

    const mineCompletionSpy = vi.spyOn(factory as any, 'mineDopplerCompletionSalt');

    const result = await factory.completeOpeningAuction({
      asset,
      initializerAddress: INITIALIZER_OVERRIDE,
      dopplerSalt: explicitDopplerSalt,
    });

    expect(mineCompletionSpy).not.toHaveBeenCalled();
    expect(publicClient.simulateContract).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        address: openingAuctionHook,
        functionName: 'settleAuction',
      }),
    );
    expect(publicClient.simulateContract).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        address: INITIALIZER_OVERRIDE,
        functionName: 'completeAuction',
        args: [asset, explicitDopplerSalt],
      }),
    );

    expect(result).toEqual({
      asset,
      dopplerHookAddress: finalDopplerHook,
      transactionHash: completeTx,
      dopplerSalt: explicitDopplerSalt,
    });
  });

  it('simulateCompleteOpeningAuction auto-mined path re-mines per attempt and succeeds after at least one failure', async () => {
    const asset = '0x01000000000000000000000000000000000000ee' as Address;
    const openingAuctionHook =
      '0x92000000000000000000000000000000000000ee' as Address;

    const minedSalt1 =
      '0x00000000000000000000000000000000000000000000000000000000000000d1' as Hash;
    const minedHook1 = '0x93000000000000000000000000000000000000d1' as Address;
    const minedSalt2 =
      '0x00000000000000000000000000000000000000000000000000000000000000d2' as Hash;
    const minedHook2 = '0x93000000000000000000000000000000000000d2' as Address;

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
          return 3;
        default:
          throw new Error(`Unexpected readContract: ${call?.functionName}`);
      }
    });

    const mineCompletionSpy = vi
      .spyOn(factory as any, 'mineDopplerCompletionSalt')
      .mockResolvedValueOnce({
        dopplerSalt: minedSalt1,
        dopplerHookAddress: minedHook1,
      })
      .mockResolvedValueOnce({
        dopplerSalt: minedSalt2,
        dopplerHookAddress: minedHook2,
      });

    vi.mocked(publicClient.simulateContract)
      .mockRejectedValueOnce(new Error('completeAuction simulation failed'))
      .mockResolvedValueOnce({
        request: {
          address: INITIALIZER_OVERRIDE,
          functionName: 'completeAuction',
          args: [asset, minedSalt2],
          account: walletClient.account,
        },
      } as any);

    const simulation = await factory.simulateCompleteOpeningAuction({
      asset,
      initializerAddress: INITIALIZER_OVERRIDE,
    });

    expect(mineCompletionSpy).toHaveBeenCalledTimes(2);
    expect(publicClient.simulateContract).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        address: INITIALIZER_OVERRIDE,
        functionName: 'completeAuction',
        args: [asset, minedSalt1],
      }),
    );
    expect(publicClient.simulateContract).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        address: INITIALIZER_OVERRIDE,
        functionName: 'completeAuction',
        args: [asset, minedSalt2],
      }),
    );

    expect(simulation.dopplerSalt).toBe(minedSalt2);
    expect(simulation.dopplerHookAddress).toBe(minedHook2);
  });

  it('completeOpeningAuction auto-mined path re-mines per attempt and succeeds after at least one failure', async () => {
    const asset = '0x01000000000000000000000000000000000000ef' as Address;
    const openingAuctionHook =
      '0x92000000000000000000000000000000000000ef' as Address;

    const minedSalt1 =
      '0x00000000000000000000000000000000000000000000000000000000000000e1' as Hash;
    const minedHook1 = '0x93000000000000000000000000000000000000e1' as Address;
    const minedSalt2 =
      '0x00000000000000000000000000000000000000000000000000000000000000e2' as Hash;
    const minedHook2 = '0x93000000000000000000000000000000000000e2' as Address;
    const completeTx =
      '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' as Hash;

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
          return 3;
        case 'getDopplerHook':
          return zeroAddress;
        default:
          throw new Error(`Unexpected readContract: ${call?.functionName}`);
      }
    });

    const mineCompletionSpy = vi
      .spyOn(factory as any, 'mineDopplerCompletionSalt')
      .mockResolvedValueOnce({
        dopplerSalt: minedSalt1,
        dopplerHookAddress: minedHook1,
      })
      .mockResolvedValueOnce({
        dopplerSalt: minedSalt2,
        dopplerHookAddress: minedHook2,
      });

    vi.mocked(publicClient.simulateContract)
      .mockRejectedValueOnce(new Error('completeAuction simulation failed'))
      .mockResolvedValueOnce({
        request: {
          address: INITIALIZER_OVERRIDE,
          functionName: 'completeAuction',
          args: [asset, minedSalt2],
          account: walletClient.account,
        },
      } as any);

    vi.mocked(walletClient.writeContract).mockResolvedValueOnce(completeTx);
    vi.mocked(publicClient.waitForTransactionReceipt).mockResolvedValueOnce(
      {} as any,
    );

    const result = await factory.completeOpeningAuction({
      asset,
      initializerAddress: INITIALIZER_OVERRIDE,
      autoSettle: false,
    });

    expect(mineCompletionSpy).toHaveBeenCalledTimes(2);
    expect(publicClient.simulateContract).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        address: INITIALIZER_OVERRIDE,
        functionName: 'completeAuction',
        args: [asset, minedSalt1],
      }),
    );
    expect(publicClient.simulateContract).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        address: INITIALIZER_OVERRIDE,
        functionName: 'completeAuction',
        args: [asset, minedSalt2],
      }),
    );
    expect(walletClient.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: INITIALIZER_OVERRIDE,
        functionName: 'completeAuction',
        args: [asset, minedSalt2],
      }),
    );

    expect(result).toEqual({
      asset,
      dopplerHookAddress: minedHook2,
      transactionHash: completeTx,
      dopplerSalt: minedSalt2,
    });
  });

  it('simulateCompleteOpeningAuction auto-mined path throws after bounded remine attempts are exhausted with attempt count', async () => {
    const asset = '0x01000000000000000000000000000000000000f0' as Address;
    const openingAuctionHook =
      '0x92000000000000000000000000000000000000f0' as Address;

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
          return 3;
        default:
          throw new Error(`Unexpected readContract: ${call?.functionName}`);
      }
    });

    const mineCompletionSpy = vi
      .spyOn(factory as any, 'mineDopplerCompletionSalt')
      .mockImplementation(async () => {
        const count = mineCompletionSpy.mock.calls.length + 1;
        return {
          dopplerSalt: `0x${count.toString(16).padStart(64, '0')}` as Hash,
          dopplerHookAddress:
            `0x${count.toString(16).padStart(40, '0')}` as Address,
        };
      });

    vi.mocked(publicClient.simulateContract).mockRejectedValue(
      new Error('completeAuction simulation failed'),
    );

    let thrown: unknown;
    try {
      await factory.simulateCompleteOpeningAuction({
        asset,
        initializerAddress: INITIALIZER_OVERRIDE,
      });
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(Error);
    const message = (thrown as Error).message;
    expect(message.toLowerCase()).toContain('attempt');
    expect(message).toMatch(/\d+/);

    const afterMatch = message.match(/after\s+(\d+)\s+attempt/i);
    const ratioMatch = message.match(/attempt\s+\d+\s*\/\s*(\d+)/i);
    const attemptCount = afterMatch
      ? Number(afterMatch[1])
      : ratioMatch
        ? Number(ratioMatch[1])
        : null;

    expect(attemptCount).not.toBeNull();
    expect(attemptCount).toBeGreaterThan(0);
    expect(mineCompletionSpy).toHaveBeenCalledTimes(attemptCount!);
    expect(publicClient.simulateContract).toHaveBeenCalledTimes(attemptCount!);
  });

  it('recover/sweep opening-auction incentive wrappers require a wallet client', async () => {
    const noWalletFactory = new DopplerFactory(publicClient, undefined, 1);
    const asset = '0x01000000000000000000000000000000000000dd' as Address;

    await expect(
      noWalletFactory.recoverOpeningAuctionIncentives({ asset }),
    ).rejects.toThrow('Wallet client required for write operations');
    await expect(
      noWalletFactory.sweepOpeningAuctionIncentives({ asset }),
    ).rejects.toThrow('Wallet client required for write operations');
  });
});
