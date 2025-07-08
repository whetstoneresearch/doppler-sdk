export const V4MigratorABI = [
  {
    type: "function",
    name: "getAssetData",
    inputs: [
      { name: "token0", type: "address", internalType: "address" },
      { name: "token1", type: "address", internalType: "address" }
    ],
    outputs: [
      {
        name: "data",
        type: "tuple",
        internalType: "struct AssetData",
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
              { name: "hooks", type: "address", internalType: "IHooks" }
            ]
          },
          { name: "lockDuration", type: "uint32", internalType: "uint32" },
          {
            name: "beneficiaries",
            type: "tuple[]",
            internalType: "struct BeneficiaryData[]",
            components: [
              { name: "beneficiary", type: "address", internalType: "address" },
              { name: "shares", type: "uint256", internalType: "uint256" }
            ]
          }
        ]
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "initialize",
    inputs: [
      { name: "asset", type: "address", internalType: "address" },
      { name: "numeraire", type: "address", internalType: "address" },
      { name: "liquidityMigratorData", type: "bytes", internalType: "bytes" }
    ],
    outputs: [
      { name: "", type: "address", internalType: "address" }
    ],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "migrate",
    inputs: [
      { name: "sqrtPriceX96", type: "uint160", internalType: "uint160" },
      { name: "token0", type: "address", internalType: "address" },
      { name: "token1", type: "address", internalType: "address" },
      { name: "recipient", type: "address", internalType: "address" }
    ],
    outputs: [
      { name: "liquidity", type: "uint256", internalType: "uint256" }
    ],
    stateMutability: "payable"
  }
] as const;