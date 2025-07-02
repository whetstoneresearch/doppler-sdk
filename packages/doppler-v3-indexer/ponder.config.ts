import { createConfig } from "ponder";
import { http } from "viem";
import {
  chainConfigs,
  generateAllBlockConfigs,
  generateAllContractConfigs,
} from "./src/config";

// Generate chains configuration from our modular setup
const chains = Object.fromEntries(
  Object.entries(chainConfigs).map(([name, config]) => [
    name,
    {
      id: config.id,
      rpc: http(process.env[config.rpcEnvVar]),
    },
  ])
);

// Generate all block configurations
const blocks = generateAllBlockConfigs();

// Generate all contract configurations
const contracts = {
  ...generateAllContractConfigs(),
};

export default createConfig({
  database: {
    kind: "postgres",
    connectionString: process.env.DATABASE_URL,
    poolConfig: {
      max: 100,
    },
  },
  ordering: "omnichain",
  chains,
  blocks,
  contracts,
});
