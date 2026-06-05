export const feeClaimsInitializerAbi = [
  {
    type: 'function',
    name: 'getCumulatedFees0',
    inputs: [{ name: 'poolId', type: 'bytes32', internalType: 'PoolId' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getCumulatedFees1',
    inputs: [{ name: 'poolId', type: 'bytes32', internalType: 'PoolId' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getLastCumulatedFees0',
    inputs: [
      { name: 'poolId', type: 'bytes32', internalType: 'PoolId' },
      { name: 'user', type: 'address', internalType: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getLastCumulatedFees1',
    inputs: [
      { name: 'poolId', type: 'bytes32', internalType: 'PoolId' },
      { name: 'user', type: 'address', internalType: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getShares',
    inputs: [
      { name: 'poolId', type: 'bytes32', internalType: 'PoolId' },
      { name: 'user', type: 'address', internalType: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'collectFees',
    inputs: [{ name: 'poolId', type: 'bytes32', internalType: 'PoolId' }],
    outputs: [
      { name: 'fees0', type: 'uint128', internalType: 'uint128' },
      { name: 'fees1', type: 'uint128', internalType: 'uint128' },
    ],
    stateMutability: 'nonpayable',
  },
] as const;
