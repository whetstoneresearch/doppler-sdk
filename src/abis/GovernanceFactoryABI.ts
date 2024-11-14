export const GovernanceFactoryABI = [
  { type: 'constructor', inputs: [], stateMutability: 'nonpayable' },
  {
    type: 'function',
    name: 'create',
    inputs: [
      { name: 'name', type: 'string', internalType: 'string' },
      { name: 'token', type: 'address', internalType: 'address' },
      { name: '', type: 'bytes', internalType: 'bytes' },
    ],
    outputs: [
      { name: '', type: 'address', internalType: 'address' },
      { name: '', type: 'address', internalType: 'address' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'timelockFactory',
    inputs: [],
    outputs: [
      { name: '', type: 'address', internalType: 'contract TimelockFactory' },
    ],
    stateMutability: 'view',
  },
] as const;
