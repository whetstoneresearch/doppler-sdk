import { Drift } from "@delvtech/drift";
import { viemAdapter, ViemReadAdapter } from "@delvtech/drift-viem";
import { getPublicClient } from "@wagmi/core";
import { config } from "../wagmi";
import { PublicClient, WalletClient } from "viem";

export function getDrift(
  walletClient?: WalletClient
): Drift<ViemReadAdapter<PublicClient>> {
  const publicClient = getPublicClient(config);
  return new Drift({ adapter: viemAdapter({ publicClient, walletClient }) });
}
