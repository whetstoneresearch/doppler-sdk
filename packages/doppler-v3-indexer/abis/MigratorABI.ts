export const MigratorABI = [
  {
    type: "constructor",
    inputs: [
      { name: "airlock_", type: "address", internalType: "address" },
      {
        name: "factory_",
        type: "address",
        internalType: "contract IUniswapV2Factory",
      },
      {
        name: "router",
        type: "address",
        internalType: "contract IUniswapV2Router02",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "airlock",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "factory",
    inputs: [],
    outputs: [
      { name: "", type: "address", internalType: "contract IUniswapV2Factory" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getAsset",
    inputs: [{ name: "pool", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getPool",
    inputs: [
      { name: "token0", type: "address", internalType: "address" },
      { name: "token1", type: "address", internalType: "address" },
    ],
    outputs: [{ name: "pool", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "initialize",
    inputs: [
      { name: "asset", type: "address", internalType: "address" },
      { name: "numeraire", type: "address", internalType: "address" },
      { name: "", type: "bytes", internalType: "bytes" },
    ],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "locker",
    inputs: [],
    outputs: [
      { name: "", type: "address", internalType: "contract UniswapV2Locker" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "migrate",
    inputs: [
      { name: "sqrtPriceX96", type: "uint160", internalType: "uint160" },
      { name: "token0", type: "address", internalType: "address" },
      { name: "token1", type: "address", internalType: "address" },
      { name: "recipient", type: "address", internalType: "address" },
    ],
    outputs: [{ name: "liquidity", type: "uint256", internalType: "uint256" }],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "weth",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "contract WETH" }],
    stateMutability: "view",
  },
  { type: "error", name: "SenderNotAirlock", inputs: [] },
] as const;
