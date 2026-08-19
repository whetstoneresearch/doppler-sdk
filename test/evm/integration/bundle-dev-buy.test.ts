import { beforeEach, describe, expect, it, vi } from 'vitest';
import { decodeFunctionData, parseEther, type Address } from 'viem';
import { bundlerAbi } from '../../../src/evm/abis';
import { DopplerFactory } from '../../../src/evm/entities/DopplerFactory';
import { MulticurveBuilder } from '../../../src/evm/builders/MulticurveBuilder';
import type { CreateMulticurveParams } from '../../../src/evm/types';
import type * as AddressesModule from '../../../src/evm/addresses';
import {
  createMockPublicClient,
  type MockedPublicClient,
} from '../setup/fixtures/clients';
import {
  mockAddresses,
  mockGovernanceAddress,
  mockTimelockAddress,
  mockTokenAddress,
} from '../setup/fixtures/addresses';

vi.mock('../../../src/evm/addresses', async (importOriginal) => {
  const actual = await importOriginal<typeof AddressesModule>();
  return { ...actual, getAddresses: vi.fn(() => mockAddresses) };
});

const account = '0x1234567890123456789012345678901234567890' as Address;

function params(numeraire: Address): CreateMulticurveParams {
  return MulticurveBuilder.forChain(1)
    .tokenConfig({
      type: 'standard',
      name: 'Dev Buy Token',
      symbol: 'DBUY',
      tokenURI: 'ipfs://dev-buy',
    })
    .saleConfig({
      initialSupply: parseEther('1000000'),
      numTokensToSell: parseEther('400000'),
      numeraire,
    })
    .withCurves({
      numerairePrice: 3000,
      fee: 3000,
      curves: [
        {
          marketCap: { start: 500_000, end: 1_500_000 },
          numPositions: 10,
          shares: parseEther('0.3'),
        },
        {
          marketCap: { start: 1_000_000, end: 5_000_000 },
          numPositions: 15,
          shares: parseEther('0.4'),
        },
        {
          marketCap: { start: 4_000_000, end: 50_000_000 },
          numPositions: 10,
          shares: parseEther('0.29'),
        },
        {
          marketCap: { start: 50_000_000, end: 'max' },
          numPositions: 10,
          shares: parseEther('0.01'),
        },
      ],
      beneficiaries: [{ beneficiary: account, shares: parseEther('1') }],
    })
    .withDopplerHookInitializer(mockAddresses.dopplerHookInitializer!)
    .withGovernance({ type: 'noOp' })
    .withMigration({ type: 'noOp' })
    .withUserAddress(account)
    .withSalt(`0x${'11'.repeat(32)}`)
    .withDevBuy({
      exactAmountIn: 25n,
      recipient: account,
    })
    .build();
}

describe('multicurve Bundler dev buy', () => {
  let publicClient: MockedPublicClient;

  beforeEach(() => {
    publicClient = createMockPublicClient();
    vi.mocked(publicClient.readContract).mockImplementation(async (call) => {
      if (call.functionName === 'allowance') return 0n;
      return 0n;
    });
    vi.mocked(publicClient.simulateContract).mockImplementation(
      async (call) => {
        if (call.functionName !== 'simulateBundle') {
          return { request: call, result: undefined };
        }
        const createParams = call.args?.[0];
        if (
          !createParams ||
          typeof createParams !== 'object' ||
          !('numeraire' in createParams)
        ) {
          throw new Error('Missing CreateParams');
        }
        const numeraire = createParams.numeraire as Address;
        const tokenIsCurrency0 = BigInt(mockTokenAddress) < BigInt(numeraire);
        return {
          request: call,
          result: [
            mockTokenAddress,
            {
              currency0: tokenIsCurrency0 ? mockTokenAddress : numeraire,
              currency1: tokenIsCurrency0 ? numeraire : mockTokenAddress,
              fee: 3000,
              tickSpacing: 60,
              hooks: mockAddresses.dopplerHookInitializer,
            },
            mockGovernanceAddress,
            mockTimelockAddress,
            100n,
          ],
        };
      },
    );
  });

  it('simulates and prepares exact-input ERC20 funding with exact approval', async () => {
    const factory = new DopplerFactory(publicClient, undefined, 1);
    const prepared = await factory.prepareCreateMulticurve(
      params(mockAddresses.weth),
      { account },
    );
    const decoded = decodeFunctionData({
      abi: bundlerAbi,
      data: prepared.transaction.data,
    });

    expect(decoded.functionName).toBe('bundle');
    expect(decoded.args?.[2]).toBe(25n);
    expect(decoded.args?.[3]).toBe(account);
    expect(prepared.transaction.value).toBe(0n);
    expect(prepared.approvalTransaction).toBeDefined();
    expect(prepared.devBuy?.simulatedAmountOut).toBe(100n);
  });

  it('uses exact native value and no approval', async () => {
    const factory = new DopplerFactory(publicClient, undefined, 1);
    const prepared = await factory.prepareCreateMulticurve(
      params('0x0000000000000000000000000000000000000000'),
      { account },
    );

    expect(prepared.transaction.to).toBe(mockAddresses.bundler);
    expect(prepared.transaction.value).toBe(25n);
    expect(prepared.approvalTransaction).toBeUndefined();
    expect(prepared.prediction.poolKey).toMatchObject({
      currency0: '0x0000000000000000000000000000000000000000',
      currency1: mockTokenAddress,
    });
    expect(prepared.prediction.tokenIsCurrency0).toBe(false);
  });
});
