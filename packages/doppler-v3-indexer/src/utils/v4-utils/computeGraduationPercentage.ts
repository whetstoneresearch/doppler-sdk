import { formatEther } from "viem";

export const computeGraduationPercentage = ({
  maxThreshold,
  minThreshold,
  graduationBalance,
}: {
  maxThreshold: bigint;
  minThreshold: bigint | null;
  graduationBalance: bigint;
}): number => {
  if (maxThreshold === 0n || minThreshold === null || minThreshold === undefined) {
    return 0;
  }

  const totalRange = maxThreshold - minThreshold;
  
  // If no range to graduate through, return 0
  if (totalRange <= 0n) {
    return 0;
  }

  // If graduation balance has exceeded max threshold, percentage is 100
  if (graduationBalance >= maxThreshold) {
    return 100;
  }

  // If graduation balance is below min threshold, percentage is 0
  if (graduationBalance <= minThreshold) {
    return 0;
  }

  // Calculate progress from minThreshold to maxThreshold
  const progress = graduationBalance - minThreshold;
  
  const progressEther = parseFloat(formatEther(progress));
  const totalRangeEther = parseFloat(formatEther(totalRange));
  
  const percentage = (progressEther / totalRangeEther) * 100;
  
  // Ensure percentage is between 0 and 100
  return Math.max(0, Math.min(100, percentage));
};