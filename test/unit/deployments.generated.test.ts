import { readFileSync } from 'node:fs';
import { getAddress } from 'viem';
import { describe, expect, it } from 'vitest';
import { CHAIN_IDS, getAddresses } from '../../src/addresses';
import { GENERATED_DOPPLER_DEPLOYMENTS } from '../../src/deployments.generated';

describe('generated deployments', () => {
  const deployments = JSON.parse(
    readFileSync(
      new URL('../../../doppler/Deployments.json', import.meta.url),
      'utf8',
    ),
  ) as Record<string, Record<string, string | undefined>>;

  it('keeps Rehype deployment entries in sync with doppler/Deployments.json', () => {
    for (const [chainId, chainDeployments] of Object.entries(deployments)) {
      const hasRehypeEntries =
        chainDeployments.RehypeDopplerHook !== undefined ||
        chainDeployments.RehypeDopplerHookInitializer !== undefined ||
        chainDeployments.RehypeDopplerHookMigrator !== undefined;

      if (!hasRehypeEntries) {
        continue;
      }

      const generated = GENERATED_DOPPLER_DEPLOYMENTS[chainId];
      expect(generated).toBeDefined();

      if (chainDeployments.RehypeDopplerHook !== undefined) {
        expect(generated.RehypeDopplerHook).toBe(
          getAddress(chainDeployments.RehypeDopplerHook),
        );
      }

      if (chainDeployments.RehypeDopplerHookInitializer !== undefined) {
        expect(generated.RehypeDopplerHookInitializer).toBe(
          getAddress(chainDeployments.RehypeDopplerHookInitializer),
        );
      }

      if (chainDeployments.RehypeDopplerHookMigrator !== undefined) {
        expect(generated.RehypeDopplerHookMigrator).toBe(
          getAddress(chainDeployments.RehypeDopplerHookMigrator),
        );
      }
    }
  });

  it('maps canonical public Rehype addresses from the generated deployments', () => {
    const supportedChains = [
      CHAIN_IDS.MAINNET,
      CHAIN_IDS.ETH_SEPOLIA,
      CHAIN_IDS.BASE,
      CHAIN_IDS.BASE_SEPOLIA,
      CHAIN_IDS.MONAD_MAINNET,
    ] as const;

    for (const chainId of supportedChains) {
      const source = deployments[String(chainId)];
      const addresses = getAddresses(chainId);
      const canonicalInitializer =
        source.RehypeDopplerHookInitializer ?? source.RehypeDopplerHook;

      if (canonicalInitializer !== undefined) {
        expect(addresses.rehypeDopplerHookInitializer).toBe(
          getAddress(canonicalInitializer),
        );
        expect(addresses.rehypeDopplerHook).toBe(
          getAddress(canonicalInitializer),
        );
      }

      if (source.DopplerHookMigrator !== undefined) {
        expect(addresses.dopplerHookMigrator).toBe(
          getAddress(source.DopplerHookMigrator),
        );
      }

      if (source.RehypeDopplerHookMigrator !== undefined) {
        expect(addresses.rehypeDopplerHookMigrator).toBe(
          getAddress(source.RehypeDopplerHookMigrator),
        );
      }
    }
  });
});
