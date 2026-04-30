import { beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeFunctionData, parseEther, type Address } from 'viem';
import { TopUpDistributor } from '../../../../src/evm/entities/TopUpDistributor';
import { topUpDistributorAbi } from '../../../../src/evm/abis';
import { ZERO_ADDRESS } from '../../../../src/evm/constants';
import {
  createMockPublicClient,
  createMockWalletClient,
} from '../../setup/fixtures/clients';
import { mockAddresses, mockTokenAddress } from '../../setup/fixtures/addresses';

describe('TopUpDistributor', () => {
  const asset = mockTokenAddress;
  const amount = parseEther('1.5');
  const txHash = `0x${'ab'.repeat(32)}` as `0x${string}`;
  const explicitAccount =
    '0x3333333333333333333333333333333333333333' as Address;

  let publicClient: { simulateContract: ReturnType<typeof vi.fn> };
  let walletClient: ReturnType<typeof createMockWalletClient>;
  let topUpDistributor: TopUpDistributor;

  beforeEach(() => {
    publicClient = createMockPublicClient() as {
      simulateContract: ReturnType<typeof vi.fn>;
    };
    walletClient = createMockWalletClient();
    topUpDistributor = new TopUpDistributor(
      publicClient,
      walletClient,
      mockAddresses.topUpDistributor!,
    );
  });

  it('returns the configured distributor address', () => {
    expect(topUpDistributor.getAddress()).toBe(mockAddresses.topUpDistributor);
  });

  it('builds native ETH top-up transactions with value and encoded calldata', () => {
    const tx = topUpDistributor.buildTopUpTransaction({
      asset,
      numeraire: ZERO_ADDRESS,
      amount,
    });

    expect(tx).toEqual({
      to: mockAddresses.topUpDistributor,
      data: encodeFunctionData({
        abi: topUpDistributorAbi,
        functionName: 'topUp',
        args: [asset, ZERO_ADDRESS, amount],
      }),
      value: amount,
    });
  });

  it('builds ERC20 top-up transactions without native value', () => {
    const tx = topUpDistributor.buildTopUpTransaction({
      asset,
      numeraire: mockAddresses.weth,
      amount,
    });

    expect(tx).toEqual({
      to: mockAddresses.topUpDistributor,
      data: encodeFunctionData({
        abi: topUpDistributorAbi,
        functionName: 'topUp',
        args: [asset, mockAddresses.weth, amount],
      }),
    });
    expect('value' in tx).toBe(false);
  });

  it('simulates native ETH top-ups with account and value', async () => {
    const request = {
      address: mockAddresses.topUpDistributor,
      functionName: 'topUp',
      args: [asset, ZERO_ADDRESS, amount],
      value: amount,
    };
    publicClient.simulateContract.mockResolvedValueOnce({ request });

    const simulation = await topUpDistributor.simulateTopUp(
      { asset, numeraire: ZERO_ADDRESS, amount },
      explicitAccount,
    );

    expect(simulation).toEqual({ request });
    expect(publicClient.simulateContract).toHaveBeenCalledWith({
      address: mockAddresses.topUpDistributor,
      abi: topUpDistributorAbi,
      functionName: 'topUp',
      args: [asset, ZERO_ADDRESS, amount],
      account: explicitAccount,
      value: amount,
    });
  });

  it('simulates ERC20 top-ups with wallet account and no native value', async () => {
    const request = {
      address: mockAddresses.topUpDistributor,
      functionName: 'topUp',
      args: [asset, mockAddresses.weth, amount],
    };
    publicClient.simulateContract.mockResolvedValueOnce({ request });

    await topUpDistributor.simulateTopUp({
      asset,
      numeraire: mockAddresses.weth,
      amount,
    });

    expect(publicClient.simulateContract).toHaveBeenCalledWith({
      address: mockAddresses.topUpDistributor,
      abi: topUpDistributorAbi,
      functionName: 'topUp',
      args: [asset, mockAddresses.weth, amount],
      account: walletClient.account,
    });
  });

  it('writes the simulated request and respects a gas override', async () => {
    const request = {
      address: mockAddresses.topUpDistributor,
      abi: topUpDistributorAbi,
      functionName: 'topUp',
      args: [asset, mockAddresses.weth, amount],
      account: walletClient.account,
    };
    const writeContract = walletClient.writeContract as ReturnType<typeof vi.fn>;
    publicClient.simulateContract.mockResolvedValueOnce({ request });
    writeContract.mockResolvedValueOnce(txHash);

    const result = await topUpDistributor.topUp(
      { asset, numeraire: mockAddresses.weth, amount },
      { gas: 123456n },
    );

    expect(result).toBe(txHash);
    expect(walletClient.writeContract).toHaveBeenCalledWith({
      ...request,
      gas: 123456n,
    });
  });

  it('throws when writing without a wallet client', async () => {
    const readOnlyTopUpDistributor = new TopUpDistributor(
      publicClient,
      undefined,
      mockAddresses.topUpDistributor!,
    );

    await expect(
      readOnlyTopUpDistributor.topUp({
        asset,
        numeraire: mockAddresses.weth,
        amount,
      }),
    ).rejects.toThrow('Wallet client required for write operations');
  });
});
