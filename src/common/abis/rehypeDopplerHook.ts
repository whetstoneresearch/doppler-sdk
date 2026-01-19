export const rehypeDopplerHookAbi = [
  {
    type: 'function',
    name: 'INITIALIZER',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'collectFees',
    inputs: [{ name: 'asset', type: 'address', internalType: 'address' }],
    outputs: [{ name: 'fees', type: 'int256', internalType: 'BalanceDelta' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getFeeDistributionInfo',
    inputs: [{ name: 'poolId', type: 'bytes32', internalType: 'PoolId' }],
    outputs: [
      {
        name: 'assetBuybackPercentWad',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'numeraireBuybackPercentWad',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'beneficiaryPercentWad',
        type: 'uint256',
        internalType: 'uint256',
      },
      { name: 'lpPercentWad', type: 'uint256', internalType: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getHookFees',
    inputs: [{ name: 'poolId', type: 'bytes32', internalType: 'PoolId' }],
    outputs: [
      { name: 'fees0', type: 'uint128', internalType: 'uint128' },
      { name: 'fees1', type: 'uint128', internalType: 'uint128' },
      { name: 'beneficiaryFees0', type: 'uint128', internalType: 'uint128' },
      { name: 'beneficiaryFees1', type: 'uint128', internalType: 'uint128' },
      { name: 'customFee', type: 'uint24', internalType: 'uint24' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPoolInfo',
    inputs: [{ name: 'poolId', type: 'bytes32', internalType: 'PoolId' }],
    outputs: [
      { name: 'asset', type: 'address', internalType: 'address' },
      { name: 'numeraire', type: 'address', internalType: 'address' },
      { name: 'buybackDst', type: 'address', internalType: 'address' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPosition',
    inputs: [{ name: 'poolId', type: 'bytes32', internalType: 'PoolId' }],
    outputs: [
      { name: 'tickLower', type: 'int24', internalType: 'int24' },
      { name: 'tickUpper', type: 'int24', internalType: 'int24' },
      { name: 'liquidity', type: 'uint128', internalType: 'uint128' },
      { name: 'salt', type: 'bytes32', internalType: 'bytes32' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'poolManager',
    inputs: [],
    outputs: [
      { name: '', type: 'address', internalType: 'contract IPoolManager' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'quoter',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'contract Quoter' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'setFeeDistribution',
    inputs: [
      { name: 'poolId', type: 'bytes32', internalType: 'PoolId' },
      {
        name: 'assetBuybackPercentWad',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'numeraireBuybackPercentWad',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'beneficiaryPercentWad',
        type: 'uint256',
        internalType: 'uint256',
      },
      { name: 'lpPercentWad', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  { type: 'error', name: 'FeeDistributionMustAddUpToWAD', inputs: [] },
  { type: 'error', name: 'SenderNotInitializer', inputs: [] },
] as const;
