export const feesManagerAbi = [
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
  {
    type: 'function',
    name: 'getPoolKey',
    inputs: [{ name: 'poolId', type: 'bytes32', internalType: 'PoolId' }],
    outputs: [
      {
        name: 'currency0',
        type: 'address',
        internalType: 'Currency',
      },
      { name: 'currency1', type: 'address', internalType: 'Currency' },
      { name: 'fee', type: 'uint24', internalType: 'uint24' },
      { name: 'tickSpacing', type: 'int24', internalType: 'int24' },
      { name: 'hooks', type: 'address', internalType: 'contract IHooks' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'updateBeneficiary',
    inputs: [
      { name: 'poolId', type: 'bytes32', internalType: 'PoolId' },
      { name: 'newBeneficiary', type: 'address', internalType: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'Collect',
    inputs: [
      {
        name: 'poolId',
        type: 'bytes32',
        indexed: true,
        internalType: 'PoolId',
      },
      {
        name: 'fees0',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'fees1',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Release',
    inputs: [
      {
        name: 'poolId',
        type: 'bytes32',
        indexed: true,
        internalType: 'PoolId',
      },
      {
        name: 'beneficiary',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'fees0',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'fees1',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'UpdateBeneficiary',
    inputs: [
      {
        name: 'poolId',
        type: 'bytes32',
        indexed: false,
        internalType: 'PoolId',
      },
      {
        name: 'oldBeneficiary',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
      {
        name: 'newBeneficiary',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  { type: 'error', name: 'CallerNotBeneficiary', inputs: [] },
  { type: 'error', name: 'InvalidNewBeneficiary', inputs: [] },
] as const;

/** @deprecated Use feesManagerAbi instead. */
export const feeClaimsInitializerAbi = feesManagerAbi;
