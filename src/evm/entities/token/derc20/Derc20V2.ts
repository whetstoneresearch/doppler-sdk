import type { Address } from 'viem';
import { derc20V2Abi } from '../../../abis';
import { Derc20 } from './Derc20';

export class Derc20V2 extends Derc20 {
  async getVestingScheduleCount(): Promise<bigint> {
    return await this.rpc.readContract({
      address: this.address,
      abi: derc20V2Abi,
      functionName: 'vestingScheduleCount',
    });
  }

  async getVestingSchedule(scheduleId: bigint): Promise<{
    cliffDuration: bigint;
    duration: bigint;
  }> {
    const result = await this.rpc.readContract({
      address: this.address,
      abi: derc20V2Abi,
      functionName: 'vestingSchedules',
      args: [scheduleId],
    });

    return {
      cliffDuration: BigInt(result[0]),
      duration: BigInt(result[1]),
    };
  }

  async getScheduleIdsOf(beneficiary: Address): Promise<bigint[]> {
    const result = await this.rpc.readContract({
      address: this.address,
      abi: derc20V2Abi,
      functionName: 'getScheduleIdsOf',
      args: [beneficiary],
    });
    return Array.from(result);
  }

  async getTotalAllocatedOf(beneficiary: Address): Promise<bigint> {
    return await this.rpc.readContract({
      address: this.address,
      abi: derc20V2Abi,
      functionName: 'totalAllocatedOf',
      args: [beneficiary],
    });
  }

  async getAvailableVestedAmountForSchedule(
    beneficiary: Address,
    scheduleId: bigint,
  ): Promise<bigint> {
    return await this.rpc.readContract({
      address: this.address,
      abi: derc20V2Abi,
      functionName: 'computeAvailableVestedAmount',
      args: [beneficiary, scheduleId],
    });
  }

  async getVestingDataForSchedule(
    beneficiary: Address,
    scheduleId: bigint,
  ): Promise<{
    totalAmount: bigint;
    releasedAmount: bigint;
  }> {
    const result = await this.rpc.readContract({
      address: this.address,
      abi: derc20V2Abi,
      functionName: 'vestingOf',
      args: [beneficiary, scheduleId],
    });

    return {
      totalAmount: result[0],
      releasedAmount: result[1],
    };
  }

  async releaseSchedule(
    scheduleId: bigint,
    options?: { gas?: bigint },
  ): Promise<`0x${string}`> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }

    const { request } = await this.rpc.simulateContract({
      address: this.address,
      abi: derc20V2Abi,
      functionName: 'release',
      args: [scheduleId],
      account: this.walletClient.account,
    });

    return await this.walletClient.writeContract(
      options?.gas ? { ...request, gas: options.gas } : request,
    );
  }

  async releaseFor(
    beneficiary: Address,
    scheduleId?: bigint,
    options?: { gas?: bigint },
  ): Promise<`0x${string}`> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }

    if (scheduleId === undefined) {
      const { request } = await this.rpc.simulateContract({
        address: this.address,
        abi: derc20V2Abi,
        functionName: 'releaseFor',
        args: [beneficiary],
        account: this.walletClient.account,
      });

      return await this.walletClient.writeContract(
        options?.gas ? { ...request, gas: options.gas } : request,
      );
    }

    const { request } = await this.rpc.simulateContract({
      address: this.address,
      abi: derc20V2Abi,
      functionName: 'releaseFor',
      args: [beneficiary, scheduleId],
      account: this.walletClient.account,
    });

    return await this.walletClient.writeContract(
      options?.gas ? { ...request, gas: options.gas } : request,
    );
  }
}
