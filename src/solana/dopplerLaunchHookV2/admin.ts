import {
  AccountRole,
  type Address,
  type Instruction,
  type TransactionSigner,
} from '@solana/kit';

import { getDisableCosignGatesInstructionAsync } from '../generated/dopplerLaunchHookV2/index.js';
import {
  DOPPLER_LAUNCH_HOOK_V2_MAX_COSIGN_GATE_DISABLES,
  DOPPLER_LAUNCH_HOOK_V2_PROGRAM_ID,
} from './constants.js';
import { getDopplerLaunchHookV2CosignGateControlAddress } from './pda.js';

export type PrepareDisableCosignGatesInput = {
  adminAuthority: TransactionSigner;
  launches: ReadonlyArray<Address>;
  config?: Address;
  programId?: Address;
};

export type PrepareDisableCosignGatesResult = {
  instruction: Instruction;
  cosignGateControls: ReadonlyArray<Address>;
};

export async function prepareDisableCosignGates(
  input: PrepareDisableCosignGatesInput,
): Promise<PrepareDisableCosignGatesResult> {
  if (
    input.launches.length === 0 ||
    input.launches.length > DOPPLER_LAUNCH_HOOK_V2_MAX_COSIGN_GATE_DISABLES
  ) {
    throw new Error(
      `cosign gate disable batch must contain between 1 and ${DOPPLER_LAUNCH_HOOK_V2_MAX_COSIGN_GATE_DISABLES} launches`,
    );
  }
  if (new Set(input.launches).size !== input.launches.length) {
    throw new Error('cosign gate disable batch contains a duplicate launch');
  }

  const programId = input.programId ?? DOPPLER_LAUNCH_HOOK_V2_PROGRAM_ID;
  const cosignGateControls = await Promise.all(
    input.launches.map(async (launch) => {
      const [control] = await getDopplerLaunchHookV2CosignGateControlAddress(
        launch,
        programId,
      );
      return control;
    }),
  );
  const generatedInstruction = await getDisableCosignGatesInstructionAsync(
    {
      adminAuthority: input.adminAuthority,
      config: input.config,
      launches: [...input.launches],
    },
    { programAddress: programId },
  );
  const remainingAccounts = input.launches.flatMap((launch, index) => [
    { address: launch, role: AccountRole.READONLY },
    {
      address: cosignGateControls[index]!,
      role: AccountRole.WRITABLE,
    },
  ]);

  return {
    instruction: Object.freeze({
      ...generatedInstruction,
      accounts: [...generatedInstruction.accounts, ...remainingAccounts],
    }),
    cosignGateControls,
  };
}
