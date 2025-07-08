import { Address, encodeAbiParameters, Hex } from "viem";

export enum V4ActionType {
  INCREASE_LIQUIDITY = 0x00,
  DECREASE_LIQUIDITY = 0x01,
  MINT_POSITION = 0x02,
  BURN_POSITION = 0x03,
  INCREASE_LIQUIDITY_FROM_DELTAS = 0x04,
  MINT_POSITION_FROM_DELTAS = 0x05,
  SWAP_EXACT_IN_SINGLE = 0x06,
  SWAP_EXACT_IN = 0x07,
  SWAP_EXACT_OUT_SINGLE = 0x08,
  SWAP_EXACT_OUT = 0x09,
  SETTLE = 0x0b,
  SETTLE_ALL = 0x0c,
  TAKE = 0x0e,
  TAKE_ALL = 0x0f,
  TAKE_PORTION = 0x10,
  CLOSE_CURRENCY = 0x12,
  SWEEP = 0x14,
  WRAP = 0x15,
  UNWRAP = 0x16,
}

const POOL_KEY_STRUCT = {
  name: "poolKey",
  type: "tuple",
  components: [
    { name: "currency0", type: "address" },
    { name: "currency1", type: "address" },
    { name: "fee", type: "uint24" },
    { name: "tickSpacing", type: "int24" },
    { name: "hooks", type: "address" },
  ],
} as const;

const PATH_KEY_STRUCT = {
  name: "pathKey",
  type: "tuple",
  components: [
    { name: "intermediateCurrency", type: "address" },
    { name: "fee", type: "uint256" },
    { name: "tickSpacing", type: "int24" },
    { name: "hooks", type: "address" },
    { name: "hookData", type: "bytes" },
  ],
} as const;

const ABI_DEFINITION: { [key in V4ActionType]: any[] } = {
  [V4ActionType.INCREASE_LIQUIDITY]: [
    { type: "uint256" },
    { type: "uint256" },
    { type: "uint128" },
    { type: "uint128" },
    { type: "bytes" },
  ],
  [V4ActionType.DECREASE_LIQUIDITY]: [
    { type: "uint256" },
    { type: "uint256" },
    { type: "uint128" },
    { type: "uint128" },
    { type: "bytes" },
  ],
  [V4ActionType.MINT_POSITION]: [
    POOL_KEY_STRUCT,
    { type: "int24" },
    { type: "int24" },
    { type: "uint256" },
    { type: "uint128" },
    { type: "uint128" },
    { type: "address" },
    { type: "bytes" },
  ],
  [V4ActionType.BURN_POSITION]: [
    { type: "uint256" },
    { type: "uint128" },
    { type: "uint128" },
    { type: "bytes" },
  ],
  [V4ActionType.INCREASE_LIQUIDITY_FROM_DELTAS]: [
    { type: "uint256" },
    { type: "uint128" },
    { type: "uint128" },
    { type: "bytes" },
  ],
  [V4ActionType.MINT_POSITION_FROM_DELTAS]: [
    POOL_KEY_STRUCT,
    { type: "int24" },
    { type: "int24" },
    { type: "uint128" },
    { type: "uint128" },
    { type: "address" },
    { type: "bytes" },
  ],
  [V4ActionType.SWAP_EXACT_IN_SINGLE]: [
    {
      name: "swapParams",
      type: "tuple",
      components: [
        POOL_KEY_STRUCT,
        { name: "zeroForOne", type: "bool" },
        { name: "amountIn", type: "uint128" },
        { name: "amountOutMinimum", type: "uint128" },
        { name: "hookData", type: "bytes" },
      ],
    },
  ],
  [V4ActionType.SWAP_EXACT_IN]: [
    {
      name: "swapParams",
      type: "tuple",
      components: [
        { name: "currencyIn", type: "address" },
        {
          name: "path",
          type: "tuple[]",
          components: PATH_KEY_STRUCT.components,
        },
        { name: "amountIn", type: "uint128" },
        { name: "amountOutMinimum", type: "uint128" },
      ],
    },
  ],
  [V4ActionType.SWAP_EXACT_OUT_SINGLE]: [
    {
      name: "swapParams",
      type: "tuple",
      components: [
        POOL_KEY_STRUCT,
        { name: "zeroForOne", type: "bool" },
        { name: "amountOut", type: "uint128" },
        { name: "amountInMaximum", type: "uint128" },
        { name: "hookData", type: "bytes" },
      ],
    },
  ],
  [V4ActionType.SWAP_EXACT_OUT]: [
    {
      name: "swapParams",
      type: "tuple",
      components: [
        { name: "currencyOut", type: "address" },
        {
          name: "path",
          type: "tuple[]",
          components: PATH_KEY_STRUCT.components,
        },
        { name: "amountOut", type: "uint128" },
        { name: "amountInMaximum", type: "uint128" },
      ],
    },
  ],
  [V4ActionType.SETTLE]: [
    { type: "address" },
    { type: "uint256" },
    { type: "bool" },
  ],
  [V4ActionType.SETTLE_ALL]: [{ type: "address" }, { type: "uint256" }],
  [V4ActionType.TAKE]: [
    { type: "address" },
    { type: "address" },
    { type: "uint256" },
  ],
  [V4ActionType.TAKE_ALL]: [{ type: "address" }, { type: "uint256" }],
  [V4ActionType.TAKE_PORTION]: [
    { type: "address" },
    { type: "address" },
    { type: "uint256" },
  ],
  [V4ActionType.CLOSE_CURRENCY]: [{ type: "address" }],
  [V4ActionType.SWEEP]: [{ type: "address" }, { type: "address" }],
  [V4ActionType.WRAP]: [{ type: "uint256" }],
  [V4ActionType.UNWRAP]: [{ type: "uint256" }],
};

export class V4ActionBuilder {
  actions: Hex = "0x";
  inputs: Hex[] = [];

  addAction(type: V4ActionType, parameters: any[]): this {
    const encoded = encodeAbiParameters(ABI_DEFINITION[type], parameters);
    this.actions += type.toString(16).padStart(2, "0");
    this.inputs.push(encoded);
    return this;
  }

  addSwapExactInSingle(
    poolKey: any,
    zeroForOne: boolean,
    amountIn: bigint,
    amountOutMinimum: bigint,
    hookData: Hex
  ): this {
    return this.addAction(V4ActionType.SWAP_EXACT_IN_SINGLE, [
      {
        poolKey,
        zeroForOne,
        amountIn,
        amountOutMinimum,
        hookData,
      },
    ]);
  }

  addSwapExactOutSingle(
    poolKey: any,
    zeroForOne: boolean,
    amountOut: bigint,
    amountInMaximum: bigint,
    hookData: Hex
  ): this {
    return this.addAction(V4ActionType.SWAP_EXACT_OUT_SINGLE, [
      {
        poolKey,
        zeroForOne,
        amountOut,
        amountInMaximum,
        hookData,
      },
    ]);
  }

  addWrap(amount: bigint): this {
    return this.addAction(V4ActionType.WRAP, [amount]);
  }

  addUnwrap(amount: bigint): this {
    return this.addAction(V4ActionType.UNWRAP, [amount]);
  }

  build(): [Hex, Hex[]] {
    return [this.actions, this.inputs];
  }
}
