import { createPublicClient, createWalletClient, http } from 'viem';
import { mainnet } from 'viem/chains';
import { vi } from 'vitest';
import type { Address, WalletClient } from 'viem';
import type { SupportedPublicClient } from '../../../../src/evm/types';
import {
  mockAddresses,
  mockGovernanceAddress,
  mockHookAddress,
  mockPoolAddress,
  mockTimelockAddress,
  mockTokenAddress,
  mockV2PoolAddress,
} from './addresses';

type MockedPublicClient = Omit<
  ReturnType<typeof createPublicClient>,
  | 'call'
  | 'estimateContractGas'
  | 'getBalance'
  | 'getBlock'
  | 'getBlockNumber'
  | 'getBytecode'
  | 'getChainId'
  | 'getTransactionReceipt'
  | 'multicall'
  | 'readContract'
  | 'simulateContract'
  | 'waitForTransactionReceipt'
  | 'watchBlockNumber'
  | 'watchContractEvent'
> & {
  call: ReturnType<typeof vi.fn>;
  estimateContractGas: ReturnType<typeof vi.fn>;
  getBalance: ReturnType<typeof vi.fn>;
  getBlock: ReturnType<typeof vi.fn>;
  getBlockNumber: ReturnType<typeof vi.fn>;
  getBytecode: ReturnType<typeof vi.fn>;
  getChainId: ReturnType<typeof vi.fn>;
  getTransactionReceipt: ReturnType<typeof vi.fn>;
  multicall: ReturnType<typeof vi.fn>;
  readContract: ReturnType<typeof vi.fn>;
  simulateContract: ReturnType<typeof vi.fn>;
  waitForTransactionReceipt: ReturnType<typeof vi.fn>;
  watchBlockNumber: ReturnType<typeof vi.fn>;
  watchContractEvent: ReturnType<typeof vi.fn>;
};

type MockSimulationCall = {
  address?: Address;
  abi?: unknown;
  functionName?: string;
  args?: readonly unknown[];
};

// Mock viem clients for testing
export const createMockPublicClient = (): SupportedPublicClient => {
  const defaultCreateResult: readonly Address[] = [
    mockTokenAddress,
    mockPoolAddress,
    mockGovernanceAddress,
    mockTimelockAddress,
    mockV2PoolAddress,
  ];

  const baseClient = createPublicClient({
    chain: mainnet,
    transport: http(),
  });

  const client: MockedPublicClient = {
    ...baseClient,
    readContract: vi.fn(),
    getTransactionReceipt: vi.fn(),
    waitForTransactionReceipt: vi.fn(),
    getBalance: vi.fn(),
    estimateContractGas: vi.fn(),
    getBytecode: vi.fn().mockResolvedValue('0x6000e2e9faa107087b0600'),
    getBlock: vi.fn().mockResolvedValue({ timestamp: 1_700_000_000n }),
    getChainId: vi.fn().mockResolvedValue(1),
    watchContractEvent: vi.fn().mockReturnValue(() => {}),
    watchBlockNumber: vi.fn().mockReturnValue(() => {}),
    getBlockNumber: vi.fn().mockResolvedValue(1000n),
    call: vi.fn(),
    multicall: vi.fn(),
    simulateContract: vi.fn(async (call?: MockSimulationCall) => {
      const { address, abi, functionName, args } = call ?? {};

      switch (functionName) {
        case 'create':
          return {
            request: { address, abi, functionName, args },
            result: defaultCreateResult,
          };
        case 'simulateBundleExactOut':
          return {
            request: { address, abi, functionName, args },
            result: 0n,
          };
        case 'simulateMulticurveBundleExactOut':
          return {
            request: { address, abi, functionName, args },
            result: [
              mockTokenAddress,
              [mockAddresses.weth, mockTokenAddress, 3000, 60, mockHookAddress],
              0n,
              0n,
            ],
          };
        case 'simulateMulticurveBundleExactIn':
          return {
            request: { address, abi, functionName, args },
            result: [
              mockTokenAddress,
              {
                currency0: mockAddresses.weth,
                currency1: mockTokenAddress,
                fee: 3000n,
                tickSpacing: 60n,
                hooks: mockHookAddress,
              },
              0n,
              0n,
            ],
          };
        case 'bundle':
          return {
            request: { address, abi, functionName, args },
          };
        default:
          return {
            request: { address, abi, functionName, args },
            result: undefined,
          };
      }
    }),
  };

  return client;
};

export const createMockWalletClient = (): WalletClient => {
  const client = createWalletClient({
    chain: mainnet,
    transport: http(),
    account: '0x0000000000000000000000000000000000000001' as `0x${string}`,
  });

  // Mock the writeContract method
  client.writeContract = vi.fn();
  client.account = {
    address: '0x0000000000000000000000000000000000000001' as `0x${string}`,
    type: 'json-rpc',
  };

  return client;
};

// Helper to create a mock transaction receipt
export const createMockTransactionReceipt = (logs: any[] = []) => ({
  transactionHash:
    '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as `0x${string}`,
  blockHash:
    '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as `0x${string}`,
  blockNumber: 12345678n,
  contractAddress: null,
  from: '0x0000000000000000000000000000000000000001' as `0x${string}`,
  gasUsed: 100000n,
  logs,
  status: 'success' as const,
  to: '0x0000000000000000000000000000000000000002' as `0x${string}`,
  transactionIndex: 0,
  cumulativeGasUsed: 100000n,
  effectiveGasPrice: 1000000000n,
  logsBloom: '0x' as `0x${string}`,
  type: 'legacy' as const,
});

import { keccak256, toHex, encodeAbiParameters } from 'viem';

/**
 * Create a properly formatted mock Create event log.
 * This matches the Airlock contract's Create event structure.
 */
export const createMockCreateEventLog = (
  tokenAddress: Address = mockTokenAddress,
  poolOrHookAddress: Address = mockPoolAddress,
  numeraire: Address = mockAddresses.weth,
  initializer: Address = mockAddresses.lockableV3Initializer,
) => {
  // Event: Create(address asset, address indexed numeraire, address initializer, address poolOrHook)
  const eventSignature = keccak256(
    toHex('Create(address,address,address,address)'),
  );

  // Non-indexed parameters are ABI-encoded in data
  const data = encodeAbiParameters(
    [{ type: 'address' }, { type: 'address' }, { type: 'address' }],
    [tokenAddress, initializer, poolOrHookAddress],
  );

  return {
    address: mockAddresses.airlock,
    topics: [
      eventSignature,
      `0x000000000000000000000000${numeraire.slice(2).toLowerCase()}` as `0x${string}`, // indexed numeraire
    ],
    data,
  };
};

/**
 * Create a mock transaction receipt with a Create event included.
 * This is useful for tests that need proper Create event logs.
 */
export const createMockTransactionReceiptWithCreateEvent = (
  tokenAddress: Address = mockTokenAddress,
  poolOrHookAddress: Address = mockPoolAddress,
  numeraire: Address = mockAddresses.weth,
) => {
  return createMockTransactionReceipt([
    createMockCreateEventLog(tokenAddress, poolOrHookAddress, numeraire),
  ]);
};
