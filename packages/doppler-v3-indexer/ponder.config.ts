import { createConfig, factory } from "ponder";
import { Address, getAbiItem, http } from "viem";
import { AirlockABI } from "./abis/AirlockABI";
import { UniswapV3PoolABI } from "./abis/UniswapV3PoolABI";
import { DERC20ABI } from "./abis/DERC20ABI";

const addresses = {
  airlock: "0x3d067F7091c9743De932CcD808Ee3D01C51F881F" as Address,
  tokenFactory: "0x8993Cbb0b951ca1472DC09112B9a726aC088b50f" as Address,
  v3Initializer: "0x5Cf5D175bC74319d4AF42f3026aF6446901559a7" as Address,
  governanceFactory: "0xD7Bd7A6C5847536486C262c9a47C2903ec41d978" as Address,
  liquidityMigrator: "0x106dA038525f8D5DA14e8E9094CF2235221659fB" as Address,
};

export default createConfig({
  networks: {
    unichainSepolia: {
      chainId: 1301,
      transport: http(process.env.PONDER_RPC_UNICHAIN_SEPOLIA),
    },
  },
  contracts: {
    UniswapV3Pool: {
      abi: UniswapV3PoolABI,
      network: "unichainSepolia",
      address: factory({
        address: addresses.airlock,
        event: getAbiItem({ abi: AirlockABI, name: "Create" }),
        parameter: "poolOrHook",
      }),
      startBlock: 10111904,
    },
    DERC20: {
      abi: DERC20ABI,
      network: "unichainSepolia",
      address: factory({
        address: addresses.airlock,
        event: getAbiItem({ abi: AirlockABI, name: "Create" }),
        parameter: "asset",
      }),
      startBlock: 10111904,
    },
    Airlock: {
      abi: AirlockABI,
      network: "unichainSepolia",
      address: addresses.airlock,
      startBlock: 10111904,
    },
  },
});
