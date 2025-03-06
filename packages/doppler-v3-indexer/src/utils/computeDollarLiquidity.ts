import { Context } from "ponder:registry";
import { fetchEthPrice } from "../indexer/shared/oracle";
import { WAD, CHAINLINK_ETH_DECIMALS } from "../utils/constants";

export const computeDollarLiquidity = async ({
  assetBalance,
  quoteBalance,
  price,
  ethPrice,
}: {
  assetBalance: bigint;
  quoteBalance: bigint;
  price: bigint;
  ethPrice: bigint;
}) => {
  console.log("assetBalance", assetBalance);
  console.log("quoteBalance", quoteBalance);
  console.log("price", price);
  console.log("ethPrice", ethPrice);
  const assetLiquidity =
    (((assetBalance * price) / WAD) * ethPrice) / CHAINLINK_ETH_DECIMALS;
  const numeraireLiquidity = (quoteBalance * ethPrice) / CHAINLINK_ETH_DECIMALS;

  return assetLiquidity + numeraireLiquidity;
};
