import { describe, expect, it } from 'vitest';
import { getAddress } from 'viem';
import { WAD } from '@/constants';
import type {
  RehypeDopplerHookInitializerConfig,
  RehypeFeeDistributionInfo,
} from '@/types';
import { resolveRehypeFeeDistributionInfo } from '@/utils/rehypeFeeDistribution';

const hookAddress = getAddress('0x9999999999999999999999999999999999999999');
const buybackDestination = getAddress(
  '0x8888888888888888888888888888888888888888',
);

function configWithFeeDistribution(
  feeDistributionInfo: RehypeFeeDistributionInfo,
): RehypeDopplerHookInitializerConfig {
  return {
    hookAddress,
    buybackDestination,
    startFee: 3_000,
    endFee: 3_000,
    durationSeconds: 0,
    feeDistributionInfo,
  };
}

describe('resolveRehypeFeeDistributionInfo', () => {
  it('rejects a negative asset fee component when the row sums to WAD', () => {
    // Given
    const config = configWithFeeDistribution({
      assetFeesToAssetBuybackWad: -1n,
      assetFeesToNumeraireBuybackWad: WAD + 1n,
      assetFeesToBeneficiaryWad: 0n,
      assetFeesToLpWad: 0n,
      numeraireFeesToAssetBuybackWad: WAD,
      numeraireFeesToNumeraireBuybackWad: 0n,
      numeraireFeesToBeneficiaryWad: 0n,
      numeraireFeesToLpWad: 0n,
    });

    // When
    const resolve = () => resolveRehypeFeeDistributionInfo(config);

    // Then
    expect(resolve).toThrow(
      'Rehype asset fee distribution cannot contain negative components',
    );
  });

  it('rejects a negative numeraire fee component when the row sums to WAD', () => {
    // Given
    const config = configWithFeeDistribution({
      assetFeesToAssetBuybackWad: WAD,
      assetFeesToNumeraireBuybackWad: 0n,
      assetFeesToBeneficiaryWad: 0n,
      assetFeesToLpWad: 0n,
      numeraireFeesToAssetBuybackWad: -1n,
      numeraireFeesToNumeraireBuybackWad: WAD + 1n,
      numeraireFeesToBeneficiaryWad: 0n,
      numeraireFeesToLpWad: 0n,
    });

    // When
    const resolve = () => resolveRehypeFeeDistributionInfo(config);

    // Then
    expect(resolve).toThrow(
      'Rehype numeraire fee distribution cannot contain negative components',
    );
  });
});
