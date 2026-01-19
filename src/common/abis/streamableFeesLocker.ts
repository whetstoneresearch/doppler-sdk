export const streamableFeesLockerAbi = [
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
    name: 'streams',
    inputs: [{ name: 'poolId', type: 'bytes32', internalType: 'PoolId' }],
    outputs: [
      {
        name: 'poolKey',
        type: 'tuple',
        internalType: 'struct PoolKey',
        components: [
          { name: 'currency0', type: 'address', internalType: 'Currency' },
          { name: 'currency1', type: 'address', internalType: 'Currency' },
          { name: 'fee', type: 'uint24', internalType: 'uint24' },
          { name: 'tickSpacing', type: 'int24', internalType: 'int24' },
          { name: 'hooks', type: 'address', internalType: 'contract IHooks' },
        ],
      },
      { name: 'recipient', type: 'address', internalType: 'address' },
      { name: 'startDate', type: 'uint32', internalType: 'uint32' },
      { name: 'lockDuration', type: 'uint32', internalType: 'uint32' },
      { name: 'isUnlocked', type: 'bool', internalType: 'bool' },
      {
        name: 'beneficiaries',
        type: 'tuple[]',
        internalType: 'struct BeneficiaryData[]',
        components: [
          { name: 'beneficiary', type: 'address', internalType: 'address' },
          { name: 'shares', type: 'uint96', internalType: 'uint96' },
        ],
      },
      {
        name: 'positions',
        type: 'tuple[]',
        internalType: 'struct Position[]',
        components: [
          { name: 'tickLower', type: 'int24', internalType: 'int24' },
          { name: 'tickUpper', type: 'int24', internalType: 'int24' },
          { name: 'liquidity', type: 'uint128', internalType: 'uint128' },
          { name: 'salt', type: 'bytes32', internalType: 'bytes32' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  { type: 'error', name: 'NonPositionManager', inputs: [] },
  { type: 'error', name: 'NotApprovedMigrator', inputs: [] },
  { type: 'error', name: 'PositionNotFound', inputs: [] },
  { type: 'error', name: 'PositionAlreadyUnlocked', inputs: [] },
  { type: 'error', name: 'InvalidBeneficiary', inputs: [] },
] as const;
