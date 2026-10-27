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
