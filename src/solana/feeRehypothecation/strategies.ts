import { getAddressEncoder, type Address } from '@solana/kit';

import type {
  FeeRouteArgs,
  FeeRoutingMatrixArgs,
  RehypeBeneficiaryInputArgs,
} from '../dopplerRehypeRouterV1/index.js';

export const FEE_REHYPOTHECATION_BPS_DENOMINATOR = 10_000;
export const MAX_FEE_REHYPOTHECATION_BENEFICIARIES = 8;
export const FEE_REHYPOTHECATION_ROUTING_MODE_DIRECT_BUYBACK = 0;
export const FEE_REHYPOTHECATION_ROUTING_MODE_TO_BENEFICIARIES = 1;

export type FeeRehypothecationStrategy = {
  routingMode:
    | typeof FEE_REHYPOTHECATION_ROUTING_MODE_DIRECT_BUYBACK
    | typeof FEE_REHYPOTHECATION_ROUTING_MODE_TO_BENEFICIARIES;
  feeRouting: FeeRoutingMatrixArgs;
};

function route(
  assetBuybackBps: number,
  numeraireBuybackBps: number,
  beneficiaryBps: number,
  lpBps: number,
): FeeRouteArgs {
  return {
    assetBuybackBps,
    numeraireBuybackBps,
    beneficiaryBps,
    lpBps,
  };
}

export function allFeesToBeneficiariesInAsset(): FeeRehypothecationStrategy {
  return {
    routingMode: FEE_REHYPOTHECATION_ROUTING_MODE_TO_BENEFICIARIES,
    feeRouting: {
      assetFees: route(10_000, 0, 0, 0),
      numeraireFees: route(10_000, 0, 0, 0),
    },
  };
}

export function allFeesToBeneficiariesInNumeraire(): FeeRehypothecationStrategy {
  return {
    routingMode: FEE_REHYPOTHECATION_ROUTING_MODE_TO_BENEFICIARIES,
    feeRouting: {
      assetFees: route(0, 10_000, 0, 0),
      numeraireFees: route(0, 10_000, 0, 0),
    },
  };
}

export function inKindBeneficiaryFees(): FeeRehypothecationStrategy {
  return {
    routingMode: FEE_REHYPOTHECATION_ROUTING_MODE_TO_BENEFICIARIES,
    feeRouting: {
      assetFees: route(0, 0, 10_000, 0),
      numeraireFees: route(0, 0, 10_000, 0),
    },
  };
}

export function balancedFourBucket(): FeeRehypothecationStrategy {
  return {
    routingMode: FEE_REHYPOTHECATION_ROUTING_MODE_DIRECT_BUYBACK,
    feeRouting: {
      assetFees: route(2_500, 2_500, 2_500, 2_500),
      numeraireFees: route(2_500, 2_500, 2_500, 2_500),
    },
  };
}

function validateRoute(label: string, value: FeeRouteArgs): void {
  const weights = [
    value.assetBuybackBps,
    value.numeraireBuybackBps,
    value.beneficiaryBps,
    value.lpBps,
  ];
  if (
    weights.some(
      (weight) =>
        !Number.isInteger(weight) ||
        weight < 0 ||
        weight > FEE_REHYPOTHECATION_BPS_DENOMINATOR,
    ) ||
    weights.reduce((sum, weight) => sum + weight, 0) !==
      FEE_REHYPOTHECATION_BPS_DENOMINATOR
  ) {
    throw new Error(`${label} routing weights must sum to 10000 bps`);
  }
}

export function validateFeeRehypothecationStrategy(
  strategy: FeeRehypothecationStrategy,
): void {
  if (
    strategy.routingMode !== FEE_REHYPOTHECATION_ROUTING_MODE_DIRECT_BUYBACK &&
    strategy.routingMode !== FEE_REHYPOTHECATION_ROUTING_MODE_TO_BENEFICIARIES
  ) {
    throw new Error('unsupported fee rehypothecation routing mode');
  }
  validateRoute('asset fee', strategy.feeRouting.assetFees);
  validateRoute('numeraire fee', strategy.feeRouting.numeraireFees);
}

export function feeRehypothecationRequiresBeneficiaries(
  strategy: FeeRehypothecationStrategy,
): boolean {
  const { assetFees, numeraireFees } = strategy.feeRouting;
  return (
    strategy.routingMode ===
      FEE_REHYPOTHECATION_ROUTING_MODE_TO_BENEFICIARIES ||
    assetFees.beneficiaryBps > 0 ||
    assetFees.numeraireBuybackBps > 0 ||
    assetFees.lpBps > 0 ||
    numeraireFees.beneficiaryBps > 0 ||
    numeraireFees.assetBuybackBps > 0 ||
    numeraireFees.lpBps > 0
  );
}

function compareAddressBytes(left: Address, right: Address): number {
  const encoder = getAddressEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  for (let index = 0; index < leftBytes.length; index += 1) {
    const difference = (leftBytes[index] ?? 0) - (rightBytes[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}

export function validateAndSortFeeRehypothecationBeneficiaries(
  beneficiaries: ReadonlyArray<RehypeBeneficiaryInputArgs>,
  strategy?: FeeRehypothecationStrategy,
): RehypeBeneficiaryInputArgs[] {
  const beneficiariesRequired =
    strategy === undefined || feeRehypothecationRequiresBeneficiaries(strategy);
  if (
    (beneficiariesRequired && beneficiaries.length === 0) ||
    beneficiaries.length > MAX_FEE_REHYPOTHECATION_BENEFICIARIES
  ) {
    throw new Error(
      beneficiariesRequired
        ? 'fee rehypothecation requires between 1 and 8 beneficiaries'
        : 'fee rehypothecation supports at most 8 beneficiaries',
    );
  }

  const sorted = [...beneficiaries].sort((left, right) =>
    compareAddressBytes(left.wallet, right.wallet),
  );
  let shareTotal = 0;
  for (const [index, beneficiary] of sorted.entries()) {
    if (
      !Number.isInteger(beneficiary.shareBps) ||
      beneficiary.shareBps <= 0 ||
      beneficiary.shareBps > FEE_REHYPOTHECATION_BPS_DENOMINATOR
    ) {
      throw new Error('beneficiary shares must be positive integer bps');
    }
    if (index > 0 && beneficiary.wallet === sorted[index - 1]?.wallet) {
      throw new Error(`duplicate beneficiary ${beneficiary.wallet}`);
    }
    shareTotal += beneficiary.shareBps;
  }
  if (
    beneficiaries.length > 0 &&
    shareTotal !== FEE_REHYPOTHECATION_BPS_DENOMINATOR
  ) {
    throw new Error('beneficiary shares must sum to 10000 bps');
  }

  return sorted;
}
