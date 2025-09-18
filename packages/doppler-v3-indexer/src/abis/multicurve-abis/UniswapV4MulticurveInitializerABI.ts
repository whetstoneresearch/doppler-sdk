export const UniswapV4MulticurveInitializerABI = [
  {
    type: "constructor",
    inputs: [
      { name: "airlock_", type: "address", internalType: "address" },
      {
        name: "poolManager_",
        type: "address",
        internalType: "contract IPoolManager",
      },
      { name: "hook_", type: "address", internalType: "contract IHooks" },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "airlock",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "contract Airlock" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "collectFees",
    inputs: [{ name: "poolId", type: "bytes32", internalType: "PoolId" }],
    outputs: [
      { name: "fees0", type: "uint128", internalType: "uint128" },
      { name: "fees1", type: "uint128", internalType: "uint128" },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "exitLiquidity",
    inputs: [{ name: "asset", type: "address", internalType: "address" }],
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
    name: "getBeneficiaries",
    inputs: [{ name: "asset", type: "address", internalType: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        internalType: "struct BeneficiaryData[]",
        components: [
          { name: "beneficiary", type: "address", internalType: "address" },
          { name: "shares", type: "uint96", internalType: "uint96" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getCumulatedFees0",
    inputs: [{ name: "poolId", type: "bytes32", internalType: "PoolId" }],
    outputs: [
      { name: "cumulatedFees0", type: "uint256", internalType: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getCumulatedFees1",
    inputs: [{ name: "poolId", type: "bytes32", internalType: "PoolId" }],
    outputs: [
      { name: "cumulatedFees1", type: "uint256", internalType: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getLastCumulatedFees0",
    inputs: [
      { name: "poolId", type: "bytes32", internalType: "PoolId" },
      { name: "beneficiary", type: "address", internalType: "address" },
    ],
    outputs: [
      { name: "lastCumulatedFees0", type: "uint256", internalType: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getLastCumulatedFees1",
    inputs: [
      { name: "poolId", type: "bytes32", internalType: "PoolId" },
      { name: "beneficiary", type: "address", internalType: "address" },
    ],
    outputs: [
      { name: "lastCumulatedFees1", type: "uint256", internalType: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getPoolKey",
    inputs: [{ name: "poolId", type: "bytes32", internalType: "PoolId" }],
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
    name: "getPositions",
    inputs: [{ name: "asset", type: "address", internalType: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        internalType: "struct Position[]",
        components: [
          { name: "tickLower", type: "int24", internalType: "int24" },
          { name: "tickUpper", type: "int24", internalType: "int24" },
          { name: "liquidity", type: "uint128", internalType: "uint128" },
          { name: "salt", type: "bytes32", internalType: "bytes32" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getShares",
    inputs: [
      { name: "poolId", type: "bytes32", internalType: "PoolId" },
      { name: "beneficiary", type: "address", internalType: "address" },
    ],
    outputs: [{ name: "shares", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getState",
    inputs: [{ name: "asset", type: "address", internalType: "address" }],
    outputs: [
      { name: "numeraire", type: "address", internalType: "address" },
      { name: "status", type: "uint8", internalType: "enum PoolStatus" },
      {
        name: "poolKey",
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
      { name: "farTick", type: "int24", internalType: "int24" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "hook",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "contract IHooks" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "initialize",
    inputs: [
      { name: "asset", type: "address", internalType: "address" },
      { name: "numeraire", type: "address", internalType: "address" },
      {
        name: "totalTokensOnBondingCurve",
        type: "uint256",
        internalType: "uint256",
      },
      { name: "", type: "bytes32", internalType: "bytes32" },
      { name: "data", type: "bytes", internalType: "bytes" },
    ],
    outputs: [{ name: "", type: "address", internalType: "address" }],
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
    name: "unlockCallback",
    inputs: [{ name: "data", type: "bytes", internalType: "bytes" }],
    outputs: [{ name: "", type: "bytes", internalType: "bytes" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "updateBeneficiary",
    inputs: [
      { name: "poolId", type: "bytes32", internalType: "PoolId" },
      { name: "newBeneficiary", type: "address", internalType: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "Collect",
    inputs: [
      {
        name: "poolId",
        type: "bytes32",
        indexed: true,
        internalType: "PoolId",
      },
      {
        name: "beneficiary",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "fees0",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
      {
        name: "fees1",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Create",
    inputs: [
      {
        name: "poolOrHook",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "asset",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "numeraire",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Lock",
    inputs: [
      { name: "pool", type: "address", indexed: true, internalType: "address" },
      {
        name: "beneficiaries",
        type: "tuple[]",
        indexed: false,
        internalType: "struct BeneficiaryData[]",
        components: [
          { name: "beneficiary", type: "address", internalType: "address" },
          { name: "shares", type: "uint96", internalType: "uint96" },
        ],
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "UpdateBeneficiary",
    inputs: [
      {
        name: "poolId",
        type: "bytes32",
        indexed: false,
        internalType: "PoolId",
      },
      {
        name: "oldBeneficiary",
        type: "address",
        indexed: false,
        internalType: "address",
      },
      {
        name: "newBeneficiary",
        type: "address",
        indexed: false,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  { type: "error", name: "CallerNotPoolManager", inputs: [] },
  {
    type: "error",
    name: "CannotMigrateInsufficientTick",
    inputs: [
      { name: "targetTick", type: "int24", internalType: "int24" },
      { name: "currentTick", type: "int24", internalType: "int24" },
    ],
  },
  {
    type: "error",
    name: "InvalidCallbackAction",
    inputs: [{ name: "action", type: "uint8", internalType: "uint8" }],
  },
  { type: "error", name: "InvalidNewBeneficiary", inputs: [] },
  { type: "error", name: "InvalidProtocolOwnerBeneficiary", inputs: [] },
  {
    type: "error",
    name: "InvalidProtocolOwnerShares",
    inputs: [
      { name: "required", type: "uint96", internalType: "uint96" },
      { name: "provided", type: "uint96", internalType: "uint96" },
    ],
  },
  { type: "error", name: "InvalidShares", inputs: [] },
  { type: "error", name: "InvalidTotalShares", inputs: [] },
  { type: "error", name: "InvalidTotalShares", inputs: [] },
  { type: "error", name: "PoolAlreadyExited", inputs: [] },
  { type: "error", name: "PoolAlreadyInitialized", inputs: [] },
  { type: "error", name: "PoolNotLocked", inputs: [] },
  { type: "error", name: "Reentrancy", inputs: [] },
  { type: "error", name: "SenderNotAirlock", inputs: [] },
  {
    type: "error",
    name: "TickNotAligned",
    inputs: [{ name: "tick", type: "int24", internalType: "int24" }],
  },
  {
    type: "error",
    name: "TickRangeMisordered",
    inputs: [
      { name: "tickLower", type: "int24", internalType: "int24" },
      { name: "tickUpper", type: "int24", internalType: "int24" },
    ],
  },
  { type: "error", name: "UnorderedBeneficiaries", inputs: [] },
  { type: "error", name: "ZeroPosition", inputs: [] },
  { type: "error", name: "ZeroShare", inputs: [] },
] as const;
