import { Chain } from "viem";

/**
 * Multicall configuration for different chains
 * Some chains require specific multicall addresses
 */
const MULTICALL_ADDRESSES: Record<string, `0x${string}`> = {
  ink: "0xcA11bde05977b3631167028862bE2a173976CA11",
};

/**
 * Get multicall configuration options for a specific chain
 * @param chain - The chain object or chain name
 * @returns Multicall options object to spread into multicall calls
 */
export const getMulticallOptions = (
  chain: Chain | { name: string } | undefined
): { multicallAddress?: `0x${string}` } => {
  if (!chain) {
    return {};
  }

  const chainName = typeof chain === "string" ? chain : chain.name;
  const multicallAddress = MULTICALL_ADDRESSES[chainName];

  return multicallAddress ? { multicallAddress } : {};
};

/**
 * Helper to safely execute multicall with proper configuration
 * @param client - Viem client
 * @param contracts - Array of contract calls
 * @param chain - Chain information
 * @returns Multicall results
 */
export const executeMulticall = async <T extends readonly unknown[]>(
  client: any, // Using any to avoid complex viem type imports
  contracts: readonly unknown[],
  chain?: Chain | { name: string }
) => {
  const multicallOptions = getMulticallOptions(chain);
  
  return client.multicall({
    contracts,
    ...multicallOptions,
  }) as Promise<T>;
};