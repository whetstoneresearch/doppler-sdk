import { createPublicClient, createWalletClient, http } from 'viem';
import { mainnet } from 'viem/chains';
import { vi } from 'vitest';
import type { Address, WalletClient } from 'viem';
import { SupportedPublicClient } from '../../../src/types';
import {
  mockAddresses,
  mockGovernanceAddress,
  mockHookAddress,
  mockPoolAddress,
  mockTimelockAddress,
  mockTokenAddress,
  mockV2PoolAddress,
} from './addresses';

// Mock viem clients for testing
export const createMockPublicClient = (): SupportedPublicClient => {
  const client = createPublicClient({
    chain: mainnet,
    transport: http(),
  });

  // Mock the readContract method
  client.readContract = vi.fn();
  client.getTransactionReceipt = vi.fn();
  client.waitForTransactionReceipt = vi.fn();
  client.getBalance = vi.fn();
  client.estimateContractGas = vi.fn();
  client.getBytecode = vi.fn().mockResolvedValue('0x6000e2e9faa107087b0600');
  client.getBlock = vi.fn().mockResolvedValue({ timestamp: 1_700_000_000n });
  client.getChainId = vi.fn().mockResolvedValue(1);

  const defaultCreateResult: readonly Address[] = [
    mockTokenAddress,
    mockPoolAddress,
    mockGovernanceAddress,
    mockTimelockAddress,
    mockV2PoolAddress,
  ];

  client.simulateContract = vi.fn(async (call: any) => {
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
  });

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
  initializer: Address = mockAddresses.v3Initializer,
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
