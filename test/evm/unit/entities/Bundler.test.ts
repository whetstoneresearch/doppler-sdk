import { describe, expect, it, vi } from 'vitest';
import type { Address } from 'viem';
import { CHAIN_IDS, getAddresses } from '../../../../src/evm/addresses';
import { DopplerSDK } from '../../../../src/evm/DopplerSDK';
import { Bundler } from '../../../../src/evm/entities/Bundler';
import {
  createMockPublicClient,
  createMockWalletClient,
} from '../../setup/fixtures/clients';

const bundlerAddress = '0x1000000000000000000000000000000000000001' as Address;
const asset = '0x2000000000000000000000000000000000000002' as Address;
const recipient = '0x3000000000000000000000000000000000000003' as Address;
const caller = '0x4000000000000000000000000000000000000004' as Address;

describe('Bundler', () => {
  it('decodes vestingOf in getter declaration order and reads claimable', async () => {
    const publicClient = createMockPublicClient();
    vi.mocked(publicClient.readContract)
      .mockResolvedValueOnce([recipient, true, 100n, 20n, 200n, 1_000n, 250n])
      .mockResolvedValueOnce(375n);
    const bundler = new Bundler(publicClient, undefined, bundlerAddress);

    expect(bundler.getAddress()).toBe(bundlerAddress);
    await expect(bundler.getVesting(asset)).resolves.toEqual({
      recipient,
      permissionlessClaim: true,
      start: 100n,
      cliffDuration: 20n,
      vestingDuration: 200n,
      totalAmount: 1_000n,
      claimedAmount: 250n,
    });
    await expect(bundler.getClaimable(asset)).resolves.toBe(375n);
  });

  it('simulates from a read-only client with an explicit caller', async () => {
    const publicClient = createMockPublicClient();
    vi.mocked(publicClient.simulateContract).mockResolvedValue({
      request: { address: bundlerAddress },
      result: 125n,
    });
    const bundler = new Bundler(publicClient, undefined, bundlerAddress);

    await expect(bundler.simulateClaim(asset, caller)).resolves.toMatchObject({
      amount: 125n,
    });
    expect(
      vi.mocked(publicClient.simulateContract).mock.calls[0][0],
    ).toMatchObject({
      functionName: 'claim',
      args: [asset],
      account: caller,
    });
    await expect(bundler.simulateClaim(asset)).rejects.toThrow(
      'account is required',
    );
  });

  it('uses the wallet account unless an explicit simulation caller is given', async () => {
    const publicClient = createMockPublicClient();
    const wallet = createMockWalletClient();
    vi.mocked(publicClient.simulateContract).mockResolvedValue({
      request: { address: bundlerAddress },
      result: 25n,
    });
    const bundler = new Bundler(publicClient, wallet, bundlerAddress);

    await bundler.simulateClaim(asset);
    await bundler.simulateClaim(asset, caller);

    expect(
      vi
        .mocked(publicClient.simulateContract)
        .mock.calls.map(([call]) => call.account),
    ).toEqual([wallet.account, caller]);
  });

  it('submits claims to the stored recipient contract flow with gas override', async () => {
    const publicClient = createMockPublicClient();
    const wallet = createMockWalletClient();
    vi.mocked(publicClient.simulateContract).mockResolvedValue({
      request: { address: bundlerAddress, functionName: 'claim' },
      result: 50n,
    });
    vi.mocked(wallet.writeContract).mockResolvedValue(`0x${'12'.repeat(32)}`);
    const bundler = new Bundler(publicClient, wallet, bundlerAddress);

    await bundler.claim(asset, { gas: 80_000n });
    expect(vi.mocked(wallet.writeContract).mock.calls[0][0]).toMatchObject({
      functionName: 'claim',
      gas: 80_000n,
    });
    expect(
      vi.mocked(publicClient.simulateContract).mock.calls[0][0].account,
    ).toBe(wallet.account);
  });

  it('requires a wallet for submission', async () => {
    const bundler = new Bundler(
      createMockPublicClient(),
      undefined,
      bundlerAddress,
    );
    await expect(bundler.claim(asset)).rejects.toThrow(
      'Wallet client required',
    );
  });
});

describe('DopplerSDK Bundler getter', () => {
  it('uses the configured chain address and accepts an explicit override', () => {
    const sdk = new DopplerSDK({
      chainId: CHAIN_IDS.MAINNET,
      publicClient: createMockPublicClient(),
    });
    expect(sdk.bundler.getAddress()).toBe(
      getAddresses(CHAIN_IDS.MAINNET).bundler,
    );
    expect(sdk.getBundler(bundlerAddress).getAddress()).toBe(bundlerAddress);
  });

  it('fails clearly when the chain has no configured Bundler', () => {
    const sdk = new DopplerSDK({
      chainId: CHAIN_IDS.INK,
      publicClient: createMockPublicClient(),
    });
    expect(() => sdk.bundler).toThrow('Bundler address is not configured');
  });
});
