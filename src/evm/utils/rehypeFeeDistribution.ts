import { WAD } from '../constants';
import type {
  RehypeDopplerHookInitializerConfig,
  RehypeFeeDistributionInfo,
} from '../types';

export function resolveRehypeFeeDistributionInfo(
  config: RehypeDopplerHookInitializerConfig,
): RehypeFeeDistributionInfo {
  const feeDistributionInfo =
    config.feeDistributionInfo ?? resolveLegacyFeeDistributionInfo(config);
  validateFeeDistributionInfo(feeDistributionInfo);
  return feeDistributionInfo;
}

function resolveLegacyFeeDistributionInfo(
  config: RehypeDopplerHookInitializerConfig,
): RehypeFeeDistributionInfo {
  const assetBuyback = config.assetBuybackPercentWad;
  const numeraireBuyback = config.numeraireBuybackPercentWad;
  const beneficiary = config.beneficiaryPercentWad;
  const lp = config.lpPercentWad;

  if (
    assetBuyback === undefined ||
    numeraireBuyback === undefined ||
    beneficiary === undefined ||
    lp === undefined
  ) {
    throw new Error(
      'Rehype feeDistributionInfo is required, or provide all deprecated legacy percentages.',
    );
  }

  return {
    assetFeesToAssetBuybackWad: assetBuyback,
    assetFeesToNumeraireBuybackWad: numeraireBuyback,
    assetFeesToBeneficiaryWad: beneficiary,
    assetFeesToLpWad: lp,
    numeraireFeesToAssetBuybackWad: assetBuyback,
    numeraireFeesToNumeraireBuybackWad: numeraireBuyback,
    numeraireFeesToBeneficiaryWad: beneficiary,
    numeraireFeesToLpWad: lp,
  };
}

function validateFeeDistributionInfo(
  feeDistributionInfo: RehypeFeeDistributionInfo,
): void {
  if (
    feeDistributionInfo.assetFeesToAssetBuybackWad < 0n ||
    feeDistributionInfo.assetFeesToNumeraireBuybackWad < 0n ||
    feeDistributionInfo.assetFeesToBeneficiaryWad < 0n ||
    feeDistributionInfo.assetFeesToLpWad < 0n
  ) {
    throw new Error(
      'Rehype asset fee distribution cannot contain negative components',
    );
  }

  const assetRowTotal =
    feeDistributionInfo.assetFeesToAssetBuybackWad +
    feeDistributionInfo.assetFeesToNumeraireBuybackWad +
    feeDistributionInfo.assetFeesToBeneficiaryWad +
    feeDistributionInfo.assetFeesToLpWad;
  if (assetRowTotal !== WAD) {
    throw new Error(
      `Rehype asset fee distribution must sum to ${WAD} (100%), but got ${assetRowTotal}`,
    );
  }

  if (
    feeDistributionInfo.numeraireFeesToAssetBuybackWad < 0n ||
    feeDistributionInfo.numeraireFeesToNumeraireBuybackWad < 0n ||
    feeDistributionInfo.numeraireFeesToBeneficiaryWad < 0n ||
    feeDistributionInfo.numeraireFeesToLpWad < 0n
  ) {
    throw new Error(
      'Rehype numeraire fee distribution cannot contain negative components',
    );
  }

  const numeraireRowTotal =
    feeDistributionInfo.numeraireFeesToAssetBuybackWad +
    feeDistributionInfo.numeraireFeesToNumeraireBuybackWad +
    feeDistributionInfo.numeraireFeesToBeneficiaryWad +
    feeDistributionInfo.numeraireFeesToLpWad;
  if (numeraireRowTotal !== WAD) {
    throw new Error(
      `Rehype numeraire fee distribution must sum to ${WAD} (100%), but got ${numeraireRowTotal}`,
    );
  }
}
