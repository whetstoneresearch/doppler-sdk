import {
  ReadWriteContract,
  ReadWriteAdapter,
  Drift,
  ContractWriteOptions,
  OnMinedParam,
  FunctionArgs,
} from '@delvtech/drift';
import { ReadFactory, AirlockABI } from './ReadFactory';
import { Address, Hex } from 'viem';

export interface CreateParams {
  initialSupply: bigint;
  numTokensToSell: bigint;
  numeraire: Address;
  tokenFactory: Address;
  tokenFactoryData: Hex;
  governanceFactory: Address;
  governanceFactoryData: Hex;
  poolInitializer: Address;
  poolInitializerData: Hex;
  liquidityMigrator: Address;
  liquidityMigratorData: Hex;
  integrator: Address;
  salt: Hex;
  hook: Hex;
  token: Hex;
}

export class ReadWriteFactory extends ReadFactory {
  declare airlock: ReadWriteContract<AirlockABI>;

  constructor(address: Address, drift: Drift<ReadWriteAdapter>) {
    super(address, drift);
  }

  async create(
    params: FunctionArgs<AirlockABI, 'create'>['createData'],
    options?: ContractWriteOptions & OnMinedParam
  ): Promise<Hex> {
    return this.airlock.write('create', { createData: params }, options);
  }
}
