import type { Address, PublicClient, WalletClient } from 'viem';
import { dopplerDN404Abi } from '../../../abis';
import type { SupportedPublicClient } from '../../../types';

export class DopplerDN404 {
  private readonly publicClient: SupportedPublicClient;
  private readonly walletClient?: WalletClient;
  private readonly address: Address;

  private get rpc(): PublicClient {
    return this.publicClient as PublicClient;
  }

  constructor(
    publicClient: SupportedPublicClient,
    walletClient: WalletClient | undefined,
    address: Address,
  ) {
    this.publicClient = publicClient;
    this.walletClient = walletClient;
    this.address = address;
  }

  getAddress(): Address {
    return this.address;
  }

  async getName(): Promise<string> {
    return await this.rpc.readContract({
      address: this.address,
      abi: dopplerDN404Abi,
      functionName: 'name',
    });
  }

  async getSymbol(): Promise<string> {
    return await this.rpc.readContract({
      address: this.address,
      abi: dopplerDN404Abi,
      functionName: 'symbol',
    });
  }

  async getDecimals(): Promise<number> {
    return await this.rpc.readContract({
      address: this.address,
      abi: dopplerDN404Abi,
      functionName: 'decimals',
    });
  }

  async getTotalSupply(): Promise<bigint> {
    return await this.rpc.readContract({
      address: this.address,
      abi: dopplerDN404Abi,
      functionName: 'totalSupply',
    });
  }

  async getBalanceOf(owner: Address): Promise<bigint> {
    return await this.rpc.readContract({
      address: this.address,
      abi: dopplerDN404Abi,
      functionName: 'balanceOf',
      args: [owner],
    });
  }

  async getAllowance(owner: Address, spender: Address): Promise<bigint> {
    return await this.rpc.readContract({
      address: this.address,
      abi: dopplerDN404Abi,
      functionName: 'allowance',
      args: [owner, spender],
    });
  }

  async getUnit(): Promise<bigint> {
    return await this.rpc.readContract({
      address: this.address,
      abi: dopplerDN404Abi,
      functionName: 'unit',
    });
  }

  async getBaseURI(): Promise<string> {
    return await this.rpc.readContract({
      address: this.address,
      abi: dopplerDN404Abi,
      functionName: 'baseURI',
    });
  }

  async getMirrorERC721(): Promise<Address> {
    return await this.rpc.readContract({
      address: this.address,
      abi: dopplerDN404Abi,
      functionName: 'mirrorERC721',
    });
  }

  async getTotalNFTSupply(): Promise<bigint> {
    return await this.rpc.readContract({
      address: this.address,
      abi: dopplerDN404Abi,
      functionName: 'totalNFTSupply',
    });
  }

  async getSkipNFT(owner: Address): Promise<boolean> {
    return await this.rpc.readContract({
      address: this.address,
      abi: dopplerDN404Abi,
      functionName: 'getSkipNFT',
      args: [owner],
    });
  }

  async getPool(): Promise<Address> {
    return await this.rpc.readContract({
      address: this.address,
      abi: dopplerDN404Abi,
      functionName: 'pool',
    });
  }

  async getIsPoolUnlocked(): Promise<boolean> {
    return await this.rpc.readContract({
      address: this.address,
      abi: dopplerDN404Abi,
      functionName: 'isPoolUnlocked',
    });
  }

  async approve(
    spender: Address,
    amount: bigint,
    options?: { gas?: bigint },
  ): Promise<`0x${string}`> {
    const walletClient = this.getWalletClient();
    const { request } = await this.rpc.simulateContract({
      address: this.address,
      abi: dopplerDN404Abi,
      functionName: 'approve',
      args: [spender, amount],
      account: walletClient.account,
    });
    return await walletClient.writeContract(
      options?.gas ? { ...request, gas: options.gas } : request,
    );
  }

  async transfer(
    to: Address,
    amount: bigint,
    options?: { gas?: bigint },
  ): Promise<`0x${string}`> {
    const walletClient = this.getWalletClient();
    const { request } = await this.rpc.simulateContract({
      address: this.address,
      abi: dopplerDN404Abi,
      functionName: 'transfer',
      args: [to, amount],
      account: walletClient.account,
    });
    return await walletClient.writeContract(
      options?.gas ? { ...request, gas: options.gas } : request,
    );
  }

  async setSkipNFT(
    skipNFT: boolean,
    options?: { gas?: bigint },
  ): Promise<`0x${string}`> {
    const walletClient = this.getWalletClient();
    const { request } = await this.rpc.simulateContract({
      address: this.address,
      abi: dopplerDN404Abi,
      functionName: 'setSkipNFT',
      args: [skipNFT],
      account: walletClient.account,
    });
    return await walletClient.writeContract(
      options?.gas ? { ...request, gas: options.gas } : request,
    );
  }

  private getWalletClient(): WalletClient {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }
    return this.walletClient;
  }
}
