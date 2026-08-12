import type { FeeRouteArgs } from '../dopplerRehypeRouterV1/index.js';

const BPS_DENOMINATOR = 10_000n;
const MAX_U64 = (1n << 64n) - 1n;

function assertNonnegative(label: string, value: bigint): void {
  if (value < 0n) {
    throw new Error(`${label} must be nonnegative`);
  }
}

export function calculateFeeEntitlement(
  cumulativeFees: bigint,
  shareBps: number,
): bigint {
  assertNonnegative('cumulativeFees', cumulativeFees);
  if (!Number.isInteger(shareBps) || shareBps < 0 || shareBps > 10_000) {
    throw new Error('shareBps must be an integer between 0 and 10000');
  }
  return (cumulativeFees * BigInt(shareBps)) / BPS_DENOMINATOR;
}

export function calculateInitializerBeneficiaryEntitlement(
  cumulativeFees: bigint,
  protocolFeeBps: number,
  beneficiaryShareBps: number,
): bigint {
  const protocolFees = calculateFeeEntitlement(cumulativeFees, protocolFeeBps);
  return calculateFeeEntitlement(
    cumulativeFees - protocolFees,
    beneficiaryShareBps,
  );
}

export function calculatePendingInitializerFees({
  cumulativeFees,
  distributedProtocolFees,
  distributedBeneficiaryFees,
}: {
  cumulativeFees: bigint;
  distributedProtocolFees: bigint;
  distributedBeneficiaryFees: ReadonlyArray<bigint>;
}): bigint {
  const distributed = distributedBeneficiaryFees.reduce(
    (total, amount) => total + amount,
    distributedProtocolFees,
  );
  if (distributed > cumulativeFees) {
    throw new Error('distributed fees exceed cumulative fees');
  }
  return cumulativeFees - distributed;
}

export function splitCumulativeFeeIncrement(
  route: FeeRouteArgs,
  cumulativeFees: bigint,
  claimedFees: bigint,
): readonly [bigint, bigint, bigint, bigint] {
  assertNonnegative('cumulativeFees', cumulativeFees);
  assertNonnegative('claimedFees', claimedFees);
  const weights = [
    route.assetBuybackBps,
    route.numeraireBuybackBps,
    route.beneficiaryBps,
    route.lpBps,
  ];
  if (
    weights.some(
      (weight) => !Number.isInteger(weight) || weight < 0 || weight > 10_000,
    ) ||
    weights.reduce((sum, weight) => sum + weight, 0) !== 10_000
  ) {
    throw new Error('fee route must sum to 10000 bps');
  }

  const nextCumulativeFees = cumulativeFees + claimedFees;
  return weights.map((weight) => {
    const previous = (cumulativeFees * BigInt(weight)) / BPS_DENOMINATOR;
    const next = (nextCumulativeFees * BigInt(weight)) / BPS_DENOMINATOR;
    return next - previous;
  }) as unknown as readonly [bigint, bigint, bigint, bigint];
}

export function quoteZeroFeeExactIn({
  amountIn,
  reserveIn,
  reserveOut,
  virtualIn,
  virtualOut,
}: {
  amountIn: bigint;
  reserveIn: bigint;
  reserveOut: bigint;
  virtualIn: bigint;
  virtualOut: bigint;
}): bigint {
  for (const [label, value] of [
    ['amountIn', amountIn],
    ['reserveIn', reserveIn],
    ['reserveOut', reserveOut],
    ['virtualIn', virtualIn],
    ['virtualOut', virtualOut],
  ] as const) {
    if (value < 0n || value > MAX_U64) {
      throw new Error(`${label} must be between 0 and u64::MAX`);
    }
  }
  if (amountIn === 0n) {
    throw new Error('amountIn must be positive');
  }
  if (reserveOut === 0n) {
    return 0n;
  }

  const amountOut =
    ((reserveOut + virtualOut) * amountIn) / (reserveIn + virtualIn + amountIn);
  if (amountOut > MAX_U64) {
    throw new Error('amountOut exceeds u64::MAX');
  }
  return amountOut > reserveOut ? 0n : amountOut;
}

export function calculateMinimumOutput(
  expectedAmountOut: bigint,
  slippageBps = 50,
): bigint {
  assertNonnegative('expectedAmountOut', expectedAmountOut);
  if (
    !Number.isInteger(slippageBps) ||
    slippageBps < 0 ||
    slippageBps >= 10_000
  ) {
    throw new Error('slippageBps must be an integer between 0 and 9999');
  }
  if (expectedAmountOut === 0n) {
    return 0n;
  }
  const minimum =
    (expectedAmountOut * BigInt(10_000 - slippageBps)) / BPS_DENOMINATOR;
  return minimum > 0n ? minimum : 1n;
}

export function resolveProtectedMinimumOutput({
  expectedAmountOut,
  minimumAmountOut,
  slippageBps,
}: {
  expectedAmountOut: bigint;
  minimumAmountOut?: bigint;
  slippageBps?: number;
}): bigint {
  if (minimumAmountOut === undefined) {
    return calculateMinimumOutput(expectedAmountOut, slippageBps);
  }
  assertNonnegative('minimumAmountOut', minimumAmountOut);
  if (
    (expectedAmountOut === 0n && minimumAmountOut !== 0n) ||
    (expectedAmountOut > 0n &&
      (minimumAmountOut === 0n || minimumAmountOut > expectedAmountOut))
  ) {
    throw new Error('minimumAmountOut is incompatible with the current quote');
  }
  return minimumAmountOut;
}

export function calculateBeneficiaryEntitlement({
  cumulativeFees,
  beneficiarySharesBps,
  beneficiaryIndex,
}: {
  cumulativeFees: bigint;
  beneficiarySharesBps: ReadonlyArray<number>;
  beneficiaryIndex: number;
}): bigint {
  if (
    beneficiarySharesBps.length === 0 ||
    beneficiaryIndex < 0 ||
    beneficiaryIndex >= beneficiarySharesBps.length
  ) {
    throw new Error('invalid beneficiary index');
  }
  const finalIndex = beneficiarySharesBps.length - 1;
  if (beneficiaryIndex === finalIndex) {
    const priorEntitlements = beneficiarySharesBps
      .slice(0, finalIndex)
      .reduce(
        (total, shareBps) =>
          total + calculateFeeEntitlement(cumulativeFees, shareBps),
        0n,
      );
    return cumulativeFees - priorEntitlements;
  }
  return calculateFeeEntitlement(
    cumulativeFees,
    beneficiarySharesBps[beneficiaryIndex] ?? 0,
  );
}
