import { address, type Address } from '@solana/kit';

import {
  DOPPLER_SOLANA_DEVNET_FEE_REHYPOTHECATION_PROGRAM_ADDRESSES as DEVNET_FEES,
  DOPPLER_SOLANA_DEVNET_PROGRAM_ADDRESSES as DEVNET,
  DOPPLER_SOLANA_MAINNET_FEE_REHYPOTHECATION_PROGRAM_ADDRESSES as MAINNET_FEES,
  DOPPLER_SOLANA_MAINNET_PROGRAM_ADDRESSES as MAINNET,
  vesting,
} from '../../src/solana/index.js';
import { DEVNET_USDC_MINT } from '../../examples/solanaExampleHelpers.js';

export type Network = 'devnet' | 'mainnet';
export const NETWORKS: readonly Network[] = ['devnet', 'mainnet'];

export type ProgramName =
  | 'cpmm'
  | 'initializer'
  | 'cpmmMigrator'
  | 'launchHookV1'
  | 'launchHookV2'
  | 'rehypeRouter'
  | 'vesting'
  | 'tokenMetadata';

export type NetworkConfig = {
  rpcUrl: string;
  rpcPort: number;
  usdcMint: Address;
  programs: Record<ProgramName, Address>;
};

const TOKEN_METADATA_PROGRAM = address(
  'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',
);
const rpcPort = (fallback: number) =>
  Number(process.env.SOLANA_FORK_RPC_PORT ?? fallback);

export const NETWORK_CONFIGS: Record<Network, NetworkConfig> = {
  devnet: {
    rpcUrl:
      process.env.SOLANA_DEVNET_RPC_URL ?? 'https://api.devnet.solana.com',
    rpcPort: rpcPort(19009),
    usdcMint: DEVNET_USDC_MINT,
    programs: {
      cpmm: DEVNET.cpmmProgram,
      initializer: DEVNET.initializerProgram,
      cpmmMigrator: DEVNET.cpmmMigratorProgram,
      launchHookV1: DEVNET.dopplerLaunchHookV1Program,
      launchHookV2: DEVNET_FEES.dopplerLaunchHookV2Program,
      rehypeRouter: DEVNET_FEES.dopplerRehypeRouterV1Program,
      vesting: vesting.DOPPLER_VESTING_PROGRAM_ADDRESS,
      tokenMetadata: TOKEN_METADATA_PROGRAM,
    },
  },
  mainnet: {
    rpcUrl:
      process.env.SOLANA_MAINNET_RPC_URL ??
      'https://api.mainnet-beta.solana.com',
    rpcPort: rpcPort(18899),
    usdcMint: address('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
    programs: {
      cpmm: MAINNET.cpmmProgram,
      initializer: MAINNET.initializerProgram,
      cpmmMigrator: MAINNET.cpmmMigratorProgram,
      launchHookV1: MAINNET.dopplerLaunchHookV1Program,
      launchHookV2: MAINNET_FEES.dopplerLaunchHookV2Program,
      rehypeRouter: MAINNET_FEES.dopplerRehypeRouterV1Program,
      vesting: vesting.DOPPLER_VESTING_PROGRAM_ADDRESS,
      tokenMetadata: TOKEN_METADATA_PROGRAM,
    },
  },
};

/**
 * SHA-256 of each deployed ELF with trailing zeros trimmed, as last verified.
 * Builds differ per network, so never compare hashes across networks.
 */
export const PROGRAM_PINS: Record<Network, Record<ProgramName, string>> = {
  devnet: {
    cpmm: '67b2f8c614844779056e02b048f1bca1b89d29893264575bcf5f2e462d050bde',
    initializer:
      'f50a2f5d47629c6e9a91faa4a54057533005f06e06ea17161d938128d974238f',
    cpmmMigrator:
      '93bea025240afa4a73ef93cada71ce9bf106552ada33d9011271df0a0bdffb43',
    launchHookV1:
      '590d18a140e436c7a9ee0025dd3524618d3a9a49ae317c55307e89135f1ca438',
    launchHookV2:
      '834a41cec3bead850677c0e47961ffcf92d268cf70a2f8533342c2c3c61b2599',
    rehypeRouter:
      '9407d77df907cb3f9f5776d95d03179692a5c3a19bdc398daf374722be70e52b',
    vesting: 'c94da3709f15b41a315d0c2e6e8eaa9629961db7f6557c748e6903e191f32775',
    tokenMetadata:
      '847b794a9e11b49c971898a224575ed405c9fcf6069ab87233ebdeca37f07683',
  },
  mainnet: {
    cpmm: 'ec40f2db3155d8419058972142ede143c1d62659ccf17636efe289a74a18af2b',
    initializer:
      '403d5a39ad9e43cace1c07f190d1eedc1f5b181be2144d9a69b6200b4b424f7e',
    cpmmMigrator:
      'bac184ae28f7161658fbfbcb65694c600f8bdbca854222b4e5b3da2402fb6a55',
    launchHookV1:
      '5c42ac053fe4611e7977eb492fe989c0134ebdf7a0c37941c17b265f68806c46',
    launchHookV2:
      '4bcab943569b8d428b7289ea3ba9bb29930a96f06336ea0cce82e524fa535126',
    rehypeRouter:
      'ccb95f46e0f390e51c0b5ca1fab512d750efcf773f0b9aacfd167d74a7dd3639',
    vesting: '24ec883481a989ab7dd956b33473c96b6f5a72def8a63a030adf666881957404',
    tokenMetadata:
      '8fdb14984e4756f3157881754fdc9444646b15cad27a5c78fa249dc5f507e3a7',
  },
};
