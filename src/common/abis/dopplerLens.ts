export const dopplerLensAbi = [
  {
    type: 'function',
    name: 'quoteDopplerLensData',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        internalType: 'struct IV4Quoter.QuoteExactSingleParams',
        components: [
          {
            name: 'poolKey',
            type: 'tuple',
            internalType: 'struct PoolKey',
            components: [
              { name: 'currency0', type: 'address', internalType: 'Currency' },
              { name: 'currency1', type: 'address', internalType: 'Currency' },
              { name: 'fee', type: 'uint24', internalType: 'uint24' },
              { name: 'tickSpacing', type: 'int24', internalType: 'int24' },
              {
                name: 'hooks',
                type: 'address',
                internalType: 'contract IHooks',
              },
            ],
          },
          { name: 'zeroForOne', type: 'bool', internalType: 'bool' },
          { name: 'exactAmount', type: 'uint128', internalType: 'uint128' },
          { name: 'hookData', type: 'bytes', internalType: 'bytes' },
        ],
      },
    ],
    outputs: [
      {
        name: 'returnData',
        type: 'tuple',
        internalType: 'struct DopplerLensReturnData',
        components: [
          { name: 'sqrtPriceX96', type: 'uint160', internalType: 'uint160' },
          { name: 'amount0', type: 'uint256', internalType: 'uint256' },
          { name: 'amount1', type: 'uint256', internalType: 'uint256' },
          { name: 'tick', type: 'int24', internalType: 'int24' },
        ],
      },
    ],
    stateMutability: 'nonpayable',
  },
] as const;
