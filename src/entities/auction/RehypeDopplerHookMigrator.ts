import type { Address, Hash, Hex, PublicClient, WalletClient } from 'viem';
import type {
  RehypeFeeDistributionInfo,
  SupportedPublicClient,
} from '../../types';
import { rehypeDopplerHookMigratorAbi } from '../../abis';
import { decodeBalanceDelta } from '../../utils';

export class RehypeDopplerHookMigrator {
  private client: SupportedPublicClient;
  private walletClient?: WalletClient;
  private hookAddress: Address;
  private get rpc(): PublicClient {
    return this.client as PublicClient;
  }

  constructor(
    client: SupportedPublicClient,
    walletClient: WalletClient | undefined,
    hookAddress: Address,
  ) {
    this.client = client;
    this.walletClient = walletClient;
    this.hookAddress = hookAddress;
  }

  getAddress(): Address {
    return this.hookAddress;
  }

  async collectFees(asset: Address): Promise<{
    amount0: bigint;
    amount1: bigint;
    transactionHash: Hash;
  }> {
    if (!this.walletClient) {
      throw new Error('Wallet client required to collect rehype fees');
    }

    const { request, result } = await this.rpc.simulateContract({
      address: this.hookAddress,
      abi: rehypeDopplerHookMigratorAbi,
      functionName: 'collectFees',
      args: [asset],
      account: this.walletClient.account,
    });

    const hash = await this.walletClient.writeContract(request);
    await this.rpc.waitForTransactionReceipt({ hash, confirmations: 1 });

    const decoded = decodeBalanceDelta(result as bigint);
    return {
      amount0: decoded.amount0,
      amount1: decoded.amount1,
      transactionHash: hash,
    };
  }

  async claimAirlockOwnerFees(asset: Address): Promise<{
    fees0: bigint;
    fees1: bigint;
    transactionHash: Hash;
  }> {
    if (!this.walletClient) {
      throw new Error('Wallet client required to claim rehype owner fees');
    }

    const { request, result } = await this.rpc.simulateContract({
      address: this.hookAddress,
      abi: rehypeDopplerHookMigratorAbi,
      functionName: 'claimAirlockOwnerFees',
      args: [asset],
      account: this.walletClient.account,
    });

    const hash = await this.walletClient.writeContract(request);
    await this.rpc.waitForTransactionReceipt({ hash, confirmations: 1 });

    const [fees0, fees1] = result as readonly [bigint, bigint];
    return { fees0, fees1, transactionHash: hash };
  }

  async setFeeDistribution(
    poolId: Hex,
    feeDistributionInfo: RehypeFeeDistributionInfo,
  ): Promise<Hash> {
    if (!this.walletClient) {
      throw new Error('Wallet client required to set rehype fee distribution');
    }

    const { request } = await this.rpc.simulateContract({
      address: this.hookAddress,
      abi: rehypeDopplerHookMigratorAbi,
      functionName: 'setFeeDistribution',
      args: [
        poolId,
        feeDistributionInfo.assetFeesToAssetBuybackWad,
        feeDistributionInfo.assetFeesToNumeraireBuybackWad,
        feeDistributionInfo.assetFeesToBeneficiaryWad,
        feeDistributionInfo.assetFeesToLpWad,
        feeDistributionInfo.numeraireFeesToAssetBuybackWad,
        feeDistributionInfo.numeraireFeesToNumeraireBuybackWad,
        feeDistributionInfo.numeraireFeesToBeneficiaryWad,
        feeDistributionInfo.numeraireFeesToLpWad,
      ],
      account: this.walletClient.account,
    });

    const hash = await this.walletClient.writeContract(request);
    await this.rpc.waitForTransactionReceipt({ hash, confirmations: 1 });
    return hash;
  }

