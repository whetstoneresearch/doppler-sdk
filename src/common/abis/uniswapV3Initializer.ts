export const uniswapV3InitializerAbi = [
  {
    type: 'function',
    name: 'encodePoolInitializerData',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'numTokensToSell', type: 'uint256' },
          { name: 'startTick', type: 'int24' },
          { name: 'endTick', type: 'int24' },
          { name: 'fee', type: 'uint24' },
        ],
      },
    ],
    outputs: [{ name: '', type: 'bytes' }],
    stateMutability: 'pure',
  },
] as const;
