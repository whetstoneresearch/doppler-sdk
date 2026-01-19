export const v4MigratorAbi = [
  {
    type: 'function',
    name: 'encodeLiquidityMigratorData',
    inputs: [
      { name: 'fee', type: 'uint24' },
      { name: 'tickSpacing', type: 'int24' },
      { name: 'lockDuration', type: 'uint256' },
      { name: 'beneficiaries', type: 'address[]' },
      { name: 'percentages', type: 'uint256[]' },
    ],
    outputs: [{ name: '', type: 'bytes' }],
    stateMutability: 'pure',
  },
  { type: 'error', name: 'TickOutOfRange', inputs: [] },
  { type: 'error', name: 'ZeroLiquidity', inputs: [] },
] as const;
