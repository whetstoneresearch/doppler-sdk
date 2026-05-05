import { beforeEach, describe, expect, it } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import { decodeAbiParameters, parseEther, type Address } from 'viem';
import { DopplerFactory } from '../../../../src/evm/entities/DopplerFactory';
import { CHAIN_IDS, getAddresses } from '../../../../src/evm/addresses';
import type {
  CreateDynamicAuctionParams,
  CreateStaticAuctionParams,
  SupportedPublicClient,
} from '../../../../src/evm/types';
import { isToken0Expected } from '../../../../src/evm/utils';

describe('DopplerFactory split migrator support', () => {
  let factory: DopplerFactory;
  let publicClient: SupportedPublicClient;
  const account = privateKeyToAccount(
    '0x1234567890123456789012345678901234567890123456789012345678901234',
  );
  const proceedsRecipient =
    '0x1234567890123456789012345678901234567890' as Address;
  const altBeneficiary =
    '0x9999999999999999999999999999999999999999' as Address;

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

  it('encodes uniswapV4Split migration and sorts beneficiaries', async () => {
    const numeraire = '0x4200000000000000000000000000000000000006' as Address;
    const token0Expected = isToken0Expected(numeraire);

    const params: CreateDynamicAuctionParams = {
      token: {
        name: 'Split Dynamic Token',
        symbol: 'SDT',
        tokenURI: 'https://example.com/token.json',
      },
      sale: {
        initialSupply: parseEther('1000000'),
        numTokensToSell: parseEther('500000'),
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
      governance: { type: 'default' },
      migration: {
        type: 'uniswapV4Split',
        fee: 3000,
        tickSpacing: 8,
        streamableFees: {
          lockDuration: 30 * 24 * 60 * 60,
          beneficiaries: [
            { beneficiary: altBeneficiary, shares: parseEther('0.95') },
            { beneficiary: account.address, shares: parseEther('0.05') },
          ],
        },
        proceedsSplit: {
          recipient: proceedsRecipient,
          share: parseEther('0.1'),
        },
      },
      userAddress: account.address,
      startTimeOffset: 45,
      blockTimestamp: 1,
    };

    const { createParams } =
      await factory.encodeCreateDynamicAuctionParams(params);

    expect(createParams.liquidityMigrator).toBe(
      getAddresses(CHAIN_IDS.BASE_SEPOLIA).v4MigratorSplit,
    );

    const decoded = decodeAbiParameters(
      [
        { type: 'uint24' },
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
        { type: 'uint256' },
      ],
      createParams.liquidityMigratorData,
    ) as readonly [
      number,
      number,
      number,
      readonly { beneficiary: Address; shares: bigint }[],
      Address,
      bigint,
    ];

    expect(decoded[0]).toBe(3000);
    expect(decoded[1]).toBe(8);
    expect(decoded[2]).toBe(30 * 24 * 60 * 60);
    expect(decoded[3]).toEqual([
      { beneficiary: account.address, shares: parseEther('0.05') },
      { beneficiary: altBeneficiary, shares: parseEther('0.95') },
    ]);
    expect(decoded[4]).toBe(proceedsRecipient);
    expect(decoded[5]).toBe(parseEther('0.1'));
  });

  it('requires streamableFees for uniswapV4Split migrations', async () => {
    const params: CreateStaticAuctionParams = {
      token: {
        name: 'Invalid Split Token',
        symbol: 'BAD',
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
        type: 'uniswapV4Split',
        fee: 3000,
        tickSpacing: 8,
      },
      userAddress: account.address,
    } as CreateStaticAuctionParams;

    await expect(
      factory.encodeCreateStaticAuctionParams(params),
    ).rejects.toThrow(
      'V4 split migration requires streamableFees configuration',
    );
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
