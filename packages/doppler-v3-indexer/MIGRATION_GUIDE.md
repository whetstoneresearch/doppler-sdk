# Configuration Migration Guide

This guide explains how to migrate from the old monolithic `addresses.ts` and `ponder.config.ts` to the new modular configuration system.

## 🔄 What Changed

### Before (Old Structure)
```
addresses.ts          # 265 lines - everything in one file
ponder.config.ts      # 490 lines - repetitive configuration
```

### After (New Structure) 
```
src/config/
├── chains/           # Chain-specific configurations
├── contracts/        # Contract configuration generators  
├── blocks/          # Block configuration generators
└── index.ts         # Main exports
```

## 📦 New File Organization

### Chain Configurations (`src/config/chains/`)
- `types.ts` - All TypeScript types
- `constants.ts` - Chain IDs, block numbers, common addresses
- `mainnet.ts`, `unichain.ts`, `base.ts`, `ink.ts` - Individual chain configs
- `index.ts` - Exports and utility functions

### Contract Configurations (`src/config/contracts/`)
- `types.ts` - Contract configuration types
- `factories.ts` - Factory configuration helpers
- `v2-contracts.ts`, `v3-contracts.ts`, `v4-contracts.ts` - Version-specific contracts
- `shared-contracts.ts` - Cross-version contracts

### Block Configurations (`src/config/blocks/`)
- `types.ts` - Block configuration types
- `intervals.ts` - Named interval constants
- `checkpoints.ts` - Checkpoint block generators
- `metrics.ts` - Metric refresher generators

## 🚀 Migration Steps

### 1. Update Imports

**Old:**
```typescript
import { configs, CHAIN_IDS } from "./addresses";
```

**New:**
```typescript
import { chainConfigs as configs, CHAIN_IDS } from "./src/config";
```

### 2. Use New Configuration

**Old ponder.config.ts:**
```typescript
// 490 lines of repetitive configuration
```

**New ponder.config.ts:**
```typescript
import { 
  chainConfigs, 
  generateAllBlockConfigs, 
  generateAllContractConfigs 
} from "./src/config";

export default createConfig({
  // ... database config
  chains: Object.fromEntries(
    Object.entries(chainConfigs).map(([name, config]) => [
      name,
      { id: config.id, rpc: http(process.env[config.rpcEnvVar]) }
    ])
  ),
  blocks: generateAllBlockConfigs(),
  contracts: generateAllContractConfigs(),
});
```

### 3. Adding New Chains

**Old way:** Edit addresses.ts (modify 100+ lines)

**New way:** Create new chain file (20 lines)
```typescript
// src/config/chains/newchain.ts
export const newChainConfig: ChainConfig = {
  id: 12345,
  name: "newchain",
  startBlock: 1000000,
  rpcEnvVar: "PONDER_RPC_URL_12345",
  addresses: {
    // ... addresses
  },
};
```

Then add to `src/config/chains/index.ts`:
```typescript
export { newChainConfig } from "./newchain";

export const chainConfigs: IndexerConfigs = {
  // ... existing chains
  newchain: newChainConfig,
};
```

## 🎯 Benefits

1. **Modularity**: Each chain/contract type in its own file
2. **DRY**: No more repetitive contract configurations
3. **Type Safety**: Stronger TypeScript types throughout
4. **Maintainability**: Easy to add/modify chains and contracts
5. **Readability**: Clear separation of concerns
6. **Scalability**: Configuration generators instead of manual repetition

## 🧪 Testing

Run the configuration test:
```bash
bun run src/config/test-config.ts
```

## 🔄 Backwards Compatibility

The old `addresses.ts` file can be updated to re-export from the new structure:

```typescript
// addresses.ts (backwards compatibility)
export * from "./src/config/chains/types";
export { chainConfigs as configs, CHAIN_IDS } from "./src/config";
```

## 📚 Usage Examples

### Get chain configuration:
```typescript
import { getChainConfig, getActiveChains } from "./src/config";

const baseConfig = getChainConfig("base");
const activeChains = getActiveChains();
```

### Generate configurations:
```typescript
import { 
  generateAllBlockConfigs,
  generateAllContractConfigs 
} from "./src/config";

const blocks = generateAllBlockConfigs();
const contracts = generateAllContractConfigs();
```