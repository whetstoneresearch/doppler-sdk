import { formatEther } from "viem";

export const computeGraduationPercentage = ({
  maxThreshold,
  graduationBalance,
}: {
  maxThreshold: bigint;
  graduationBalance: bigint;
}): number => {
  if (maxThreshold === 0n) {
    return 0;
  }

  const remaining = maxThreshold - graduationBalance;
  
  // If graduation balance has exceeded max threshold, percentage is 100
  if (remaining <= 0n) {
    return 100;
  }

  // Calculate percentage: formatEther(remaining) / formatEther(maxThreshold) * 100
  const remainingEther = parseFloat(formatEther(remaining));
  const maxThresholdEther = parseFloat(formatEther(maxThreshold));
  
  const percentage = ((maxThresholdEther - remainingEther) / maxThresholdEther) * 100;
  
  // Ensure percentage is between 0 and 100
  return Math.max(0, Math.min(100, percentage));
};