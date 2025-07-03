import { ContractConfigMap } from "./types";
import { generateV2Contracts } from "./v2-contracts";
import { generateV3Contracts } from "./v3-contracts";
import { generateV4Contracts } from "./v4-contracts";
import { generateSharedContracts } from "./shared-contracts";
import { IndexerConfigs } from "../chains";

export * from "./types";
export * from "./factories";

// Combine all contract configurations
export const generateAllContractConfigs = (chainConfigs: IndexerConfigs): ContractConfigMap => ({
  ...generateSharedContracts(chainConfigs),
  ...generateV3Contracts(chainConfigs),
  ...generateV4Contracts(chainConfigs),
  ...generateV2Contracts(chainConfigs),
});