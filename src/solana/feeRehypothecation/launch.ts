import {
  type Address,
  type Instruction,
  type TransactionSigner,
} from '@solana/kit';

import type { DynamicFeeScheduleArgs } from '../dopplerLaunchHookV1/index.js';
import {
  DOPPLER_LAUNCH_HOOK_V2_GATE_UNIX_TIMESTAMP,
  encodeDopplerLaunchHookV2Payload,
  getDopplerLaunchHookV2RemainingAccounts,
  isResolvedManagedCosignerGateV2,
  type ResolvedManagedCosignerGateV2,
} from '../dopplerLaunchHookV2/index.js';
import { getInitializeRehypeInstructionAsync } from '../dopplerRehypeRouterV1/index.js';
import {
  DOPPLER_SOLANA_DEVNET_FEE_REHYPOTHECATION_PROGRAM_ADDRESSES,
  deriveSolanaFeeRehypothecationDeployment,
  type SolanaFeeRehypothecationDeployment,
} from '../deployment.js';
import {
  HF_BEFORE_CREATE,
  HF_BEFORE_MIGRATE,
  HF_BEFORE_SWAP,
  HF_FORWARD_READONLY_SIGNERS,
  HF_LAUNCH_CONTEXT_V2,
} from '../initializer/constants.js';
import {
  createLaunchId,
  createLaunchWithResolvedHook,
  type CreateLaunchAccountSigners,
  type CreateLaunchAddresses,
  type CreateLaunchInput,
} from '../initializer/createLaunch.js';
import type { CurveSwapHook } from '../swaps.js';
import {
  deriveFeeRehypothecationAddresses,
  type FeeRehypothecationAddresses,
} from './pda.js';
import {
  validateAndSortFeeRehypothecationBeneficiaries,
  validateFeeRehypothecationStrategy,
  type FeeRehypothecationStrategy,
} from './strategies.js';
import type { RehypeBeneficiaryInputArgs } from '../dopplerRehypeRouterV1/index.js';

type PrepareLaunchBaseInput = Omit<
  CreateLaunchInput,
  | 'addresses'
  | 'authority'
  | 'config'
  | 'cosignerGate'
  | 'deployment'
  | 'dynamicFee'
  | 'feeBeneficiaries'
  | 'launchAccounts'
  | 'migration'
  | 'payer'
  | 'programId'
>;

export type PrepareFeeRehypothecationLaunchInput = PrepareLaunchBaseInput & {
  deployment?: SolanaFeeRehypothecationDeployment;
  launchAccounts: Omit<CreateLaunchAccountSigners, 'baseMint'> & {
    baseMint: TransactionSigner;
  };
  payer: TransactionSigner;
  authority: TransactionSigner;
  buybackDestination: Address;
  settlementAuthority: Address;
  beneficiaries: ReadonlyArray<RehypeBeneficiaryInputArgs>;
  strategy: FeeRehypothecationStrategy;
  dynamicFee?: DynamicFeeScheduleArgs | null;
  cosignerGate?: ResolvedManagedCosignerGateV2 | null;
};

export type PrepareFeeRehypothecationLaunchResult = {
  namespace: Address;
  launchId: Uint8Array;
  launchAddresses: CreateLaunchAddresses;
  routingAddresses: FeeRehypothecationAddresses;
  initializeRoutingInstruction: Instruction;
  initializeLaunchInstruction: Instruction;
  unsignedSwapHook: CurveSwapHook;
  /** Pass the configured signer while the gate is active; omit it after expiry. */
  getSwapHook(cosigner?: TransactionSigner): CurveSwapHook;
};

