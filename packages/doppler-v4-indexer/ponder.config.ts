import { createConfig, factory } from "ponder";
import { getAbiItem, http } from "viem";

import { airlockAbi, derc20Abi, dopplerAbi, poolManagerAbi } from "@app/abis";
import { addresses } from "@app/types";

const chainId = 1301;
const startingBlock = 11399810;

export default createConfig({
  database: {
    kind: "postgres",
    connectionString: process.env.DATABASE_URL,
  },
  networks: {
    unichainSepolia: {
      chainId: chainId,
      transport: http(process.env.RPC_UNICHAIN_SEPOLIA),
    },
  },
  contracts: {
    PoolManager: {
      abi: poolManagerAbi,
      network: "unichainSepolia",
      address: addresses.poolManager,
      startBlock: startingBlock,
    },
    Doppler: {
      abi: dopplerAbi,
      network: "unichainSepolia",
      address: factory({
        address: addresses.airlock,
        event: getAbiItem({ abi: airlockAbi, name: "Create" }),
        parameter: "poolOrHook",
      }),
      startBlock: startingBlock,
    },
    DERC20: {
      abi: derc20Abi,
      network: "unichainSepolia",
      address: factory({
        address: addresses.airlock,
        event: getAbiItem({ abi: airlockAbi, name: "Create" }),
        parameter: "asset",
      }),
      startBlock: startingBlock,
    },
    Airlock: {
      abi: airlockAbi,
      network: "unichainSepolia",
      address: addresses.airlock,
      startBlock: startingBlock,
    },
  },
});