  async getFeeDistributionInfo(
    poolId: Hex,
  ): Promise<RehypeFeeDistributionInfo> {
    const result = await this.rpc.readContract({
      address: this.hookAddress,
      abi: rehypeDopplerHookMigratorAbi,
      functionName: 'getFeeDistributionInfo',
      args: [poolId],
    });

    const info = result as any;
    return {
      assetFeesToAssetBuybackWad: BigInt(
        info.assetFeesToAssetBuybackWad ?? info[0],
      ),
      assetFeesToNumeraireBuybackWad: BigInt(
        info.assetFeesToNumeraireBuybackWad ?? info[1],
      ),
      assetFeesToBeneficiaryWad: BigInt(
        info.assetFeesToBeneficiaryWad ?? info[2],
      ),
      assetFeesToLpWad: BigInt(info.assetFeesToLpWad ?? info[3]),
      numeraireFeesToAssetBuybackWad: BigInt(
        info.numeraireFeesToAssetBuybackWad ?? info[4],
      ),
      numeraireFeesToNumeraireBuybackWad: BigInt(
        info.numeraireFeesToNumeraireBuybackWad ?? info[5],
      ),
      numeraireFeesToBeneficiaryWad: BigInt(
        info.numeraireFeesToBeneficiaryWad ?? info[6],
      ),
      numeraireFeesToLpWad: BigInt(info.numeraireFeesToLpWad ?? info[7]),
    };
  }

  async getFeeRoutingMode(poolId: Hex): Promise<number> {
    const mode = await this.rpc.readContract({
      address: this.hookAddress,
      abi: rehypeDopplerHookMigratorAbi,
      functionName: 'getFeeRoutingMode',
      args: [poolId],
    });
    return Number(mode);
  }

  async getHookFees(poolId: Hex): Promise<{
    fees0: bigint;
    fees1: bigint;
    beneficiaryFees0: bigint;
    beneficiaryFees1: bigint;
    airlockOwnerFees0: bigint;
    airlockOwnerFees1: bigint;
    customFee: number;
  }> {
    const result = await this.rpc.readContract({
      address: this.hookAddress,
      abi: rehypeDopplerHookMigratorAbi,
      functionName: 'getHookFees',
      args: [poolId],
    });

    const fees = result as any;
    return {
      fees0: BigInt(fees.fees0 ?? fees[0] ?? 0),
      fees1: BigInt(fees.fees1 ?? fees[1] ?? 0),
      beneficiaryFees0: BigInt(fees.beneficiaryFees0 ?? fees[2] ?? 0),
      beneficiaryFees1: BigInt(fees.beneficiaryFees1 ?? fees[3] ?? 0),
      airlockOwnerFees0: BigInt(fees.airlockOwnerFees0 ?? fees[4] ?? 0),
      airlockOwnerFees1: BigInt(fees.airlockOwnerFees1 ?? fees[5] ?? 0),
      customFee: Number(fees.customFee ?? fees[6] ?? 0),
    };
  }

  async getPoolInfo(poolId: Hex): Promise<{
    asset: Address;
    numeraire: Address;
    buybackDst: Address;
  }> {
    const result = await this.rpc.readContract({
      address: this.hookAddress,
      abi: rehypeDopplerHookMigratorAbi,
      functionName: 'getPoolInfo',
      args: [poolId],
    });

    const info = result as any;
    return {
      asset: (info.asset ?? info[0]) as Address,
      numeraire: (info.numeraire ?? info[1]) as Address,
      buybackDst: (info.buybackDst ?? info[2]) as Address,
    };
  }

  async getPosition(poolId: Hex): Promise<{
    tickLower: number;
    tickUpper: number;
    liquidity: bigint;
    salt: Hex;
  }> {
    const result = await this.rpc.readContract({
      address: this.hookAddress,
      abi: rehypeDopplerHookMigratorAbi,
      functionName: 'getPosition',
      args: [poolId],
    });

    const position = result as any;
    return {
      tickLower: Number(position.tickLower ?? position[0] ?? 0),
      tickUpper: Number(position.tickUpper ?? position[1] ?? 0),
      liquidity: BigInt(position.liquidity ?? position[2] ?? 0),
      salt: (position.salt ?? position[3]) as Hex,
    };
  }
}
