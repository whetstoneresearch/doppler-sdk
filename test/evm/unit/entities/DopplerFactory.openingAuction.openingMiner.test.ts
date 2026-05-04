import { beforeEach, describe, expect, it } from 'vitest';
import {
  encodeAbiParameters,
  getAddress,
  parseEther,
  type Address,
} from 'viem';
import { DopplerFactory } from '../../../../src/evm/entities/DopplerFactory';
import {
  createMockPublicClient,
  createMockWalletClient,
} from '../../setup/fixtures/clients';
import { mockAddresses } from '../../setup/fixtures/addresses';
import { FLAG_MASK, OPENING_AUCTION_FLAGS } from '../../../../src/evm/constants';

describe('DopplerFactory opening auction miner', () => {
  let factory: DopplerFactory;

  beforeEach(() => {
    factory = new DopplerFactory(createMockPublicClient(), createMockWalletClient(), 1);
  });

  const OPENING_AUCTION_INITIALIZER = getAddress(
    '0x9100000000000000000000000000000000000001',
  ) as Address;
  const POOL_MANAGER = getAddress('0x9100000000000000000000000000000000000002');
  const AUCTION_DEPLOYER = getAddress('0x9100000000000000000000000000000000000003');

  const LOW_NUMERAIRE = getAddress('0x4200000000000000000000000000000000000006');
  const HIGH_NUMERAIRE = getAddress('0x8000000000000000000000000000000000000000');

  const OPENING_AUCTION_CONFIG = {
    auctionDuration: 3600,
    minAcceptableTickToken0: -1200,
    minAcceptableTickToken1: 1200,
    incentiveShareBps: 500,
    tickSpacing: 60,
    fee: 3000,
    minLiquidity: 1n,
    shareToAuctionBps: 2000,
  } as const;

  const STANDARD_TOKEN_FACTORY_DATA = {
    name: 'Opening Miner Token',
    symbol: 'OMT',
    initialSupply: parseEther('1000000'),
    airlock: mockAddresses.airlock,
    yearlyMintRate: 0n,
    vestingDuration: 30n * 24n * 60n * 60n,
    recipients: [getAddress('0x1111111111111111111111111111111111111111') as Address],
    amounts: [parseEther('1')],
    tokenURI: 'https://example.com/omt.json',
  } as const;

  const DOPPLER_ERC20_V1_TOKEN_FACTORY_DATA = {
    kind: 'dopplerERC20V1',
    name: 'Opening Miner Token',
    symbol: 'OMT',
    schedules: [{ cliff: 30n * 24n * 60n * 60n, duration: 180n * 24n * 60n * 60n }],
    beneficiaries: [getAddress('0x2222222222222222222222222222222222222222') as Address],
    scheduleIds: [0n],
    amounts: [parseEther('2')],
    tokenURI: 'https://example.com/omt.json',
    maxBalanceLimit: parseEther('1000'),
    balanceLimitEnd: 1_800_000_000,
    controller: getAddress('0x3333333333333333333333333333333333333333') as Address,
    excludedFromBalanceLimit: [getAddress('0x4444444444444444444444444444444444444444') as Address],
    implementation: mockAddresses.dopplerERC20V1Implementation!,
  } as const;

  const baseParams = {
    auctionDeployer: AUCTION_DEPLOYER as Address,
    openingAuctionInitializer: OPENING_AUCTION_INITIALIZER,
    poolManager: POOL_MANAGER as Address,
    auctionTokens: parseEther('100000'),
    openingAuctionConfig: OPENING_AUCTION_CONFIG,
    numeraire: LOW_NUMERAIRE as Address,
    tokenFactory: mockAddresses.tokenFactory,
    tokenFactoryData: STANDARD_TOKEN_FACTORY_DATA,
    airlock: mockAddresses.airlock,
    initialSupply: parseEther('1000000'),
    tokenVariant: 'standard' as const,
  };

  it('returns a hook address satisfying OPENING_AUCTION_FLAGS mask', () => {
    const [_salt, hookAddress] = (factory as any).mineOpeningAuctionHookAddress(
      baseParams,
    ) as readonly [string, Address, Address, `0x${string}`];

    expect(BigInt(hookAddress) & FLAG_MASK).toBe(OPENING_AUCTION_FLAGS);
  });

  it('mines token address > numeraire for small numeraires', () => {
    const [_salt, _hookAddress, tokenAddress] = (
      factory as any
    ).mineOpeningAuctionHookAddress({
      ...baseParams,
      numeraire: LOW_NUMERAIRE,
    }) as readonly [string, Address, Address, `0x${string}`];

    expect(BigInt(tokenAddress)).toBeGreaterThan(BigInt(LOW_NUMERAIRE));
  });

  it('mines token address < numeraire for large numeraires (>= 0x8...)', () => {
    const [_salt, _hookAddress, tokenAddress] = (
      factory as any
    ).mineOpeningAuctionHookAddress({
      ...baseParams,
      numeraire: HIGH_NUMERAIRE,
    }) as readonly [string, Address, Address, `0x${string}`];

    expect(BigInt(tokenAddress)).toBeLessThan(BigInt(HIGH_NUMERAIRE));
  });

  it('is deterministic for identical inputs', () => {
    const first = (factory as any).mineOpeningAuctionHookAddress({
      ...baseParams,
      numeraire: LOW_NUMERAIRE,
    }) as readonly [string, Address, Address, `0x${string}`];
    const second = (factory as any).mineOpeningAuctionHookAddress({
      ...baseParams,
      numeraire: LOW_NUMERAIRE,
    }) as readonly [string, Address, Address, `0x${string}`];

    expect(second).toEqual(first);
  });

  it('returns encodedTokenFactoryData matching encodeAbiParameters for standard variant', () => {
    const [_salt, _hookAddress, _tokenAddress, encodedTokenFactoryData] = (
      factory as any
    ).mineOpeningAuctionHookAddress({
      ...baseParams,
      tokenVariant: 'standard',
      tokenFactoryData: STANDARD_TOKEN_FACTORY_DATA,
    }) as readonly [string, Address, Address, `0x${string}`];

    const expected = encodeAbiParameters(
      [
        { type: 'string' },
        { type: 'string' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'address[]' },
        { type: 'uint256[]' },
        { type: 'string' },
      ],
      [
        STANDARD_TOKEN_FACTORY_DATA.name,
        STANDARD_TOKEN_FACTORY_DATA.symbol,
        STANDARD_TOKEN_FACTORY_DATA.yearlyMintRate,
        STANDARD_TOKEN_FACTORY_DATA.vestingDuration,
        STANDARD_TOKEN_FACTORY_DATA.recipients,
        STANDARD_TOKEN_FACTORY_DATA.amounts,
        STANDARD_TOKEN_FACTORY_DATA.tokenURI,
      ],
    );

    expect(encodedTokenFactoryData).toBe(expected);
  });

  it('returns encodedTokenFactoryData matching encodeAbiParameters for doppler404 variant', () => {
    const doppler404TokenFactoryData = {
      name: 'Opening Miner 404',
      symbol: 'OM404',
      baseURI: 'https://example.com/om404/',
      unit: 1337n,
    } as const;

    const [_salt, _hookAddress, _tokenAddress, encodedTokenFactoryData] = (
      factory as any
    ).mineOpeningAuctionHookAddress({
      ...baseParams,
      tokenVariant: 'doppler404',
      tokenFactoryData: doppler404TokenFactoryData,
    }) as readonly [string, Address, Address, `0x${string}`];

    const expected = encodeAbiParameters(
      [
        { type: 'string' },
        { type: 'string' },
        { type: 'string' },
        { type: 'uint256' },
      ],
      [
        doppler404TokenFactoryData.name,
        doppler404TokenFactoryData.symbol,
        doppler404TokenFactoryData.baseURI,
        doppler404TokenFactoryData.unit,
      ],
    );

    expect(encodedTokenFactoryData).toBe(expected);
  });

  it('returns encodedTokenFactoryData matching encodeAbiParameters for dopplerERC20V1 variant', () => {
    const mineOpeningAuctionHookAddress = (
      factory as unknown as {
        mineOpeningAuctionHookAddress(
          params: unknown,
        ): readonly [string, Address, Address, `0x${string}`];
      }
    ).mineOpeningAuctionHookAddress.bind(factory);

    const [_salt, hookAddress, _tokenAddress, encodedTokenFactoryData] =
      mineOpeningAuctionHookAddress({
        ...baseParams,
        tokenVariant: 'dopplerERC20V1',
        tokenFactory: mockAddresses.dopplerERC20V1Factory,
        tokenFactoryData: DOPPLER_ERC20_V1_TOKEN_FACTORY_DATA,
        includeProtocolBalanceLimitExclusions: true,
      });

    const expected = encodeAbiParameters(
      [
        { type: 'string' },
        { type: 'string' },
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
        { type: 'uint256' },
        { type: 'uint48' },
        { type: 'address' },
        { type: 'address[]' },
      ],
      [
        DOPPLER_ERC20_V1_TOKEN_FACTORY_DATA.name,
        DOPPLER_ERC20_V1_TOKEN_FACTORY_DATA.symbol,
        DOPPLER_ERC20_V1_TOKEN_FACTORY_DATA.schedules,
        DOPPLER_ERC20_V1_TOKEN_FACTORY_DATA.beneficiaries,
        DOPPLER_ERC20_V1_TOKEN_FACTORY_DATA.scheduleIds,
        DOPPLER_ERC20_V1_TOKEN_FACTORY_DATA.amounts,
        DOPPLER_ERC20_V1_TOKEN_FACTORY_DATA.tokenURI,
        DOPPLER_ERC20_V1_TOKEN_FACTORY_DATA.maxBalanceLimit,
        DOPPLER_ERC20_V1_TOKEN_FACTORY_DATA.balanceLimitEnd,
        DOPPLER_ERC20_V1_TOKEN_FACTORY_DATA.controller,
        [
          ...DOPPLER_ERC20_V1_TOKEN_FACTORY_DATA.excludedFromBalanceLimit,
          hookAddress,
        ],
      ],
    );

    expect(encodedTokenFactoryData).toBe(expected);
  });
});
