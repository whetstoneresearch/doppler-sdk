import { describe, expect, it } from 'vitest';
import { encodeAbiParameters, getAddress } from 'viem';
import { CHAIN_IDS } from '../../../../src/evm/addresses';
import { WAD } from '../../../../src/evm/constants';
import {
  encodeRehypeDopplerHookInitializerData,
  normalizeRehypeDopplerHookInitializerConfig,
} from '../../../../src/evm/utils';

const numeraire = getAddress('0x4200000000000000000000000000000000000006');
const hookAddress = getAddress('0x9999999999999999999999999999999999999999');
const buybackDestination = getAddress(
  '0x8888888888888888888888888888888888888888',
);
const beneficiary = getAddress('0x1111111111111111111111111111111111111111');
const legacyChainIds = Object.values(CHAIN_IDS).filter(
  (chainId) => chainId !== CHAIN_IDS.BASE_SEPOLIA,
);

describe('temporary Rehype initializer deployment compatibility', () => {
  it.each(legacyChainIds)('encodes the legacy tuple on chain %s', (chainId) => {
    // Given
    const config = normalizeRehypeDopplerHookInitializerConfig({
      hookAddress,
      buybackDestination,
      startFee: 3_000,
      feeDistributionInfo,
    });

    // When
    const encoded = encodeRehypeDopplerHookInitializerData(
      numeraire,
      config,
      chainId,
    );

    // Then
    expect(encoded).toBe(
      encodeAbiParameters(legacyRehypeInitializerDataAbi, [
        {
          numeraire,
          buybackDst: buybackDestination,
          startFee: 3_000,
          endFee: 3_000,
          durationSeconds: 0,
          startingTime: 0,
          feeRoutingMode: 0,
          feeDistributionInfo,
        },
      ]),
    );
  });

  it('rejects fee beneficiaries outside Base Sepolia', () => {
    // Given
    const config = normalizeRehypeDopplerHookInitializerConfig({
      hookAddress,
      feeBeneficiaries: [{ beneficiary, shares: WAD }],
      startFee: 3_000,
      feeDistributionInfo,
    });

    // When / Then
    expect(() =>
      encodeRehypeDopplerHookInitializerData(numeraire, config, CHAIN_IDS.BASE),
    ).toThrow('Rehype fee beneficiaries are temporarily supported only');
  });
});

const feeDistributionInfo = {
  assetFeesToAssetBuybackWad: 0n,
  assetFeesToNumeraireBuybackWad: 0n,
  assetFeesToBeneficiaryWad: WAD,
  assetFeesToLpWad: 0n,
  numeraireFeesToAssetBuybackWad: 0n,
  numeraireFeesToNumeraireBuybackWad: 0n,
  numeraireFeesToBeneficiaryWad: WAD,
  numeraireFeesToLpWad: 0n,
};

const feeDistributionComponents = [
  { name: 'assetFeesToAssetBuybackWad', type: 'uint256' },
  { name: 'assetFeesToNumeraireBuybackWad', type: 'uint256' },
  { name: 'assetFeesToBeneficiaryWad', type: 'uint256' },
  { name: 'assetFeesToLpWad', type: 'uint256' },
  { name: 'numeraireFeesToAssetBuybackWad', type: 'uint256' },
  { name: 'numeraireFeesToNumeraireBuybackWad', type: 'uint256' },
  { name: 'numeraireFeesToBeneficiaryWad', type: 'uint256' },
  { name: 'numeraireFeesToLpWad', type: 'uint256' },
] as const;

// TODO(PR #170): TEMPORARY until every deployed initializer accepts the
// fee-beneficiary tuple; revert the dedicated compatibility commit afterward.
const legacyRehypeInitializerDataAbi = [
  {
    type: 'tuple',
    components: [
      { name: 'numeraire', type: 'address' },
      { name: 'buybackDst', type: 'address' },
      { name: 'startFee', type: 'uint24' },
      { name: 'endFee', type: 'uint24' },
      { name: 'durationSeconds', type: 'uint32' },
      { name: 'startingTime', type: 'uint32' },
      { name: 'feeRoutingMode', type: 'uint8' },
      {
        name: 'feeDistributionInfo',
        type: 'tuple',
        components: feeDistributionComponents,
      },
    ],
  },
] as const;
