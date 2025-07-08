import { Address, encodeAbiParameters, Hex } from "viem";
import { PermitSingle } from "./Permit2";

export enum CommandType {
  V3_SWAP_EXACT_IN = 0x00,
  V3_SWAP_EXACT_OUT = 0x01,
  PERMIT2_TRANSFER_FROM = 0x02,
  SWEEP = 0x04,
  V2_SWAP_EXACT_IN = 0x08,
  V2_SWAP_EXACT_OUT = 0x09,
  PERMIT2_PERMIT = 0x0a,
  WRAP_ETH = 0x0b,
  UNWRAP_WETH = 0x0c,
  V4_SWAP = 0x10,
}

const PERMIT_STRUCT = {
  name: "permit",
  type: "tuple",
  components: [
    {
      name: "details",
      type: "tuple",
      components: [
        { name: "token", type: "address" },
        { name: "amount", type: "uint160" },
        { name: "expiration", type: "uint48" },
        { name: "nonce", type: "uint48" },
      ],
    },
    { name: "spender", type: "address" },
    { name: "sigDeadline", type: "uint256" },
  ],
} as const;

const ABI_DEFINITION: { [key in CommandType]: any[] } = {
  [CommandType.V3_SWAP_EXACT_IN]: [
    { type: "address" },
    { type: "uint256" },
    { type: "uint256" },
    { type: "bytes" },
    { type: "bool" },
  ],
  [CommandType.V3_SWAP_EXACT_OUT]: [
    { type: "address" },
    { type: "uint256" },
    { type: "uint256" },
    { type: "bytes" },
    { type: "bool" },
  ],
  [CommandType.PERMIT2_PERMIT]: [PERMIT_STRUCT, { type: "bytes" }],
  [CommandType.PERMIT2_TRANSFER_FROM]: [
    { type: "address" },
    { type: "address" },
    { type: "uint256" },
  ],
  [CommandType.V4_SWAP]: [{ type: "bytes" }, { type: "bytes[]" }],
  [CommandType.WRAP_ETH]: [{ type: "address" }, { type: "uint256" }],
  [CommandType.UNWRAP_WETH]: [{ type: "address" }, { type: "uint256" }],
  [CommandType.V2_SWAP_EXACT_IN]: [
    { type: "address" },
    { type: "uint256" },
    { type: "uint256" },
    { type: "address[]" },
    { type: "bool" },
  ],
  [CommandType.V2_SWAP_EXACT_OUT]: [
    { type: "address" },
    { type: "uint256" },
    { type: "uint256" },
    { type: "address[]" },
    { type: "bool" },
  ],
  [CommandType.SWEEP]: [
    { type: "address" },
    { type: "address" },
    { type: "uint256" },
  ],
};

export class CommandBuilder {
  commands: Hex = "0x";
  inputs: Hex[] = [];

  addCommand(type: CommandType, parameters: any[]): this {
    const encoded = encodeAbiParameters(ABI_DEFINITION[type], parameters);
    this.commands += type.toString(16).padStart(2, "0");
    this.inputs.push(encoded);
    return this;
  }

  addPermit2Permit(permit: PermitSingle, signature: Hex): this {
    return this.addCommand(CommandType.PERMIT2_PERMIT, [permit, signature]);
  }

  addWrapEth(recipient: Address, amount: bigint): this {
    return this.addCommand(CommandType.WRAP_ETH, [recipient, amount]);
  }

  addUnwrapWeth(recipient: Address, amount: bigint): this {
    return this.addCommand(CommandType.UNWRAP_WETH, [recipient, amount]);
  }

  addV3SwapExactIn(
    recipient: Address,
    amountIn: bigint,
    amountOutMinimum: bigint,
    path: Hex,
    unwrap: boolean
  ): this {
    return this.addCommand(CommandType.V3_SWAP_EXACT_IN, [
      recipient,
      amountIn,
      amountOutMinimum,
      path,
      unwrap,
    ]);
  }

  addV3SwapExactOut(
    recipient: Address,
    amountOut: bigint,
    amountInMaximum: bigint,
    path: Hex,
    payerIsMsgSender: boolean
  ): this {
    return this.addCommand(CommandType.V3_SWAP_EXACT_OUT, [
      recipient,
      amountOut,
      amountInMaximum,
      path,
      payerIsMsgSender,
    ]);
  }

  addPermit2TransferFrom(
    token: Address,
    recipient: Address,
    amount: bigint
  ): this {
    return this.addCommand(CommandType.PERMIT2_TRANSFER_FROM, [
      token,
      recipient,
      amount,
    ]);
  }

  addV2SwapExactIn(
    recipient: Address,
    amountIn: bigint,
    amountOutMinimum: bigint,
    path: Address[],
    payerIsMsgSender: boolean
  ): this {
    return this.addCommand(CommandType.V2_SWAP_EXACT_IN, [
      recipient,
      amountIn,
      amountOutMinimum,
      path,
      payerIsMsgSender,
    ]);
  }

  addV2SwapExactOut(
    recipient: Address,
    amountOut: bigint,
    amountInMaximum: bigint,
    path: Address[],
    payerIsMsgSender: boolean
  ): this {
    return this.addCommand(CommandType.V2_SWAP_EXACT_OUT, [
      recipient,
      amountOut,
      amountInMaximum,
      path,
      payerIsMsgSender,
    ]);
  }

  addV4Swap(actions: Hex, params: Hex[]): this {
    return this.addCommand(CommandType.V4_SWAP, [actions, params]);
  }

  build(): [Hex, Hex[]] {
    return [this.commands, this.inputs];
  }
}
