import { CHAINLINK_ETH_DECIMALS, Q192, WAD } from "@app/utils/constants";

export const computeDollarPrice = ({
  sqrtPriceX96,
  totalSupply,
  ethPrice,
  isToken0,
  decimals,
}: {
  sqrtPriceX96: bigint;
  totalSupply: bigint;
  ethPrice: bigint;
  isToken0: boolean;
  decimals: number;
}) => {
  const ratioX192 = sqrtPriceX96 * sqrtPriceX96;

  const baseTokenDecimalScale = 10 ** decimals;

  const price = isToken0
    ? (ratioX192 * BigInt(baseTokenDecimalScale)) / Q192
    : (Q192 * BigInt(baseTokenDecimalScale)) / ratioX192;

  const dollarPrice = (price * ethPrice) / CHAINLINK_ETH_DECIMALS;
  const scaledDollarPrice = dollarPrice * BigInt(10) ** BigInt(10);
  const unitPrice = (scaledDollarPrice * WAD) / totalSupply;

  return unitPrice;
};
