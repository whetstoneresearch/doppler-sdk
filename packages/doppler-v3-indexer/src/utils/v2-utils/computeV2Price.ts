import { WAD } from "../constants";

export const computeV2Price = async ({
  assetBalance,
  quoteBalance,
}: {
  assetBalance: bigint;
  quoteBalance: bigint;
}) => {
  const quote = (WAD * quoteBalance) / assetBalance;
  return quote;
};
