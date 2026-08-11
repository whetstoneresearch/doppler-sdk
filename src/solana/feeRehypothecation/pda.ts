import {
  getAddressEncoder,
  getProgramDerivedAddress,
  type Address,
  type ProgramDerivedAddress,
} from '@solana/kit';

import { DOPPLER_REHYPE_ROUTER_V1_PROGRAM_ADDRESS } from '../dopplerRehypeRouterV1/index.js';

const textEncoder = new TextEncoder();

function deriveAddress(
  seed: string,
  addressSeed: Address,
  programId: Address,
): Promise<ProgramDerivedAddress> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [textEncoder.encode(seed), getAddressEncoder().encode(addressSeed)],
  });
}

export function getFeeRehypothecationStateAddress(
  baseMint: Address,
  programId: Address = DOPPLER_REHYPE_ROUTER_V1_PROGRAM_ADDRESS,
): Promise<ProgramDerivedAddress> {
  return deriveAddress('rehype_state', baseMint, programId);
}

export function getFeeRehypothecationAuthorityAddress(
  state: Address,
  programId: Address = DOPPLER_REHYPE_ROUTER_V1_PROGRAM_ADDRESS,
): Promise<ProgramDerivedAddress> {
  return deriveAddress('rehype_authority', state, programId);
}

export function getFeeRehypothecationSettlementSignerAddress(
  state: Address,
  programId: Address = DOPPLER_REHYPE_ROUTER_V1_PROGRAM_ADDRESS,
): Promise<ProgramDerivedAddress> {
  return deriveAddress('settlement_signer', state, programId);
}

export type FeeRehypothecationAddresses = {
  state: Address;
  authority: Address;
  settlementSigner: Address;
};

export async function deriveFeeRehypothecationAddresses(
  baseMint: Address,
  programId: Address = DOPPLER_REHYPE_ROUTER_V1_PROGRAM_ADDRESS,
): Promise<FeeRehypothecationAddresses> {
  const [state] = await getFeeRehypothecationStateAddress(baseMint, programId);
  const [[authority], [settlementSigner]] = await Promise.all([
    getFeeRehypothecationAuthorityAddress(state, programId),
    getFeeRehypothecationSettlementSignerAddress(state, programId),
  ]);

  return { state, authority, settlementSigner };
}
