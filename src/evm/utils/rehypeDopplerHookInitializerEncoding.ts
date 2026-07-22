import { encodeAbiParameters, type Address, type Hex } from 'viem';
import { CHAIN_IDS, type SupportedChainId } from '../addresses';
import { ZERO_ADDRESS } from '../constants';
import type { NormalizedRehypeDopplerHookInitializerConfig } from './rehypeDopplerHookInitializer';

export function encodeRehypeDopplerHookInitializerData(
  numeraire: Address,
  config: NormalizedRehypeDopplerHookInitializerConfig,
  chainId: SupportedChainId,
): Hex {
  if (chainId === CHAIN_IDS.BASE_SEPOLIA) {
    return encodeAbiParameters(rehypeInitializerDataAbi, [
      {
        numeraire,
        buybackDst: config.buybackDestination ?? ZERO_ADDRESS,
        startFee: config.startFee,
        endFee: config.endFee,
        durationSeconds: config.durationSeconds,
        startingTime: config.startingTime,
        feeRoutingMode: config.feeRoutingMode,
        feeDistributionInfo: config.feeDistributionInfo,
        feeBeneficiaries: config.feeBeneficiaries ?? [],
      },
    ]);
  }

  // TODO(PR #170): TEMPORARY until every deployed initializer accepts the
  // fee-beneficiary tuple; revert the dedicated compatibility commit afterward.
  if (config.feeBeneficiaries !== undefined) {
    throw new Error(
      'Rehype fee beneficiaries are temporarily supported only on Base Sepolia until the remaining initializer deployments are upgraded',
    );
  }

  return encodeAbiParameters(legacyRehypeInitializerDataAbi, [
    {
      numeraire,
      buybackDst: config.buybackDestination,
      startFee: config.startFee,
      endFee: config.endFee,
      durationSeconds: config.durationSeconds,
      startingTime: config.startingTime,
      feeRoutingMode: config.feeRoutingMode,
      feeDistributionInfo: config.feeDistributionInfo,
    },
  ]);
}

const beneficiaryComponents = [
  { name: 'beneficiary', type: 'address' },
  { name: 'shares', type: 'uint96' },
] as const;

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

// TODO(PR #170): TEMPORARY legacy tuple; remove with the deployment branch.
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

const rehypeInitializerDataAbi = [
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
      {
        name: 'feeBeneficiaries',
        type: 'tuple[]',
        components: beneficiaryComponents,
      },
    ],
  },
] as const;
