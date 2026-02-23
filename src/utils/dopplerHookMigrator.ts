import { encodeAbiParameters, type Address, type Hex } from 'viem';
import type { RehypeDopplerHookMigratorConfig } from '../types';

export function encodeRehypeDopplerHookMigratorCalldata(params: {
  numeraire: Address;
  config: RehypeDopplerHookMigratorConfig;
}): Hex {
  return encodeAbiParameters(
    [
      { type: 'address' }, // numeraire
      { type: 'address' }, // buybackDestination
      { type: 'uint24' }, // customFee
      { type: 'uint256' }, // assetBuybackPercentWad
      { type: 'uint256' }, // numeraireBuybackPercentWad
      { type: 'uint256' }, // beneficiaryPercentWad
      { type: 'uint256' }, // lpPercentWad
    ],
    [
      params.numeraire,
      params.config.buybackDestination,
      params.config.customFee,
      params.config.assetBuybackPercentWad,
      params.config.numeraireBuybackPercentWad,
      params.config.beneficiaryPercentWad,
      params.config.lpPercentWad,
    ],
  );
}
