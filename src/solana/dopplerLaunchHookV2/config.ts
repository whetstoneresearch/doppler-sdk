import type { Address, GetAccountInfoApi, Rpc } from '@solana/kit';
import { SYSTEM_PROGRAM_ADDRESS } from '@solana-program/system';

import { INITIALIZER_PROGRAM_ID } from '../initializer/index.js';
import { DOPPLER_REHYPE_ROUTER_V1_PROGRAM_ADDRESS } from '../generated/dopplerRehypeRouterV1/index.js';
import { fetchMaybeHookConfig } from '../generated/dopplerLaunchHookV2/index.js';
import {
  DOPPLER_LAUNCH_HOOK_V2_MAX_COSIGNERS,
  DOPPLER_LAUNCH_HOOK_V2_PROGRAM_ID,
} from './constants.js';
import { getDopplerLaunchHookV2ConfigAddress } from './pda.js';

const resolvedManagedCosignerGateV2Brand: unique symbol = Symbol(
  'resolvedManagedCosignerGateV2',
);
const MAX_U64 = (1n << 64n) - 1n;

export type ResolveManagedCosignerGateV2Input = {
  /** Unix timestamp after which the gate is inactive. Omit for no expiry. */
  expiresAt?: bigint | number | null;
  programId?: Address;
  initializerProgram?: Address;
  feeRehypothecationRouterProgram?: Address;
};

export type ResolvedManagedCosignerGateV2 = {
  readonly programId: Address;
  readonly config: Address;
  readonly cosigner: Address;
  readonly activeCosigners: readonly Address[];
  readonly expiresAt: bigint;
  readonly [resolvedManagedCosignerGateV2Brand]: true;
};

export function isResolvedManagedCosignerGateV2(
  value: unknown,
): value is ResolvedManagedCosignerGateV2 {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { [resolvedManagedCosignerGateV2Brand]?: unknown })[
      resolvedManagedCosignerGateV2Brand
    ] === true
  );
}

export async function resolveManagedCosignerGate(
  rpc: Rpc<GetAccountInfoApi>,
  input: ResolveManagedCosignerGateV2Input = {},
): Promise<ResolvedManagedCosignerGateV2> {
  const programId = input.programId ?? DOPPLER_LAUNCH_HOOK_V2_PROGRAM_ID;
  const initializerProgram = input.initializerProgram ?? INITIALIZER_PROGRAM_ID;
  const feeRehypothecationRouterProgram =
    input.feeRehypothecationRouterProgram ??
    DOPPLER_REHYPE_ROUTER_V1_PROGRAM_ADDRESS;
  const [config, expectedBump] =
    await getDopplerLaunchHookV2ConfigAddress(programId);
  const configAccount = await fetchMaybeHookConfig(rpc, config, {
    commitment: 'confirmed',
  });

  if (!configAccount.exists) {
    throw new Error(`Doppler launch hook v2 config ${config} does not exist`);
  }
  if (configAccount.programAddress !== programId) {
    throw new Error(
      `Doppler launch hook v2 config ${config} is owned by ${configAccount.programAddress}, expected ${programId}`,
    );
  }

  const {
    bump,
    cosignerCount,
    cosigners,
    initializerProgram: configuredInitializer,
    rehypeRouterProgram,
    version,
  } = configAccount.data;
  if (
    version !== 1 ||
    bump !== expectedBump ||
    configuredInitializer !== initializerProgram ||
    rehypeRouterProgram !== feeRehypothecationRouterProgram ||
    cosignerCount === 0 ||
    cosignerCount > DOPPLER_LAUNCH_HOOK_V2_MAX_COSIGNERS ||
    cosignerCount > cosigners.length
  ) {
    throw new Error(
      `Doppler launch hook v2 config ${config} is not valid for this deployment`,
    );
  }

  const activeCosigners = Object.freeze(cosigners.slice(0, cosignerCount));
  if (
    activeCosigners.some((candidate) => candidate === SYSTEM_PROGRAM_ADDRESS) ||
    new Set(activeCosigners).size !== activeCosigners.length
  ) {
    throw new Error(
      `Doppler launch hook v2 config ${config} contains invalid active cosigners`,
    );
  }
  const cosigner = activeCosigners[0];
  if (!cosigner) {
    throw new Error(
      `Doppler launch hook v2 config ${config} has no active cosigner`,
    );
  }

  if (
    typeof input.expiresAt === 'number' &&
    !Number.isSafeInteger(input.expiresAt)
  ) {
    throw new Error('expiresAt must be a safe integer or bigint');
  }
  const expiresAt =
    input.expiresAt === undefined || input.expiresAt === null
      ? MAX_U64
      : BigInt(input.expiresAt);
  if (expiresAt < 0n || expiresAt > MAX_U64) {
    throw new Error('expiresAt must be between 0 and u64::MAX');
  }

  const resolvedGate: ResolvedManagedCosignerGateV2 = {
    [resolvedManagedCosignerGateV2Brand]: true,
    programId,
    config,
    cosigner,
    activeCosigners,
    expiresAt,
  };
  Object.defineProperty(resolvedGate, resolvedManagedCosignerGateV2Brand, {
    enumerable: false,
  });
  return Object.freeze(resolvedGate);
}
