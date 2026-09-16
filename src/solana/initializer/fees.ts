/** Pending fees held in a launch vault, excluded from its trading reserves. */
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
