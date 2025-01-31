import {
  ReadContract,
  ReadAdapter,
  Drift,
  EventLog,
  FunctionReturn,
  ContractGetEventsOptions,
  ContractReadOptions,
  createDrift,
} from "@delvtech/drift";
import { Address } from "viem";
import { airlockAbi } from "../../abis";

export type AirlockABI = typeof airlockAbi;

export enum ModuleState {
  NotWhitelisted = 0,
  TokenFactory = 1,
  GovernanceFactory = 2,
  HookFactory = 3,
  Migrator = 4,
}

export class ReadFactory {
  airlock: ReadContract<AirlockABI>;

  constructor(address: Address, drift: Drift<ReadAdapter> = createDrift()) {
    this.airlock = drift.contract({
      abi: airlockAbi,
      address,
    });
  }

  async getModuleState(
    address: Address,
    options?: ContractReadOptions
  ): Promise<FunctionReturn<AirlockABI, "getModuleState">> {
    return this.airlock.read("getModuleState", {
      module: address,
      ...options,
    });
  }

  async getAssetData(
    asset: Address,
    options?: ContractReadOptions
  ): Promise<FunctionReturn<AirlockABI, "getAssetData">> {
    return this.airlock.read("getAssetData", {
      asset,
      ...options,
    });
  }

  async getCreateEvents(
    options?: ContractGetEventsOptions
  ): Promise<EventLog<AirlockABI, "Create">[]> {
    return this.airlock.getEvents("Create", {
      ...options,
    });
  }

  async getMigrateEvents(
    options?: ContractGetEventsOptions
  ): Promise<EventLog<AirlockABI, "Migrate">[]> {
    return this.airlock.getEvents("Migrate", {
      ...options,
    });
  }

  async getSetModuleStateEvents(
    options?: ContractGetEventsOptions
  ): Promise<EventLog<AirlockABI, "SetModuleState">[]> {
    return this.airlock.getEvents("SetModuleState", {
      ...options,
    });
  }
}
