import {
  ReadContract,
  ReadAdapter,
  Drift,
  FunctionReturn,
  ContractOptions,
  createDrift,
} from "@delvtech/drift";
import { Address } from "viem";
import { v4MigratorAbi } from "../../abis";

export type V4MigratorABI = typeof v4MigratorAbi;

export class ReadMigrator {
  migrator: ReadContract<V4MigratorABI>;

  constructor(address: Address, drift: Drift<ReadAdapter> = createDrift()) {
    this.migrator = drift.contract({
      abi: v4MigratorAbi,
      address,
    });
  }

  async getAssetData(
    token0: Address,
    token1: Address,
    options?: ContractOptions
  ): Promise<FunctionReturn<V4MigratorABI, "getAssetData">> {
    return this.migrator.read("getAssetData", {
      token0,
      token1,
      ...options,
    });
  }

  async airlock(): Promise<FunctionReturn<V4MigratorABI, "airlock">> {
    return this.migrator.read("airlock");
  }

  async locker(): Promise<FunctionReturn<V4MigratorABI, "locker">> {
    return this.migrator.read("locker");
  }

  async poolManager(): Promise<FunctionReturn<V4MigratorABI, "poolManager">> {
    return this.migrator.read("poolManager");
  }

  async positionManager(): Promise<FunctionReturn<V4MigratorABI, "positionManager">> {
    return this.migrator.read("positionManager");
  }

  async DEAD_ADDRESS(): Promise<FunctionReturn<V4MigratorABI, "DEAD_ADDRESS">> {
    return this.migrator.read("DEAD_ADDRESS");
  }
}