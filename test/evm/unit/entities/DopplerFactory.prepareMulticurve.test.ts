import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  decodeFunctionData,
  encodeAbiParameters,
  ExecutionRevertedError,
  keccak256,
  parseEther,
  type Address,
} from 'viem';
import { airlockAbi } from '../../../../src/evm/abis';
import { DEFAULT_CREATE_GAS_LIMIT, DYNAMIC_FEE_FLAG } from '../../../../src/evm/constants';
import { DopplerFactory } from '../../../../src/evm/entities/DopplerFactory';
import type { CreateMulticurveParams } from '../../../../src/evm/types';
import type * as AddressesModule from '../../../../src/evm/addresses';
import {
  createMockPublicClient,
  createMockTransactionReceiptWithCreateEvent,
  createMockWalletClient,
  type MockedPublicClient,
} from '../../setup/fixtures/clients';
import {
  mockAddresses,
  mockGovernanceAddress,
  mockPoolAddress,
  mockTimelockAddress,
  mockTokenAddress,
  mockV2PoolAddress,
} from '../../setup/fixtures/addresses';

vi.mock('../../../../src/evm/addresses', async (importOriginal) => {
  const actual = await importOriginal<typeof AddressesModule>();
  return {
    ...actual,
    getAddresses: vi.fn(() => mockAddresses),
  };
});

const account = '0x1234567890123456789012345678901234567890' as Address;
const explicitSalt = `0x${'11'.repeat(32)}` as const;

function multicurveParams(): CreateMulticurveParams {
  return {
    token: {
      type: 'standard',
      name: 'Prepared Token',
      symbol: 'PREP',
      tokenURI: 'https://example.com/prepared-token',
    },
    sale: {
      initialSupply: parseEther('1000000'),
      numTokensToSell: parseEther('400000'),
      numeraire: mockAddresses.weth,
    },
    pool: {
      fee: 3000,
      tickSpacing: 60,
      curves: [
        {
          tickLower: -120000,
          tickUpper: -60000,
          numPositions: 8,
          shares: parseEther('1'),
        },
      ],
    },
    initializer: { type: 'standard' },
    governance: { type: 'default' },
    migration: { type: 'uniswapV2' },
    userAddress: account,
    salt: explicitSalt,
  };
}

function recordedAccount(call: unknown): unknown {
  if (!call || typeof call !== 'object' || !('account' in call)) return undefined;
  return call.account;
}

