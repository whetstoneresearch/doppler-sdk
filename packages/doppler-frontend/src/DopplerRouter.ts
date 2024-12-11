import { Address, createPublicClient, createWalletClient, custom } from "viem";
import { ReadWriteRouter } from "./../../doppler-sdk/src/entities/router";
import { useMemo } from "react";
import { Drift } from "@delvtech/drift";
import { viemAdapter } from "@delvtech/drift-viem";

export function useDopplerRouter(dopplerAddress: Address) {
  const publicClient = createPublicClient({
    transport: custom(window.ethereum),
  });

  const walletClient = createWalletClient({
    transport: custom(window.ethereum),
  });

  return useMemo(() => {
    const drift = new Drift({
      adapter: viemAdapter({
        publicClient,
        walletClient,
      }),
    });

    return new ReadWriteRouter(dopplerAddress, drift);
  }, [dopplerAddress, publicClient, walletClient]);
}
