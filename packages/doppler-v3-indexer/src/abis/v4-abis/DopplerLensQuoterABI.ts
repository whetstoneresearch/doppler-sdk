export const DopplerLensQuoterABI = [
  {
    type: "constructor",
    inputs: [
      {
        name: "poolManager_",
        type: "address",
        internalType: "contract IPoolManager",
      },
      {
        name: "stateView_",
        type: "address",
        internalType: "contract IStateView",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "_quoteDopplerLensDataExactInputSingle",
    inputs: [
      {
        name: "params",
        type: "tuple",
        internalType: "struct IV4Quoter.QuoteExactSingleParams",
        components: [
          {
            name: "poolKey",
            type: "tuple",
            internalType: "struct PoolKey",
            components: [
              { name: "currency0", type: "address", internalType: "Currency" },
              { name: "currency1", type: "address", internalType: "Currency" },
              { name: "fee", type: "uint24", internalType: "uint24" },
              { name: "tickSpacing", type: "int24", internalType: "int24" },
              {
                name: "hooks",
                type: "address",
                internalType: "contract IHooks",
              },
            ],
          },
          { name: "zeroForOne", type: "bool", internalType: "bool" },
          { name: "exactAmount", type: "uint128", internalType: "uint128" },
          { name: "hookData", type: "bytes", internalType: "bytes" },
        ],
      },
    ],
    outputs: [{ name: "", type: "bytes", internalType: "bytes" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "poolManager",
    inputs: [],
    outputs: [
      { name: "", type: "address", internalType: "contract IPoolManager" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "quoteDopplerLensData",
    inputs: [
      {
        name: "params",
        type: "tuple",
        internalType: "struct IV4Quoter.QuoteExactSingleParams",
        components: [
          {
            name: "poolKey",
            type: "tuple",
            internalType: "struct PoolKey",
            components: [
              { name: "currency0", type: "address", internalType: "Currency" },
              { name: "currency1", type: "address", internalType: "Currency" },
              { name: "fee", type: "uint24", internalType: "uint24" },
              { name: "tickSpacing", type: "int24", internalType: "int24" },
              {
                name: "hooks",
                type: "address",
                internalType: "contract IHooks",
              },
            ],
          },
          { name: "zeroForOne", type: "bool", internalType: "bool" },
          { name: "exactAmount", type: "uint128", internalType: "uint128" },
          { name: "hookData", type: "bytes", internalType: "bytes" },
        ],
      },
    ],
    outputs: [
      {
        name: "returnData",
        type: "tuple",
        internalType: "struct DopplerLensReturnData",
        components: [
          { name: "sqrtPriceX96", type: "uint160", internalType: "uint160" },
          { name: "amount0", type: "uint256", internalType: "uint256" },
          { name: "amount1", type: "uint256", internalType: "uint256" },
          { name: "tick", type: "int24", internalType: "int24" },
        ],
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "stateView",
    inputs: [],
    outputs: [
      { name: "", type: "address", internalType: "contract IStateView" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "unlockCallback",
    inputs: [{ name: "data", type: "bytes", internalType: "bytes" }],
    outputs: [{ name: "", type: "bytes", internalType: "bytes" }],
    stateMutability: "nonpayable",
  },
  {
    type: "error",
    name: "DopplerLensData",
    inputs: [
      {
        name: "returnData",
        type: "tuple",
        internalType: "struct DopplerLensReturnData",
        components: [
          { name: "sqrtPriceX96", type: "uint160", internalType: "uint160" },
          { name: "amount0", type: "uint256", internalType: "uint256" },
          { name: "amount1", type: "uint256", internalType: "uint256" },
          { name: "tick", type: "int24", internalType: "int24" },
        ],
      },
    ],
  },
  {
    type: "error",
    name: "NotEnoughLiquidity",
    inputs: [{ name: "poolId", type: "bytes32", internalType: "PoolId" }],
  },
  { type: "error", name: "NotPoolManager", inputs: [] },
  { type: "error", name: "NotSelf", inputs: [] },
  { type: "error", name: "UnexpectedCallSuccess", inputs: [] },
  {
    type: "error",
    name: "UnexpectedRevertBytes",
    inputs: [{ name: "revertData", type: "bytes", internalType: "bytes" }],
  },
] as const;
