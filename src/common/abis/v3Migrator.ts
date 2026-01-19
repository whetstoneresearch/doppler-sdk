export const v3MigratorAbi = [
  {
    type: 'function',
    name: 'encodeLiquidityMigratorData',
    inputs: [
      { name: 'fee', type: 'uint24' },
      { name: 'tickSpacing', type: 'int24' },
    ],
    outputs: [{ name: '', type: 'bytes' }],
    stateMutability: 'pure',
  },
] as const;
