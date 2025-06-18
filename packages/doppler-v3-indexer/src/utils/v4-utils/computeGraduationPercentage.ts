import { formatEther } from "viem";

export const computeGraduationPercentage = ({
  minThreshold,
  graduationBalance,
}: {
  minThreshold: bigint | null;
  graduationBalance: bigint;
}): number => {
  if (minThreshold === null || minThreshold === undefined || minThreshold === 0n) {
    return 0;
  }

  // If graduation balance has reached or exceeded min threshold, graduation is complete (100%)
  if (graduationBalance >= minThreshold) {
    return 100;
  }

  // Calculate progress toward graduation: (graduationBalance / minThreshold) * 100
  const balanceEther = parseFloat(formatEther(graduationBalance));
  const thresholdEther = parseFloat(formatEther(minThreshold));
  
  const percentage = (balanceEther / thresholdEther) * 100;
  
  // Ensure percentage is between 0 and 100
  return Math.max(0, Math.min(100, percentage));
};