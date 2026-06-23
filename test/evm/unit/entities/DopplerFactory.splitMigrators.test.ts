import { beforeEach, describe, expect, it } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import { decodeAbiParameters, parseEther, type Address } from 'viem';
import { DopplerFactory } from '../../../../src/evm/entities/DopplerFactory';
import { CHAIN_IDS, getAddresses } from '../../../../src/evm/addresses';
import type {
  CreateStaticAuctionParams,
  SupportedPublicClient,
} from '../../../../src/evm/types';

describe('DopplerFactory split migrator support', () => {
  let factory: DopplerFactory;
  let publicClient: SupportedPublicClient;
  const account = privateKeyToAccount(
    '0x1234567890123456789012345678901234567890123456789012345678901234',
  );
  const proceedsRecipient =
    '0x1234567890123456789012345678901234567890' as Address;

  beforeEach(() => {
    publicClient = {
      simulateContract: async () => ({
        result: [
          '0xffffffffffffffffffffffffffffffffffffffff',
          '0x0000000000000000000000000000000000000001',
        ],
      }),
    } as unknown as SupportedPublicClient;

    factory = new DopplerFactory(
      publicClient,
      undefined,
      CHAIN_IDS.BASE_SEPOLIA,
    );
  });

  it('encodes uniswapV2Split migration for static auctions', async () => {
    const params: CreateStaticAuctionParams = {
      token: {
        name: 'Split Token',
        symbol: 'SPLIT',
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
      governance: { type: 'default' },
      migration: {
        type: 'uniswapV2Split',
        proceedsSplit: {
          recipient: proceedsRecipient,
          share: parseEther('0.1'),
        },
      },
      userAddress: account.address,
    };

    const result = await factory.encodeCreateStaticAuctionParams(params);

    expect(result.liquidityMigrator).toBe(
      getAddresses(CHAIN_IDS.BASE_SEPOLIA).v2MigratorSplit,
    );

    const decoded = decodeAbiParameters(
      [{ type: 'address' }, { type: 'uint256' }],
      result.liquidityMigratorData,
    ) as readonly [Address, bigint];

    expect(decoded[0]).toBe(proceedsRecipient);
    expect(decoded[1]).toBe(parseEther('0.1'));
  });

  it('rejects a zero-address no-op migrator override', async () => {
    const params: CreateStaticAuctionParams = {
      token: {
        name: 'NoOp Token',
        symbol: 'NOOP',
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
      governance: { type: 'default' },
      migration: { type: 'noOp' },
      userAddress: account.address,
      modules: {
        noOpMigrator: '0x0000000000000000000000000000000000000000',
      },
    };

    await expect(
      factory.encodeCreateStaticAuctionParams(params),
    ).rejects.toThrow('NoOpMigrator not configured on this chain');
  });

  it('rejects split proceeds shares above the contract maximum', async () => {
    const params: CreateStaticAuctionParams = {
      token: {
        name: 'Invalid Share Token',
        symbol: 'BADSHARE',
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
      governance: { type: 'default' },
      migration: {
        type: 'uniswapV2Split',
        proceedsSplit: {
          recipient: proceedsRecipient,
          share: parseEther('0.500000000000000001'),
        },
      },
      userAddress: account.address,
    };

    await expect(
      factory.encodeCreateStaticAuctionParams(params),
    ).rejects.toThrow(
      `V2 split migration proceeds split share cannot exceed ${parseEther('0.5')}`,
    );
  });
});