export async function prepareLaunch(
  input: PrepareFeeRehypothecationLaunchInput,
): Promise<PrepareFeeRehypothecationLaunchResult> {
  if (
    input.supply.baseForDistribution !== 0n ||
    input.supply.baseForLiquidity !== 0n
  ) {
    throw new Error(
      'non-migrating fee rehypothecation launches require zero distribution and liquidity reserves',
    );
  }
  validateFeeRehypothecationStrategy(input.strategy);
  const beneficiaries = validateAndSortFeeRehypothecationBeneficiaries(
    input.beneficiaries,
    input.strategy,
  );
  const deployment =
    input.deployment ??
    (await deriveSolanaFeeRehypothecationDeployment(
      DOPPLER_SOLANA_DEVNET_FEE_REHYPOTHECATION_PROGRAM_ADDRESSES,
    ));
  const launchId = input.launchId ?? createLaunchId();
  const namespace = input.namespace ?? deployment.dopplerRehypeRouterV1Program;
  const routingAddresses = await deriveFeeRehypothecationAddresses(
    input.launchAccounts.baseMint.address,
    deployment.dopplerRehypeRouterV1Program,
  );

  const gate = input.cosignerGate ?? undefined;
  if (gate && !isResolvedManagedCosignerGateV2(gate)) {
    throw new Error(
      'cosignerGate must be returned by dopplerLaunchHookV2.resolveManagedCosignerGate',
    );
  }
  if (
    gate &&
    (gate.programId !== deployment.dopplerLaunchHookV2Program ||
      gate.config !== deployment.dopplerLaunchHookV2Config)
  ) {
    throw new Error('cosignerGate does not match the selected deployment');
  }

  const remainingAccounts = getDopplerLaunchHookV2RemainingAccounts({
    namespace,
    config: deployment.dopplerLaunchHookV2Config,
    feeRehypothecationState: routingAddresses.state,
    settlementSigner: routingAddresses.settlementSigner,
    cosigner: gate?.cosigner,
  });
  const payload = encodeDopplerLaunchHookV2Payload({
    dynamicFee: input.dynamicFee,
    cosignerGate: gate
      ? {
          mode: DOPPLER_LAUNCH_HOOK_V2_GATE_UNIX_TIMESTAMP,
          value: gate.expiresAt,
          cosigner: gate.cosigner,
        }
      : null,
    feeRehypothecationState: routingAddresses.state,
  });
  const initializeRoutingInstruction =
    await getInitializeRehypeInstructionAsync(
      {
        payer: input.payer,
        baseMint: input.launchAccounts.baseMint,
        quoteMint: input.launchAccounts.quoteMint,
        hookProgram: deployment.dopplerLaunchHookV2Program,
        initializerProgram: deployment.initializerProgram,
        rehypeState: routingAddresses.state,
        rehypeAuthority: routingAddresses.authority,
        settlementSigner: routingAddresses.settlementSigner,
        namespace,
        launchId,
        buybackDestination: input.buybackDestination,
        settlementAuthority: input.settlementAuthority,
        routingMode: input.strategy.routingMode,
        feeRouting: input.strategy.feeRouting,
        beneficiaries,
      },
      { programAddress: deployment.dopplerRehypeRouterV1Program },
    );
  const launchInput: CreateLaunchInput = {
    deployment: {
      initializerProgram: deployment.initializerProgram,
      initializerConfig: deployment.initializerConfig,
    },
    namespace,
    launchId,
    launchAccounts: input.launchAccounts,
    payer: input.payer,
    authority: input.authority,
    supply: input.supply,
    curve: input.curve,
    tokenPrograms: input.tokenPrograms,
    metadata: input.metadata,
    allowBuy: input.allowBuy,
    allowSell: input.allowSell,
    systemProgram: input.systemProgram,
    rent: input.rent,
    metadataProgram: input.metadataProgram,
    migration: false,
    feeBeneficiaries: [
      { wallet: routingAddresses.authority, shareBps: 10_000 },
    ],
  };
  const launch = await createLaunchWithResolvedHook(launchInput, {
    program: deployment.dopplerLaunchHookV2Program,
    flags:
      HF_BEFORE_CREATE |
      HF_BEFORE_SWAP |
      HF_BEFORE_MIGRATE |
      HF_FORWARD_READONLY_SIGNERS |
      HF_LAUNCH_CONTEXT_V2,
    payload,
    remainingAccountsHash: remainingAccounts.hookRemainingAccountsHash,
    createRemainingAccounts: remainingAccounts.unsignedHookRemainingAccounts,
  });

  const getSwapHook = (cosigner?: TransactionSigner): CurveSwapHook => {
    if (cosigner && !gate) {
      throw new Error('this launch does not have a cosigner gate');
    }
    if (cosigner && cosigner.address !== gate?.cosigner) {
      throw new Error(
        `cosigner ${cosigner.address} does not match the launch cosigner ${gate?.cosigner}`,
      );
    }
    const swapAccounts = getDopplerLaunchHookV2RemainingAccounts({
      namespace,
      config: deployment.dopplerLaunchHookV2Config,
      feeRehypothecationState: routingAddresses.state,
      settlementSigner: routingAddresses.settlementSigner,
      cosigner: cosigner ?? gate?.cosigner,
    });
    return {
      program: deployment.dopplerLaunchHookV2Program,
      remainingAccounts: cosigner
        ? swapAccounts.signedHookRemainingAccounts
        : swapAccounts.unsignedHookRemainingAccounts,
    };
  };
  const unsignedSwapHook = getSwapHook();

  return {
    namespace,
    launchId,
    launchAddresses: launch.addresses,
    routingAddresses,
    initializeRoutingInstruction,
    initializeLaunchInstruction: launch.instruction,
    unsignedSwapHook,
    getSwapHook,
  };
}
