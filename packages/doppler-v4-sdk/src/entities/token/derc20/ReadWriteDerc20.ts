import {
  ReadWriteContract,
  ReadWriteAdapter,
  Drift,
  createDrift,
  TransactionOptions,
} from '@delvtech/drift';
import { Address, Hex } from 'viem';
import { Derc20ABI, ReadDerc20 } from './ReadDerc20';

export class ReadWriteDerc20 extends ReadDerc20 {
  declare contract: ReadWriteContract<Derc20ABI>;

  constructor(
    address: Address,
    drift: Drift<ReadWriteAdapter> = createDrift()
  ) {
    super(address, drift);
  }

  async approve(spender: Address, value: bigint): Promise<Hex> {
    return this.contract.write('approve', { spender, value });
  }

  async release(amount: bigint, options?: TransactionOptions): Promise<Hex> {
    return this.contract.write('release', {}, options);
  }
}
