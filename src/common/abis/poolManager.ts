export const poolManagerAbi = [
  {
    type: 'function',
    name: 'swap',
    inputs: [
      {
        name: 'key',
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
      {
        name: 'params',
        type: 'tuple',
        internalType: 'struct IPoolManager.SwapParams',
        components: [
          { name: 'zeroForOne', type: 'bool', internalType: 'bool' },
          { name: 'amountSpecified', type: 'int256', internalType: 'int256' },
          {
            name: 'sqrtPriceLimitX96',
            type: 'uint160',
            internalType: 'uint160',
          },
        ],
      },
      { name: 'hookData', type: 'bytes', internalType: 'bytes' },
    ],
    outputs: [
      { name: 'swapDelta', type: 'int256', internalType: 'BalanceDelta' },
    ],
    stateMutability: 'nonpayable',
  },
] as const;
