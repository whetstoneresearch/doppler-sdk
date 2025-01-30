import { encodePacked, Hex, keccak256 } from "viem";
import { PoolKey } from "@app/types/v4-types";

export const getPoolId = (poolKey: PoolKey): Hex => {
  return keccak256(
    encodePacked(
      ["address", "address", "uint24", "uint24", "address"],
      [
        poolKey.currency0,
        poolKey.currency1,
        poolKey.fee,
        poolKey.tickSpacing,
        poolKey.hooks,
      ]
    )
  );
};
