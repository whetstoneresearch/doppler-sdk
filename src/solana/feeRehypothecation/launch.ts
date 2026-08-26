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
  getDopplerLaunchHookV2CosignGateControlAddress,
  isResolvedManagedCosignerGateV2,
  type ResolvedManagedCosignerGateV2,
} from '../dopplerLaunchHookV2/index.js';
import { getInitializeRehypeInstructionAsync } from '../dopplerRehypeRouterV1/index.js';
import { TOKEN_PROGRAM_ADDRESS } from '../core/constants.js';
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
  deriveCreateLaunchAddresses,
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
import { DOPPLER_VESTING_PROGRAM_ADDRESS } from '../generated/dopplerVesting/index.js';
import {
  prepareVestingConfiguration,
  type VestingPlan,
} from '../vesting/internal.js';
import type { VestingAddresses } from '../vesting/pda.js';

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
  | 'vestingConfig'
>;

export type PrepareFeeRehypothecationLaunchInput = PrepareLaunchBaseInput & {
  deployment?: SolanaFeeRehypothecationDeployment;
  launchAccounts: Omit<CreateLaunchAccountSigners, 'baseMint'> & {
    baseMint: TransactionSigner;
  };
  payer: TransactionSigner;
  authority: TransactionSigner;
  buybackDestination: Address;
  settlementAuthority: TransactionSigner;
  beneficiaries: ReadonlyArray<RehypeBeneficiaryInputArgs>;
  strategy: FeeRehypothecationStrategy;
  dynamicFee?: DynamicFeeScheduleArgs | null;
  cosignerGate?: ResolvedManagedCosignerGateV2 | null;
  /** Immutable vesting funded from the launch's initial base supply. */
  vesting?: VestingPlan;
  /** Vesting deployment override for custom protocol deployments. */
  vestingProgram?: Address;
};

export type PreparedFeeRehypothecationVesting = {
  addresses: VestingAddresses;
  totalAllocation: bigint;
  initializeInstruction: Instruction;
  fundInstruction: Instruction;
};

export type PrepareFeeRehypothecationLaunchResult = {
  namespace: Address;
  launchId: Uint8Array;
  launchAddresses: CreateLaunchAddresses;
  routingAddresses: FeeRehypothecationAddresses;
  initializeRoutingInstruction: Instruction;
  initializeLaunchInstruction: Instruction;
  vesting?: PreparedFeeRehypothecationVesting;
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
  const launchAddresses = await deriveCreateLaunchAddresses({
    deployment: {
      initializerProgram: deployment.initializerProgram,
      initializerConfig: deployment.initializerConfig,
    },
    namespace,
    launchId,
    baseMint: input.launchAccounts.baseMint,
    metadata: input.metadata,
  });
  const routingAddresses = await deriveFeeRehypothecationAddresses(
    input.launchAccounts.baseMint.address,
    deployment.dopplerRehypeRouterV1Program,
  );
  const preparedVesting = input.vesting
    ? await prepareVestingConfiguration({
        payer: input.payer,
        launch: launchAddresses.launch,
        launchAuthority: launchAddresses.launchAuthority,
        baseMint: input.launchAccounts.baseMint,
        baseVault: input.launchAccounts.baseVault,
        baseTokenProgram:
          input.tokenPrograms?.baseTokenProgram ?? TOKEN_PROGRAM_ADDRESS,
        initialSupply: input.supply.baseTotalSupply,
        plan: input.vesting,
        vestingProgram: input.vestingProgram ?? DOPPLER_VESTING_PROGRAM_ADDRESS,
        initializerProgram: deployment.initializerProgram,
      })
    : undefined;
  if (
    preparedVesting &&
    preparedVesting.totalAllocation >= preparedVesting.initialSupply
  ) {
    throw new Error(
      'vesting allocations must leave base tokens for the bonding curve',
    );
  }

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
  const cosignGateControl = gate
    ? (
        await getDopplerLaunchHookV2CosignGateControlAddress(
          launchAddresses.launch,
          deployment.dopplerLaunchHookV2Program,
        )
      )[0]
    : undefined;

  const remainingAccounts = getDopplerLaunchHookV2RemainingAccounts({
    namespace,
    config: deployment.dopplerLaunchHookV2Config,
    feeRehypothecationState: routingAddresses.state,
    settlementSigner: routingAddresses.settlementSigner,
    cosignGateControl,
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
    addresses: launchAddresses,
    launchAccounts: input.launchAccounts,
    payer: input.payer,
    authority: input.authority,
    supply: {
      ...input.supply,
      baseForDistribution: preparedVesting?.totalAllocation ?? 0n,
    },
    curve: input.curve,
    tokenPrograms: input.tokenPrograms,
    metadata: input.metadata,
    allowBuy: input.allowBuy,
    allowSell: input.allowSell,
    systemProgram: input.systemProgram,
    rent: input.rent,
    metadataProgram: input.metadataProgram,
    migration: false,
    vestingConfig: preparedVesting?.addresses.config,
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
      cosignGateControl,
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
    vesting: preparedVesting
      ? {
          addresses: preparedVesting.addresses,
          totalAllocation: preparedVesting.totalAllocation,
          initializeInstruction: preparedVesting.initializeInstruction,
          fundInstruction: preparedVesting.fundInstruction,
        }
      : undefined,
    unsignedSwapHook,
    getSwapHook,
  };
}
