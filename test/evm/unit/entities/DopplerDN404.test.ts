import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseEther, type Address } from 'viem';
import { DopplerSDK } from '../../../../src/evm/DopplerSDK';
import { DopplerDN404 } from '../../../../src/evm/entities/token/doppler404';
import {
  createMockPublicClient,
  createMockWalletClient,
} from '../../setup/fixtures/clients';
import { mockTokenAddress } from '../../setup/fixtures/addresses';

const owner = '0x1234567890123456789012345678901234567890' as Address;
const spender = '0x2345678901234567890123456789012345678901' as Address;
const transactionHash =
  '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as const;

describe('DopplerDN404', () => {
  let publicClient: ReturnType<typeof createMockPublicClient>;
  let walletClient: ReturnType<typeof createMockWalletClient>;
  let token: DopplerDN404;

  beforeEach(() => {
    publicClient = createMockPublicClient();
    walletClient = createMockWalletClient();
    token = new DopplerDN404(publicClient, walletClient, mockTokenAddress);
  });

  it('reads the DN404 unit', async () => {
    vi.mocked(publicClient.readContract).mockResolvedValueOnce(parseEther('1'));

    await expect(token.getUnit()).resolves.toBe(parseEther('1'));
    expect(publicClient.readContract).toHaveBeenCalledWith({
      address: mockTokenAddress,
      abi: expect.any(Array),
      functionName: 'unit',
    });
  });

  it('reads the ERC721 mirror and skip-NFT preference', async () => {
    vi.mocked(publicClient.readContract)
      .mockResolvedValueOnce(spender)
      .mockResolvedValueOnce(true);

    await expect(token.getMirrorERC721()).resolves.toBe(spender);
    await expect(token.getSkipNFT(owner)).resolves.toBe(true);
    expect(publicClient.readContract).toHaveBeenLastCalledWith({
      address: mockTokenAddress,
      abi: expect.any(Array),
      functionName: 'getSkipNFT',
      args: [owner],
    });
  });

  it('simulates and submits ERC20 approvals', async () => {
    vi.mocked(walletClient.writeContract).mockResolvedValueOnce(
      transactionHash,
    );

    await expect(token.approve(spender, parseEther('10'))).resolves.toBe(
      transactionHash,
    );
    expect(publicClient.simulateContract).toHaveBeenCalledWith({
      address: mockTokenAddress,
      abi: expect.any(Array),
      functionName: 'approve',
      args: [spender, parseEther('10')],
      account: walletClient.account,
    });
  });

  it('requires a wallet for writes', async () => {
    token = new DopplerDN404(publicClient, undefined, mockTokenAddress);

    await expect(token.setSkipNFT(false)).rejects.toThrow(
      'Wallet client required for write operations',
    );
  });

  it('is available from the SDK after launch', () => {
    const sdk = new DopplerSDK({
      publicClient,
      walletClient,
      chainId: 1,
    });

    const launchedToken = sdk.getDopplerDN404(mockTokenAddress);

    expect(launchedToken).toBeInstanceOf(DopplerDN404);
    expect(launchedToken.getAddress()).toBe(mockTokenAddress);
  });
});
