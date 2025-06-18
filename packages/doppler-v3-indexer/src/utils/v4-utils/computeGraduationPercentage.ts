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

  // If graduation balance has reached or exceeded max threshold, instant graduation is complete (100%)
  if (graduationBalance >= maxThreshold) {
    return 100;
  }

  // Calculate progress toward instant graduation: (graduationBalance / maxThreshold) * 100
  const balanceEther = parseFloat(formatEther(graduationBalance));
  const thresholdEther = parseFloat(formatEther(maxThreshold));
  
  const percentage = (balanceEther / thresholdEther) * 100;
  
  // Ensure percentage is between 0 and 100
  return Math.max(0, Math.min(100, percentage));
};