describe('DopplerFactory.prepareCreateMulticurve', () => {
  let publicClient: MockedPublicClient;
  let client: MockedPublicClient;

  beforeEach(() => {
    publicClient = createMockPublicClient();
    client = publicClient;
    vi.mocked(client.readContract).mockResolvedValue(mockPoolAddress);
    vi.mocked(client.estimateContractGas).mockResolvedValue(500_000n);
  });

  it('prepares with only a public client and never reads a wallet account', async () => {
    const factory = new DopplerFactory(publicClient, undefined, 1);

    const prepared = await factory.prepareCreateMulticurve(multicurveParams(), {
      account,
    });

    expect(prepared.account).toBe(account);
    expect(recordedAccount(vi.mocked(client.simulateContract).mock.calls[0][0])).toBe(
      account,
    );
  });

  it('returns calldata for the exact final params and complete transaction metadata', async () => {
    const override = '0x9999999999999999999999999999999999999999' as Address;
    const params = multicurveParams();
    params.modules = { airlock: override };
    const factory = new DopplerFactory(publicClient, undefined, 1);

    const prepared = await factory.prepareCreateMulticurve(params, { account });
    const decoded = decodeFunctionData({
      abi: airlockAbi,
      data: prepared.transaction.data,
    });

    expect(decoded.functionName).toBe('create');
    expect(decoded.args?.[0]).toEqual(prepared.createParams);
    expect(prepared).toMatchObject({
      chainId: 1,
      account,
      airlock: override,
      transaction: { to: override, value: 0n },
    });
  });

  it('selects a generated salt once and reuses it through enrichment', async () => {
    const params = multicurveParams();
    params.salt = undefined;
    params.token = {
      name: 'Limited Token',
      symbol: 'LIMIT',
      tokenURI: 'https://example.com/limited-token',
      maxBalanceLimit: parseEther('10000'),
      balanceLimitEnd: 2_000_000_000,
    };
    const firstPassResult = [
      '0x1000000000000000000000000000000000000001',
      '0x1000000000000000000000000000000000000002',
      '0x1000000000000000000000000000000000000003',
      '0x1000000000000000000000000000000000000004',
      '0x1000000000000000000000000000000000000005',
    ] as const satisfies readonly Address[];
    vi.mocked(client.simulateContract).mockImplementationOnce(async (call) => ({
      request: call,
      result: firstPassResult,
    }));
    const entropy = vi
      .spyOn(globalThis.crypto, 'getRandomValues')
      .mockImplementation((array) => {
        (array as Uint8Array).fill(7);
        return array;
      });
    const factory = new DopplerFactory(publicClient, undefined, 1);

    try {
      const prepared = await factory.prepareCreateMulticurve(params, { account });
      const calls = vi.mocked(client.simulateContract).mock.calls;
      const firstParams = calls[0][0].args?.[0];
      const finalParams = calls[1][0].args?.[0];

      expect(entropy).toHaveBeenCalledOnce();
      expect(calls).toHaveLength(2);
      expect(firstParams?.salt).toBe(prepared.createParams.salt);
      expect(finalParams?.salt).toBe(prepared.createParams.salt);
      expect(finalParams?.tokenFactoryData).toBe(
        prepared.createParams.tokenFactoryData,
      );
      expect(firstParams?.tokenFactoryData).not.toBe(
        prepared.createParams.tokenFactoryData,
      );
      expect(prepared.prediction).toMatchObject({
        tokenAddress: mockTokenAddress,
        poolOrHookAddress: mockPoolAddress,
        governanceAddress: mockGovernanceAddress,
        timelockAddress: mockTimelockAddress,
        migrationPoolAddress: mockV2PoolAddress,
      });
      expect(prepared.prediction.tokenAddress).not.toBe(firstPassResult[0]);
    } finally {
      entropy.mockRestore();
    }
  });

  it('maps every final Airlock output and derives the complete pool identity', async () => {
    const factory = new DopplerFactory(publicClient, undefined, 1);
    const prepared = await factory.prepareCreateMulticurve(multicurveParams(), {
      account,
    });
    const expectedPoolKey = {
      currency0:
        BigInt(mockTokenAddress) < BigInt(mockAddresses.weth)
          ? mockTokenAddress
          : mockAddresses.weth,
      currency1:
        BigInt(mockTokenAddress) < BigInt(mockAddresses.weth)
          ? mockAddresses.weth
          : mockTokenAddress,
      fee: 3000,
      tickSpacing: 60,
      hooks: mockPoolAddress,
    };

    expect(prepared.prediction).toEqual({
      tokenAddress: mockTokenAddress,
      poolOrHookAddress: mockPoolAddress,
      governanceAddress: mockGovernanceAddress,
      timelockAddress: mockTimelockAddress,
      migrationPoolAddress: mockV2PoolAddress,
      poolKey: expectedPoolKey,
      poolId: keccak256(
        encodeAbiParameters(
          [
            { type: 'address' },
            { type: 'address' },
            { type: 'uint24' },
            { type: 'int24' },
            { type: 'address' },
          ],
          [
            expectedPoolKey.currency0,
            expectedPoolKey.currency1,
            expectedPoolKey.fee,
            expectedPoolKey.tickSpacing,
            expectedPoolKey.hooks,
          ],
        ),
      ),
      tokenIsCurrency0:
        BigInt(mockTokenAddress) < BigInt(mockAddresses.weth),
    });
  });

  it.each([
    ['standard', { type: 'standard' } as const, 3000],
    ['scheduled', { type: 'scheduled', startTime: 2_000_000_000 } as const, 3000],
    [
      'decay',
      {
        type: 'decay',
        startTime: 2_000_000_000,
        startFee: 10_000,
        durationSeconds: 3600,
      } as const,
      DYNAMIC_FEE_FLAG,
    ],
  ])('derives %s pool key hook and fee mode', async (_name, initializer, fee) => {
    const params = multicurveParams();
    params.initializer = initializer;
    const factory = new DopplerFactory(publicClient, undefined, 1);

    const prepared = await factory.prepareCreateMulticurve(params, { account });

    expect(prepared.prediction.poolKey).toMatchObject({
      fee,
      hooks: mockPoolAddress,
    });
  });

  it('uses the DopplerHookInitializer and dynamic fee for Rehype identity', async () => {
    const params = multicurveParams();
    params.initializer = {
      type: 'rehype',
      config: {
        hookAddress: mockPoolAddress,
        buybackDestination: account,
        startFee: 3000,
        endFee: 3000,
        durationSeconds: 0,
        feeRoutingMode: 0,
        feeDistributionInfo: {
          assetFeesToAssetBuybackWad: parseEther('0.25'),
          assetFeesToNumeraireBuybackWad: parseEther('0.25'),
          assetFeesToBeneficiaryWad: parseEther('0.25'),
          assetFeesToLpWad: parseEther('0.25'),
          numeraireFeesToAssetBuybackWad: parseEther('0.25'),
          numeraireFeesToNumeraireBuybackWad: parseEther('0.25'),
          numeraireFeesToBeneficiaryWad: parseEther('0.25'),
          numeraireFeesToLpWad: parseEther('0.25'),
        },
      },
    };
    const factory = new DopplerFactory(publicClient, undefined, 1);

    const prepared = await factory.prepareCreateMulticurve(params, { account });

    expect(prepared.prediction.poolKey).toMatchObject({
      fee: DYNAMIC_FEE_FLAG,
      hooks: mockAddresses.dopplerHookInitializer,
    });
    expect(prepared.prediction.poolKey.hooks).not.toBe(mockPoolAddress);
  });

  it('uses simulation request gas without fallback estimation', async () => {
    vi.mocked(client.simulateContract).mockImplementationOnce(async (call) => ({
      request: { ...call, gas: 700_000n },
      result: [
        mockTokenAddress,
        mockPoolAddress,
        mockGovernanceAddress,
        mockTimelockAddress,
        mockV2PoolAddress,
      ],
    }));
    const factory = new DopplerFactory(publicClient, undefined, 1);

    const prepared = await factory.prepareCreateMulticurve(multicurveParams(), {
      account,
    });

    expect(prepared.gasEstimate).toEqual({ status: 'estimated', gas: 700_000n });
    expect(client.estimateContractGas).not.toHaveBeenCalled();
  });

  it('reports successful fallback estimation and unavailable transport failures', async () => {
    const factory = new DopplerFactory(publicClient, undefined, 1);
    const estimated = await factory.prepareCreateMulticurve(multicurveParams(), {
      account,
    });
    expect(estimated.gasEstimate).toEqual({ status: 'estimated', gas: 500_000n });

    vi.mocked(client.estimateContractGas).mockRejectedValueOnce(
      new Error('provider unavailable'),
    );
    const unavailable = await factory.prepareCreateMulticurve(
      multicurveParams(),
      { account },
    );
    expect(unavailable.gasEstimate).toEqual({ status: 'unavailable' });
    expect(
      vi
        .mocked(client.estimateContractGas)
        .mock.calls.map(([call]) => recordedAccount(call)),
    ).toEqual([account, account]);
  });

  it('throws the original revert-shaped estimation failure', async () => {
    const revert = new ExecutionRevertedError({ message: 'execution reverted' });
    vi.mocked(client.estimateContractGas).mockRejectedValueOnce(revert);
    const factory = new DopplerFactory(publicClient, undefined, 1);

    await expect(
      factory.prepareCreateMulticurve(multicurveParams(), { account }),
    ).rejects.toBe(revert);
  });

  it.each([
    [
      'revert-shaped',
      new ExecutionRevertedError({ message: 'execution reverted' }),
    ],
    ['transport/provider', new Error('provider unavailable')],
  ])(
    'preserves legacy %s estimation failures as an absent estimate',
    async (_label, error) => {
      vi.mocked(client.estimateContractGas).mockRejectedValue(error);
      const factory = new DopplerFactory(publicClient, undefined, 1);

      const simulated = await factory.simulateCreateMulticurve(multicurveParams());

      expect(simulated.gasEstimate).toBeUndefined();
    },
  );

  it('preserves simulation and estimation sender selection', async () => {
    const wallet = createMockWalletClient();
    const walletFactory = new DopplerFactory(publicClient, wallet, 1);
    await walletFactory.simulateCreateMulticurve(multicurveParams());
    expect(recordedAccount(vi.mocked(client.simulateContract).mock.calls[0][0])).toBe(
      wallet.account,
    );
    expect(recordedAccount(vi.mocked(client.estimateContractGas).mock.calls[0][0])).toBe(
      wallet.account,
    );

    vi.clearAllMocks();
    vi.mocked(client.readContract).mockResolvedValue(mockPoolAddress);
    vi.mocked(client.estimateContractGas).mockResolvedValue(500_000n);
    const publicFactory = new DopplerFactory(publicClient, undefined, 1);
    await publicFactory.simulateCreateMulticurve(multicurveParams());
    expect(recordedAccount(vi.mocked(client.simulateContract).mock.calls[0][0])).toBeUndefined();
    expect(recordedAccount(vi.mocked(client.estimateContractGas).mock.calls[0][0])).toBe(
      account,
    );
  });

  it('preserves explicit gas and the 13.5M legacy fallback', async () => {
    const wallet = createMockWalletClient();
    const receipt = createMockTransactionReceiptWithCreateEvent(
      mockTokenAddress,
      mockPoolAddress,
      mockAddresses.weth,
    );
    vi.mocked(client.waitForTransactionReceipt).mockResolvedValue(receipt);
    vi.mocked(wallet.writeContract).mockResolvedValue(receipt.transactionHash);
    vi.mocked(client.estimateContractGas).mockRejectedValue(
      new Error('provider unavailable'),
    );
    const factory = new DopplerFactory(publicClient, wallet, 1);

    const explicitParams = multicurveParams();
    explicitParams.gas = 900_000n;
    await factory.createMulticurve(explicitParams);
    expect(vi.mocked(wallet.writeContract).mock.calls[0][0].gas).toBe(900_000n);
    expect(
      recordedAccount(vi.mocked(client.simulateContract).mock.calls[0][0]),
    ).toBe(wallet.account);
    expect(
      recordedAccount(vi.mocked(client.estimateContractGas).mock.calls[0][0]),
    ).toBe(wallet.account);

    await factory.createMulticurve(multicurveParams());
    expect(vi.mocked(wallet.writeContract).mock.calls[1][0].gas).toBe(
      DEFAULT_CREATE_GAS_LIMIT,
    );
  });
});
