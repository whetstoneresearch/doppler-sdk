import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseEther } from 'viem';
import { RehypeDopplerHookMigrator } from '../../../../src/evm/entities/auction/RehypeDopplerHookMigrator';
import {
  createMockPublicClient,
  createMockWalletClient,
} from '../../setup/fixtures/clients';
import {
  mockHookAddress,
  mockTokenAddress,
} from '../../setup/fixtures/addresses';

describe('RehypeDopplerHookMigrator', () => {
  let rehypeHookMigrator: RehypeDopplerHookMigrator;
  let publicClient: ReturnType<typeof createMockPublicClient>;
  let walletClient: ReturnType<typeof createMockWalletClient>;

  beforeEach(() => {
    publicClient = createMockPublicClient();
    walletClient = createMockWalletClient();
    rehypeHookMigrator = new RehypeDopplerHookMigrator(
      publicClient,
      walletClient,
      mockHookAddress,
    );
  });

  it('collectFees decodes BalanceDelta and returns tx hash', async () => {
    const txHash =
      '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    const amount0 = 5n;
    const amount1 = -3n;
    const packedDelta =
      (BigInt.asIntN(128, amount0) << 128n) | BigInt.asUintN(128, amount1);

    vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
      request: {
        address: mockHookAddress,
        functionName: 'collectFees',
        args: [mockTokenAddress],
      },
      result: packedDelta,
    } as any);
    vi.mocked(walletClient.writeContract).mockResolvedValueOnce(
      txHash as `0x${string}`,
    );
    vi.mocked(publicClient.waitForTransactionReceipt).mockResolvedValueOnce(
      {} as any,
    );

    const result = await rehypeHookMigrator.collectFees(mockTokenAddress);
    expect(result.amount0).toBe(amount0);
    expect(result.amount1).toBe(amount1);
    expect(result.transactionHash).toBe(txHash);
  });

  it('setFeeDistribution sends the full fee matrix', async () => {
    const txHash =
      '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
    const poolId =
      '0x1111111111111111111111111111111111111111111111111111111111111111';
    const feeDistributionInfo = {
      assetFeesToAssetBuybackWad: parseEther('0.2'),
      assetFeesToNumeraireBuybackWad: parseEther('0.2'),
      assetFeesToBeneficiaryWad: parseEther('0.3'),
      assetFeesToLpWad: parseEther('0.3'),
      numeraireFeesToAssetBuybackWad: parseEther('0.25'),
      numeraireFeesToNumeraireBuybackWad: parseEther('0.15'),
      numeraireFeesToBeneficiaryWad: parseEther('0.35'),
      numeraireFeesToLpWad: parseEther('0.25'),
    };

    vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
      request: {
        address: mockHookAddress,
        functionName: 'setFeeDistribution',
        args: [
          poolId,
          feeDistributionInfo.assetFeesToAssetBuybackWad,
          feeDistributionInfo.assetFeesToNumeraireBuybackWad,
          feeDistributionInfo.assetFeesToBeneficiaryWad,
          feeDistributionInfo.assetFeesToLpWad,
          feeDistributionInfo.numeraireFeesToAssetBuybackWad,
          feeDistributionInfo.numeraireFeesToNumeraireBuybackWad,
          feeDistributionInfo.numeraireFeesToBeneficiaryWad,
          feeDistributionInfo.numeraireFeesToLpWad,
        ],
      },
    } as any);
    vi.mocked(walletClient.writeContract).mockResolvedValueOnce(
      txHash as `0x${string}`,
    );
    vi.mocked(publicClient.waitForTransactionReceipt).mockResolvedValueOnce(
      {} as any,
    );

    const result = await rehypeHookMigrator.setFeeDistribution(
      poolId as `0x${string}`,
      feeDistributionInfo,
    );
    expect(result).toBe(txHash);
  });

  it('getFeeDistributionInfo parses the full fee matrix', async () => {
    vi.mocked(publicClient.readContract).mockResolvedValueOnce({
      assetFeesToAssetBuybackWad: parseEther('0.2'),
      assetFeesToNumeraireBuybackWad: parseEther('0.2'),
      assetFeesToBeneficiaryWad: parseEther('0.3'),
      assetFeesToLpWad: parseEther('0.3'),
      numeraireFeesToAssetBuybackWad: parseEther('0.25'),
      numeraireFeesToNumeraireBuybackWad: parseEther('0.15'),
      numeraireFeesToBeneficiaryWad: parseEther('0.35'),
      numeraireFeesToLpWad: parseEther('0.25'),
    } as any);

    const result = await rehypeHookMigrator.getFeeDistributionInfo(
      '0x1111111111111111111111111111111111111111111111111111111111111111',
    );
    expect(result.assetFeesToBeneficiaryWad).toBe(parseEther('0.3'));
    expect(result.numeraireFeesToLpWad).toBe(parseEther('0.25'));
  });

  it('getPosition parses the full-range LP position', async () => {
    vi.mocked(publicClient.readContract).mockResolvedValueOnce({
      tickLower: -887220,
      tickUpper: 887220,
      liquidity: 123n,
      salt: '0x' + '22'.repeat(32),
    } as any);

    const result = await rehypeHookMigrator.getPosition(
      '0x1111111111111111111111111111111111111111111111111111111111111111',
    );
    expect(result).toEqual({
      tickLower: -887220,
      tickUpper: 887220,
      liquidity: 123n,
      salt: `0x${'22'.repeat(32)}`,
    });
  });
});
