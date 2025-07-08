import { encodeAbiParameters, encodePacked, Hex, keccak256 } from "viem";
import { PoolKey } from "@app/types/v4-types";

export const getPoolId = (poolKey: PoolKey): Hex => {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "address" },
        { type: "address" },
        { type: "uint24" },
        { type: "int24" },
        { type: "address" },
      ],
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
