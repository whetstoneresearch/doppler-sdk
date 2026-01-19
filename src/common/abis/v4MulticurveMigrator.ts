export const v4MulticurveMigratorAbi = [
  {
    type: 'function',
    name: 'getAssetData',
    inputs: [
      { name: 'token0', type: 'address', internalType: 'address' },
      { name: 'token1', type: 'address', internalType: 'address' },
    ],
    outputs: [
      { name: 'isToken0', type: 'bool', internalType: 'bool' },
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
      { name: 'lockDuration', type: 'uint32', internalType: 'uint32' },
      {
        name: 'curves',
        type: 'tuple[]',
        internalType: 'struct Curve[]',
        components: [
          { name: 'tickLower', type: 'int24', internalType: 'int24' },
          { name: 'tickUpper', type: 'int24', internalType: 'int24' },
          { name: 'numPositions', type: 'uint16', internalType: 'uint16' },
          { name: 'shares', type: 'uint256', internalType: 'uint256' },
        ],
      },
      {
        name: 'beneficiaries',
        type: 'tuple[]',
        internalType: 'struct BeneficiaryData[]',
        components: [
          { name: 'beneficiary', type: 'address', internalType: 'address' },
          { name: 'shares', type: 'uint96', internalType: 'uint96' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'locker',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract StreamableFeesLockerV2',
      },
    ],
    stateMutability: 'view',
  },
  { type: 'error', name: 'PoolNotInitialized', inputs: [] },
] as const;
