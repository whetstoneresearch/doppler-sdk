import type { Address, GetAccountInfoApi, Rpc } from '@solana/kit';
import { SYSTEM_PROGRAM_ADDRESS } from '@solana-program/system';

import { fetchMaybeCosignerConfig } from '../generated/dopplerLaunchHookV1/index.js';
import {
  DOPPLER_LAUNCH_HOOK_V1_PROGRAM_ID,
  MAX_COSIGNERS,
} from './constants.js';
import { getDopplerLaunchHookV1ConfigAddress } from './pda.js';

const resolvedManagedCosignerGateBrand: unique symbol = Symbol(
  'resolvedManagedCosignerGate',
);

export type ResolveManagedCosignerGateInput = {
  /**
   * Unix timestamp after which swaps no longer require the managed cosigner.
   * Omit or set to null for an indefinite gate.
   */
  expiresAt?: bigint | number | null;
  programId?: Address;
};

export type ResolvedManagedCosignerGate = {
  readonly programId: Address;
  readonly config: Address;
  readonly cosigner: Address;
  readonly activeCosigners: readonly Address[];
  readonly expiresAt?: bigint | number | null;
  readonly [resolvedManagedCosignerGateBrand]: true;
};

export function isResolvedManagedCosignerGate(
  value: unknown,
): value is ResolvedManagedCosignerGate {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { [resolvedManagedCosignerGateBrand]?: unknown })[
      resolvedManagedCosignerGateBrand
    ] === true
  );
}

/**
 * Resolves a Doppler-managed cosigner gate for launch construction.
 *
 * Each launch commits one signer account for deterministic swap account
 * reconstruction. The first active config entry is the deployment's canonical
 * signer for newly created launches.
 */
export async function resolveManagedCosignerGate(
  rpc: Rpc<GetAccountInfoApi>,
  input: ResolveManagedCosignerGateInput = {},
): Promise<ResolvedManagedCosignerGate> {
  const programId = input.programId ?? DOPPLER_LAUNCH_HOOK_V1_PROGRAM_ID;
  const [config, expectedBump] =
    await getDopplerLaunchHookV1ConfigAddress(programId);
  const configAccount = await fetchMaybeCosignerConfig(rpc, config, {
    commitment: 'confirmed',
  });

  if (!configAccount.exists) {
    throw new Error(`Doppler-managed cosigner config ${config} does not exist`);
  }
  if (configAccount.programAddress !== programId) {
    throw new Error(
      `Doppler-managed cosigner config ${config} is owned by ${configAccount.programAddress}, expected ${programId}`,
    );
  }

  const { bump, cosignerCount, cosigners, version } = configAccount.data;
  if (
    version !== 1 ||
    bump !== expectedBump ||
    cosignerCount === 0 ||
    cosignerCount > MAX_COSIGNERS ||
    cosignerCount > cosigners.length
  ) {
    throw new Error(
      `Doppler-managed cosigner config ${config} has no valid active cosigner`,
    );
  }

  const activeCosigners = Object.freeze(cosigners.slice(0, cosignerCount));
  if (
    activeCosigners.some((candidate) => candidate === SYSTEM_PROGRAM_ADDRESS) ||
    new Set(activeCosigners).size !== activeCosigners.length
  ) {
    throw new Error(
      `Doppler-managed cosigner config ${config} contains invalid active cosigners`,
    );
  }

  const cosigner = activeCosigners[0];
  if (!cosigner) {
    throw new Error(
      `Doppler-managed cosigner config ${config} has no active cosigner`,
    );
  }

  const resolvedGate: ResolvedManagedCosignerGate = {
    [resolvedManagedCosignerGateBrand]: true,
    programId,
    config,
    cosigner,
    activeCosigners,
    ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
  };
  Object.defineProperty(resolvedGate, resolvedManagedCosignerGateBrand, {
    enumerable: false,
  });
  return Object.freeze(resolvedGate);
}
