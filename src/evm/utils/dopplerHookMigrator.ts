import { encodeAbiParameters, type Address, type Hex } from 'viem';
import {
  RehypeFeeRoutingMode,
  type RehypeDopplerHookMigratorConfig,
  type RehypeFeeDistributionInfo,
} from '../types';
import { WAD } from '../constants';

type NormalizedRehypeDopplerHookMigratorConfig = {
  buybackDestination: Address;
  customFee: number;
  feeRoutingMode: RehypeFeeRoutingMode;
  feeDistributionInfo: RehypeFeeDistributionInfo;
};

function normalizeRehypeFeeRoutingMode(
  mode: RehypeDopplerHookMigratorConfig['feeRoutingMode'],
): RehypeFeeRoutingMode {
  if (mode === undefined || mode === RehypeFeeRoutingMode.DirectBuyback) {
    return RehypeFeeRoutingMode.DirectBuyback;
  }
  if (mode === RehypeFeeRoutingMode.RouteToBeneficiaryFees) {
    return RehypeFeeRoutingMode.RouteToBeneficiaryFees;
  }
  if (mode === 'directBuyback') {
    return RehypeFeeRoutingMode.DirectBuyback;
  }
  if (mode === 'routeToBeneficiaryFees') {
    return RehypeFeeRoutingMode.RouteToBeneficiaryFees;
  }
  throw new Error(
    'Rehype feeRoutingMode must be DirectBuyback/directBuyback or RouteToBeneficiaryFees/routeToBeneficiaryFees',
  );
}

function resolveRehypeFeeDistributionInfo(
  config: RehypeDopplerHookMigratorConfig,
): RehypeFeeDistributionInfo {
  if (config.feeDistributionInfo) {
    return config.feeDistributionInfo;
  }

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

function validateRehypeFeeDistributionInfo(
  feeDistributionInfo: RehypeFeeDistributionInfo,
): void {
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

export function normalizeRehypeDopplerHookMigratorConfig(
  config: RehypeDopplerHookMigratorConfig,
): NormalizedRehypeDopplerHookMigratorConfig {
  if (!Number.isInteger(config.customFee) || config.customFee < 0) {
    throw new Error('Rehype customFee must be a non-negative integer');
  }
  if (config.customFee > 1_000_000) {
    throw new Error('Rehype customFee must be <= 1000000 (100%)');
  }

  const feeDistributionInfo = resolveRehypeFeeDistributionInfo(config);
  validateRehypeFeeDistributionInfo(feeDistributionInfo);

  return {
    buybackDestination: config.buybackDestination,
    customFee: config.customFee,
    feeRoutingMode: normalizeRehypeFeeRoutingMode(config.feeRoutingMode),
    feeDistributionInfo,
  };
}

export function encodeRehypeDopplerHookMigratorCalldata(params: {
  numeraire: Address;
  config: RehypeDopplerHookMigratorConfig;
}): Hex {
  const normalized = normalizeRehypeDopplerHookMigratorConfig(params.config);

  return encodeAbiParameters(
    [
      {
        type: 'tuple',
        components: [
          { name: 'numeraire', type: 'address' },
          { name: 'buybackDst', type: 'address' },
          { name: 'customFee', type: 'uint24' },
          { name: 'feeRoutingMode', type: 'uint8' },
          {
            name: 'feeDistributionInfo',
            type: 'tuple',
            components: [
              { name: 'assetFeesToAssetBuybackWad', type: 'uint256' },
              { name: 'assetFeesToNumeraireBuybackWad', type: 'uint256' },
              { name: 'assetFeesToBeneficiaryWad', type: 'uint256' },
              { name: 'assetFeesToLpWad', type: 'uint256' },
              { name: 'numeraireFeesToAssetBuybackWad', type: 'uint256' },
              { name: 'numeraireFeesToNumeraireBuybackWad', type: 'uint256' },
              { name: 'numeraireFeesToBeneficiaryWad', type: 'uint256' },
              { name: 'numeraireFeesToLpWad', type: 'uint256' },
            ],
          },
        ],
      },
    ],
    [
      {
        numeraire: params.numeraire,
        buybackDst: normalized.buybackDestination,
        customFee: normalized.customFee,
        feeRoutingMode: normalized.feeRoutingMode,
        feeDistributionInfo: normalized.feeDistributionInfo,
      },
    ],
  );
}
