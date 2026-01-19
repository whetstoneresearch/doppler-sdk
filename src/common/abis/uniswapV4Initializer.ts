export const uniswapV4InitializerAbi = [
  {
    type: 'function',
    name: 'encodePoolInitializerData',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'minimumProceeds', type: 'uint256' },
          { name: 'maximumProceeds', type: 'uint256' },
          { name: 'startingTime', type: 'uint256' },
          { name: 'endingTime', type: 'uint256' },
          { name: 'startingTick', type: 'int24' },
          { name: 'endingTick', type: 'int24' },
          { name: 'epochLength', type: 'uint256' },
          { name: 'gamma', type: 'int24' },
          { name: 'isToken0', type: 'bool' },
          { name: 'numPDSlugs', type: 'uint256' },
          { name: 'fee', type: 'uint24' },
          { name: 'tickSpacing', type: 'int24' },
        ],
      },
    ],
    outputs: [{ name: '', type: 'bytes' }],
    stateMutability: 'pure',
  },
] as const;
