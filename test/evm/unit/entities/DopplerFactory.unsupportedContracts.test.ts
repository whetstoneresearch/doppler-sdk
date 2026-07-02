import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseEther, type Address } from 'viem';
import { DopplerFactory } from '../../../../src/evm/entities/DopplerFactory';
import { getAddresses } from '../../../../src/evm/addresses';
import { DAY_SECONDS, ZERO_ADDRESS } from '../../../../src/evm/constants';
import type {
  CreateDynamicAuctionParams,
  CreateStaticAuctionParams,
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

describe('DopplerFactory unsupported contract guards', () => {
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

  beforeEach(() => {
    vi.mocked(getAddresses).mockReturnValue(mockAddresses);
    factory = new DopplerFactory(
      createMockPublicClient(),
      createMockWalletClient(),
      1,
    );
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

  it('rejects V2 migration when the V2 migrator is not configured', async () => {
    vi.mocked(getAddresses).mockReturnValue({
      ...mockAddresses,
      v2Migrator: ZERO_ADDRESS,
    });

    await expect(
      factory.encodeCreateStaticAuctionParams(staticParams),
    ).rejects.toThrow('UniswapV2Migrator not deployed');
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
});
