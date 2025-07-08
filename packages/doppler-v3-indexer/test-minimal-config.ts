import { createConfig } from "ponder";
import { http } from "viem";
import { chainConfigs } from "./src/config";

// Test with minimal configuration - just one chain and no contracts
const chains = {
  base: {
    id: chainConfigs.base.id,
    rpc: http(process.env[chainConfigs.base.rpcEnvVar]),
  },
};

// No blocks or contracts initially
const testConfig = createConfig({
  database: {
    kind: "postgres",
    connectionString: "postgresql://postgres:postgres@localhost:5432/default",
    poolConfig: {
      max: 100,
    },
  },
  ordering: "multichain",
  chains,
  blocks: {},
  contracts: {},
});

console.log("✅ Minimal config created successfully");
console.log("Chains:", Object.keys(chains));

export default testConfig;