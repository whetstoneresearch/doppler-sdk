export const DopplerABI = [
  {
    type: "constructor",
    inputs: [
      {
        name: "_poolManager",
        type: "address",
        internalType: "contract IPoolManager",
      },
      { name: "_numTokensToSell", type: "uint256", internalType: "uint256" },
      { name: "_minimumProceeds", type: "uint256", internalType: "uint256" },
      { name: "_maximumProceeds", type: "uint256", internalType: "uint256" },
      { name: "_startingTime", type: "uint256", internalType: "uint256" },
      { name: "_endingTime", type: "uint256", internalType: "uint256" },
      { name: "_startingTick", type: "int24", internalType: "int24" },
      { name: "_endingTick", type: "int24", internalType: "int24" },
      { name: "_epochLength", type: "uint256", internalType: "uint256" },
      { name: "_gamma", type: "int24", internalType: "int24" },
      { name: "_isToken0", type: "bool", internalType: "bool" },
      { name: "_numPDSlugs", type: "uint256", internalType: "uint256" },
      { name: "initializer_", type: "address", internalType: "address" },
    ],
    stateMutability: "nonpayable",
  },
  { type: "receive", stateMutability: "payable" },
  {
    type: "function",
    name: "afterAddLiquidity",
    inputs: [
      { name: "", type: "address", internalType: "address" },
      {
        name: "",
        type: "tuple",
        internalType: "struct PoolKey",
        components: [
          { name: "currency0", type: "address", internalType: "Currency" },
          { name: "currency1", type: "address", internalType: "Currency" },
          { name: "fee", type: "uint24", internalType: "uint24" },
          { name: "tickSpacing", type: "int24", internalType: "int24" },
          { name: "hooks", type: "address", internalType: "contract IHooks" },
        ],
      },
      {
        name: "",
        type: "tuple",
        internalType: "struct IPoolManager.ModifyLiquidityParams",
        components: [
          { name: "tickLower", type: "int24", internalType: "int24" },
          { name: "tickUpper", type: "int24", internalType: "int24" },
          { name: "liquidityDelta", type: "int256", internalType: "int256" },
          { name: "salt", type: "bytes32", internalType: "bytes32" },
        ],
      },
      { name: "", type: "int256", internalType: "BalanceDelta" },
      { name: "", type: "int256", internalType: "BalanceDelta" },
      { name: "", type: "bytes", internalType: "bytes" },
    ],
    outputs: [
      { name: "", type: "bytes4", internalType: "bytes4" },
      { name: "", type: "int256", internalType: "BalanceDelta" },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "afterDonate",
    inputs: [
      { name: "", type: "address", internalType: "address" },
      {
        name: "",
        type: "tuple",
        internalType: "struct PoolKey",
        components: [
          { name: "currency0", type: "address", internalType: "Currency" },
          { name: "currency1", type: "address", internalType: "Currency" },
          { name: "fee", type: "uint24", internalType: "uint24" },
          { name: "tickSpacing", type: "int24", internalType: "int24" },
          { name: "hooks", type: "address", internalType: "contract IHooks" },
        ],
      },
      { name: "", type: "uint256", internalType: "uint256" },
      { name: "", type: "uint256", internalType: "uint256" },
      { name: "", type: "bytes", internalType: "bytes" },
    ],
    outputs: [{ name: "", type: "bytes4", internalType: "bytes4" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "afterInitialize",
    inputs: [
      { name: "sender", type: "address", internalType: "address" },
      {
        name: "key",
        type: "tuple",
        internalType: "struct PoolKey",
        components: [
          { name: "currency0", type: "address", internalType: "Currency" },
          { name: "currency1", type: "address", internalType: "Currency" },
          { name: "fee", type: "uint24", internalType: "uint24" },
          { name: "tickSpacing", type: "int24", internalType: "int24" },
          { name: "hooks", type: "address", internalType: "contract IHooks" },
        ],
      },
      { name: "", type: "uint160", internalType: "uint160" },
      { name: "tick", type: "int24", internalType: "int24" },
    ],
    outputs: [{ name: "", type: "bytes4", internalType: "bytes4" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "afterRemoveLiquidity",
    inputs: [
      { name: "", type: "address", internalType: "address" },
      {
        name: "",
        type: "tuple",
        internalType: "struct PoolKey",
        components: [
          { name: "currency0", type: "address", internalType: "Currency" },
          { name: "currency1", type: "address", internalType: "Currency" },
          { name: "fee", type: "uint24", internalType: "uint24" },
          { name: "tickSpacing", type: "int24", internalType: "int24" },
          { name: "hooks", type: "address", internalType: "contract IHooks" },
        ],
      },
      {
        name: "",
        type: "tuple",
        internalType: "struct IPoolManager.ModifyLiquidityParams",
        components: [
          { name: "tickLower", type: "int24", internalType: "int24" },
          { name: "tickUpper", type: "int24", internalType: "int24" },
          { name: "liquidityDelta", type: "int256", internalType: "int256" },
          { name: "salt", type: "bytes32", internalType: "bytes32" },
        ],
      },
      { name: "", type: "int256", internalType: "BalanceDelta" },
      { name: "", type: "int256", internalType: "BalanceDelta" },
      { name: "", type: "bytes", internalType: "bytes" },
    ],
    outputs: [
      { name: "", type: "bytes4", internalType: "bytes4" },
      { name: "", type: "int256", internalType: "BalanceDelta" },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "afterSwap",
    inputs: [
      { name: "", type: "address", internalType: "address" },
      {
        name: "key",
        type: "tuple",
        internalType: "struct PoolKey",
        components: [
          { name: "currency0", type: "address", internalType: "Currency" },
          { name: "currency1", type: "address", internalType: "Currency" },
          { name: "fee", type: "uint24", internalType: "uint24" },
          { name: "tickSpacing", type: "int24", internalType: "int24" },
          { name: "hooks", type: "address", internalType: "contract IHooks" },
        ],
      },
      {
        name: "swapParams",
        type: "tuple",
        internalType: "struct IPoolManager.SwapParams",
        components: [
          { name: "zeroForOne", type: "bool", internalType: "bool" },
          { name: "amountSpecified", type: "int256", internalType: "int256" },
          {
            name: "sqrtPriceLimitX96",
            type: "uint160",
            internalType: "uint160",
          },
        ],
      },
      { name: "swapDelta", type: "int256", internalType: "BalanceDelta" },
      { name: "", type: "bytes", internalType: "bytes" },
    ],
    outputs: [
      { name: "", type: "bytes4", internalType: "bytes4" },
      { name: "", type: "int128", internalType: "int128" },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "beforeAddLiquidity",
    inputs: [
      { name: "caller", type: "address", internalType: "address" },
      {
        name: "",
        type: "tuple",
        internalType: "struct PoolKey",
        components: [
          { name: "currency0", type: "address", internalType: "Currency" },
          { name: "currency1", type: "address", internalType: "Currency" },
          { name: "fee", type: "uint24", internalType: "uint24" },
          { name: "tickSpacing", type: "int24", internalType: "int24" },
          { name: "hooks", type: "address", internalType: "contract IHooks" },
        ],
      },
      {
        name: "",
        type: "tuple",
        internalType: "struct IPoolManager.ModifyLiquidityParams",
        components: [
          { name: "tickLower", type: "int24", internalType: "int24" },
          { name: "tickUpper", type: "int24", internalType: "int24" },
          { name: "liquidityDelta", type: "int256", internalType: "int256" },
          { name: "salt", type: "bytes32", internalType: "bytes32" },
        ],
      },
      { name: "", type: "bytes", internalType: "bytes" },
    ],
    outputs: [{ name: "", type: "bytes4", internalType: "bytes4" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "beforeDonate",
    inputs: [
      { name: "", type: "address", internalType: "address" },
      {
        name: "",
        type: "tuple",
        internalType: "struct PoolKey",
        components: [
          { name: "currency0", type: "address", internalType: "Currency" },
          { name: "currency1", type: "address", internalType: "Currency" },
          { name: "fee", type: "uint24", internalType: "uint24" },
          { name: "tickSpacing", type: "int24", internalType: "int24" },
          { name: "hooks", type: "address", internalType: "contract IHooks" },
        ],
      },
      { name: "", type: "uint256", internalType: "uint256" },
      { name: "", type: "uint256", internalType: "uint256" },
      { name: "", type: "bytes", internalType: "bytes" },
    ],
    outputs: [{ name: "", type: "bytes4", internalType: "bytes4" }],
    stateMutability: "pure",
  },
  {
    type: "function",
    name: "beforeInitialize",
    inputs: [
      { name: "", type: "address", internalType: "address" },
      {
        name: "key",
        type: "tuple",
        internalType: "struct PoolKey",
        components: [
          { name: "currency0", type: "address", internalType: "Currency" },
          { name: "currency1", type: "address", internalType: "Currency" },
          { name: "fee", type: "uint24", internalType: "uint24" },
          { name: "tickSpacing", type: "int24", internalType: "int24" },
          { name: "hooks", type: "address", internalType: "contract IHooks" },
        ],
      },
      { name: "", type: "uint160", internalType: "uint160" },
    ],
    outputs: [{ name: "", type: "bytes4", internalType: "bytes4" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "beforeRemoveLiquidity",
    inputs: [
      { name: "", type: "address", internalType: "address" },
      {
        name: "",
        type: "tuple",
        internalType: "struct PoolKey",
        components: [
          { name: "currency0", type: "address", internalType: "Currency" },
          { name: "currency1", type: "address", internalType: "Currency" },
          { name: "fee", type: "uint24", internalType: "uint24" },
          { name: "tickSpacing", type: "int24", internalType: "int24" },
          { name: "hooks", type: "address", internalType: "contract IHooks" },
        ],
      },
      {
        name: "",
        type: "tuple",
        internalType: "struct IPoolManager.ModifyLiquidityParams",
        components: [
          { name: "tickLower", type: "int24", internalType: "int24" },
          { name: "tickUpper", type: "int24", internalType: "int24" },
          { name: "liquidityDelta", type: "int256", internalType: "int256" },
          { name: "salt", type: "bytes32", internalType: "bytes32" },
        ],
      },
      { name: "", type: "bytes", internalType: "bytes" },
    ],
    outputs: [{ name: "", type: "bytes4", internalType: "bytes4" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "beforeSwap",
    inputs: [
      { name: "", type: "address", internalType: "address" },
      {
        name: "key",
        type: "tuple",
        internalType: "struct PoolKey",
        components: [
          { name: "currency0", type: "address", internalType: "Currency" },
          { name: "currency1", type: "address", internalType: "Currency" },
          { name: "fee", type: "uint24", internalType: "uint24" },
          { name: "tickSpacing", type: "int24", internalType: "int24" },
          { name: "hooks", type: "address", internalType: "contract IHooks" },
        ],
      },
      {
        name: "swapParams",
        type: "tuple",
        internalType: "struct IPoolManager.SwapParams",
        components: [
          { name: "zeroForOne", type: "bool", internalType: "bool" },
          { name: "amountSpecified", type: "int256", internalType: "int256" },
          {
            name: "sqrtPriceLimitX96",
            type: "uint160",
            internalType: "uint160",
          },
        ],
      },
      { name: "", type: "bytes", internalType: "bytes" },
    ],
    outputs: [
      { name: "", type: "bytes4", internalType: "bytes4" },
      { name: "", type: "int256", internalType: "BeforeSwapDelta" },
      { name: "", type: "uint24", internalType: "uint24" },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "earlyExit",
    inputs: [],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getHookPermissions",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct Hooks.Permissions",
        components: [
          { name: "beforeInitialize", type: "bool", internalType: "bool" },
          { name: "afterInitialize", type: "bool", internalType: "bool" },
          { name: "beforeAddLiquidity", type: "bool", internalType: "bool" },
          { name: "afterAddLiquidity", type: "bool", internalType: "bool" },
          { name: "beforeRemoveLiquidity", type: "bool", internalType: "bool" },
          { name: "afterRemoveLiquidity", type: "bool", internalType: "bool" },
          { name: "beforeSwap", type: "bool", internalType: "bool" },
          { name: "afterSwap", type: "bool", internalType: "bool" },
          { name: "beforeDonate", type: "bool", internalType: "bool" },
          { name: "afterDonate", type: "bool", internalType: "bool" },
          { name: "beforeSwapReturnDelta", type: "bool", internalType: "bool" },
          { name: "afterSwapReturnDelta", type: "bool", internalType: "bool" },
          {
            name: "afterAddLiquidityReturnDelta",
            type: "bool",
            internalType: "bool",
          },
          {
            name: "afterRemoveLiquidityReturnDelta",
            type: "bool",
            internalType: "bool",
          },
        ],
      },
    ],
    stateMutability: "pure",
  },
  {
    type: "function",
    name: "initializer",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "insufficientProceeds",
    inputs: [],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isInitialized",
    inputs: [],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "migrate",
    inputs: [{ name: "recipient", type: "address", internalType: "address" }],
    outputs: [
      { name: "sqrtPriceX96", type: "uint160", internalType: "uint160" },
      { name: "token0", type: "address", internalType: "address" },
      { name: "fees0", type: "uint128", internalType: "uint128" },
      { name: "balance0", type: "uint128", internalType: "uint128" },
      { name: "token1", type: "address", internalType: "address" },
      { name: "fees1", type: "uint128", internalType: "uint128" },
      { name: "balance1", type: "uint128", internalType: "uint128" },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "poolKey",
    inputs: [],
    outputs: [
      { name: "currency0", type: "address", internalType: "Currency" },
      { name: "currency1", type: "address", internalType: "Currency" },
      { name: "fee", type: "uint24", internalType: "uint24" },
      { name: "tickSpacing", type: "int24", internalType: "int24" },
      { name: "hooks", type: "address", internalType: "contract IHooks" },
    ],
    stateMutability: "view",
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
    name: "positions",
    inputs: [{ name: "salt", type: "bytes32", internalType: "bytes32" }],
    outputs: [
      { name: "tickLower", type: "int24", internalType: "int24" },
      { name: "tickUpper", type: "int24", internalType: "int24" },
      { name: "liquidity", type: "uint128", internalType: "uint128" },
      { name: "salt", type: "uint8", internalType: "uint8" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "state",
    inputs: [],
    outputs: [
      { name: "lastEpoch", type: "uint40", internalType: "uint40" },
      { name: "tickAccumulator", type: "int256", internalType: "int256" },
      { name: "totalTokensSold", type: "uint256", internalType: "uint256" },
      { name: "totalProceeds", type: "uint256", internalType: "uint256" },
      {
        name: "totalTokensSoldLastEpoch",
        type: "uint256",
        internalType: "uint256",
      },
      { name: "feesAccrued", type: "int256", internalType: "BalanceDelta" },
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
    type: "event",
    name: "EarlyExit",
    inputs: [
      {
        name: "epoch",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  { type: "event", name: "InsufficientProceeds", inputs: [], anonymous: false },
  {
    type: "event",
    name: "Rebalance",
    inputs: [
      {
        name: "currentTick",
        type: "int24",
        indexed: false,
        internalType: "int24",
      },
      {
        name: "tickLower",
        type: "int24",
        indexed: false,
        internalType: "int24",
      },
      {
        name: "tickUpper",
        type: "int24",
        indexed: false,
        internalType: "int24",
      },
      {
        name: "epoch",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Swap",
    inputs: [
      {
        name: "currentTick",
        type: "int24",
        indexed: false,
        internalType: "int24",
      },
      {
        name: "totalProceeds",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
      {
        name: "totalTokensSold",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  { type: "error", name: "AlreadyInitialized", inputs: [] },
  { type: "error", name: "CannotAddLiquidity", inputs: [] },
  { type: "error", name: "CannotDonate", inputs: [] },
  { type: "error", name: "CannotMigrate", inputs: [] },
  { type: "error", name: "CannotSwapBeforeStartTime", inputs: [] },
  { type: "error", name: "HookNotImplemented", inputs: [] },
  { type: "error", name: "InvalidEpochLength", inputs: [] },
  { type: "error", name: "InvalidGamma", inputs: [] },
  { type: "error", name: "InvalidNumPDSlugs", inputs: [] },
  { type: "error", name: "InvalidPool", inputs: [] },
  { type: "error", name: "InvalidProceedLimits", inputs: [] },
  { type: "error", name: "InvalidStartTime", inputs: [] },
  {
    type: "error",
    name: "InvalidSwapAfterMaturityInsufficientProceeds",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidSwapAfterMaturitySufficientProceeds",
    inputs: [],
  },
  { type: "error", name: "InvalidTickRange", inputs: [] },
  { type: "error", name: "InvalidTickSpacing", inputs: [] },
  { type: "error", name: "InvalidTimeRange", inputs: [] },
  { type: "error", name: "LockFailure", inputs: [] },
  { type: "error", name: "MaximumProceedsReached", inputs: [] },
  { type: "error", name: "NotPoolManager", inputs: [] },
  { type: "error", name: "NotSelf", inputs: [] },
  { type: "error", name: "SenderNotInitializer", inputs: [] },
  { type: "error", name: "SenderNotPoolManager", inputs: [] },
  { type: "error", name: "SwapBelowRange", inputs: [] },
] as const;
