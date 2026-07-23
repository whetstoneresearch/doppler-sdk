import {
  type Address,
  type Instruction,
  type ReadonlyUint8Array,
} from '@solana/kit';
import { findAssociatedTokenPda } from '@solana-program/token';
import {
  SYSVAR_RENT_ADDRESS,
  SYSTEM_PROGRAM_ADDRESS,
  TOKEN_2022_PROGRAM_ADDRESS,
  TOKEN_PROGRAM_ADDRESS,
  TOKEN_METADATA_PROGRAM_ID,
} from '../core/constants.js';
import {
  CPMM_HOOK_PROGRAM_ID,
  GATE_EXPIRY_UNIX_TIMESTAMP,
  encodeCpmmHookPayload,
  getCpmmHookRemainingAccounts,
  isResolvedManagedCosignerGate,
  type CpmmHookPayloadArgs,
  type DynamicFeeScheduleArgs,
  type ResolvedManagedCosignerGate,
} from '../cpmmHook/index.js';
import type { SolanaCpmmDeployment } from '../deployment.js';
import {
  buildCpmmMigrationRemainingAccounts,
  encodeMigratePayload,
  encodeRegisterLaunchPayload,
  type CpmmMigrationRemainingAccounts,
  type MigratedPoolHookConfigArgs,
  type RecipientArgs,
} from '../migrators/cpmmMigrator/index.js';
import { CPMM_MIGRATOR_PROGRAM_ID } from '../migrators/cpmmMigrator/constants.js';
import { getCpmmMigratorStateAddress } from '../migrators/cpmmMigrator/pda.js';
import {
  CURVE_KIND_XYK,
  CURVE_PARAMS_FORMAT_XYK_V0,
  EMPTY_REMAINING_ACCOUNTS_HASH,
  HF_BEFORE_CREATE,
  HF_BEFORE_SWAP,
  HF_FORWARD_READONLY_SIGNERS,
  INITIALIZER_PROGRAM_ID,
} from './constants.js';
import {
  createInitializeLaunchInstruction,
  getTokenMetadataAddress,
  type InitializeLaunchAccounts,
  type InitializeLaunchParams,
} from './instructions/initializeLaunch.js';
import {
  getConfigAddress,
  getLaunchAddress,
  getLaunchAuthorityAddress,
  getLaunchFeeStateAddress,
} from './pda.js';
import { computeRemainingAccountsHash } from './helpers.js';
import {
  createReadonlyRemainingAccountMeta,
  getAddressFromAddressOrSigner,
  getAddressFromRemainingAccount,
  type RemainingAccount,
} from '../core/accounts.js';

type AddressOrSigner = InitializeLaunchAccounts['baseMint'];

const DEFAULT_CPMM_MIGRATION_FEE_SPLIT_BPS = 10_000;

export type LaunchTokenPrograms = {
  baseTokenProgram: Address;
  quoteTokenProgram: Address;
};

export type LaunchSupply = {
  baseDecimals: number;
  baseTotalSupply: bigint;
  baseForDistribution: bigint;
  baseForLiquidity: bigint;
};

export type XykCurveConfig = {
  curveVirtualBase: bigint;
  curveVirtualQuote: bigint;
  swapFeeBps: number;
};

export type LaunchMetadata = {
  metadataName: string;
  metadataSymbol: string;
  metadataUri: string;
};

export type CreateLaunchAccountSigners = {
  baseMint: AddressOrSigner;
  quoteMint: Address;
  baseVault: AddressOrSigner;
  quoteVault: AddressOrSigner;
};

export type CreateLaunchCpmmMigrationConfig = {
  enabled?: true;
  kind?: 'cpmm';
  program?: Address;
  cpmmProgram?: Address;
  admin?: Address;
  adminBaseAta?: Address;
  adminQuoteAta?: Address;
  recipientAtas?: ReadonlyArray<Address>;
  recipients?: ReadonlyArray<RecipientArgs>;
  minRaiseQuote?: number | bigint;
  minMigrationPriceQ64Opt?: number | bigint | null;
  migratedPoolHookConfig?: MigratedPoolHookConfigArgs | null;
  initialSwapFeeBps?: number;
  initialFeeSplitBps?: number;
  baseForDistribution?: number | bigint;
  baseForLiquidity?: number | bigint;
};

export type CreateLaunchCustomMigrationConfig = {
  enabled?: true;
  kind: 'custom';
  program: Address;
  initPayload?: ReadonlyUint8Array;
  migratePayload?: ReadonlyUint8Array;
  cpmmConfig?: Address;
  initRemainingAccounts?: ReadonlyArray<RemainingAccount>;
  initRemainingAccountsHash?: ReadonlyUint8Array;
  remainingAccounts?: ReadonlyArray<RemainingAccount>;
  remainingAccountsHash?: ReadonlyUint8Array;
};

export type CreateLaunchMigrationConfig =
  | CreateLaunchCpmmMigrationConfig
  | CreateLaunchCustomMigrationConfig;

export type CreateLaunchAddresses = {
  config: Address;
  launch: Address;
  launchAuthority: Address;
  launchFeeState: Address;
  metadataAccount?: Address;
};

export type DeriveCreateLaunchAddressesInput = {
  deployment?: Pick<
    SolanaCpmmDeployment,
    'initializerConfig' | 'initializerProgram'
  >;
  programId?: Address;
  config?: Address;
  namespace: Address;
  launchId: Uint8Array;
  baseMint: AddressOrSigner;
  metadata?: LaunchMetadata | null;
  metadataAccount?: Address;
};

export type CreateLaunchInput = {
  deployment?: Pick<
    SolanaCpmmDeployment,
    'initializerConfig' | 'initializerProgram'
  > &
    Partial<
      Pick<
        SolanaCpmmDeployment,
        'cpmmMigratorProgram' | 'cpmmProgram' | 'cpmmHookProgram'
      >
    >;
  programId?: Address;
  config?: Address;
  namespace?: Address;
  launchId?: Uint8Array;
  addresses?: CreateLaunchAddresses;
  launchAccounts: CreateLaunchAccountSigners;
  payer: AddressOrSigner;
  authority?: AddressOrSigner;
  supply: LaunchSupply;
  curve: XykCurveConfig;
  tokenPrograms?: Partial<LaunchTokenPrograms>;
  /**
   * Enables the Doppler-managed cosigner gate. Resolve this value with
   * `cpmmHook.resolveManagedCosignerGate` before constructing the launch.
   */
  cosignerGate?: ResolvedManagedCosignerGate | null;
  dynamicFee?: DynamicFeeScheduleArgs | null;
  migration?: boolean | CreateLaunchMigrationConfig | null;
  metadata?: LaunchMetadata | null;
  feeBeneficiaries?: InitializeLaunchParams['feeBeneficiaries'];
  allowBuy?: boolean;
  allowSell?: boolean;
  systemProgram?: Address;
  rent?: Address;
  metadataProgram?: Address;
};

export type CreateLaunchResult = {
  namespace: Address;
  launchId: Uint8Array;
  addresses: CreateLaunchAddresses;
  instruction: Instruction;
  cpmmMigration?: CpmmMigrationRemainingAccounts;
  cosignerGate?: ResolvedManagedCosignerGate;
};

type ResolvedCreateLaunchMigration = {
  program: Address;
  initPayload?: ReadonlyUint8Array;
  migratePayload?: ReadonlyUint8Array;
  cpmmConfig?: Address;
  initRemainingAccounts?: ReadonlyArray<RemainingAccount>;
  initRemainingAccountsHash?: ReadonlyUint8Array;
  remainingAccounts?: ReadonlyArray<RemainingAccount>;
  remainingAccountsHash?: ReadonlyUint8Array;
  cpmmMigration?: CpmmMigrationRemainingAccounts;
};

type CreateLaunchHookContext = {
  program: Address;
  cosignerGate?: ResolvedManagedCosignerGate;
};

type ResolvedCreateLaunchHook = {
  program: Address;
  flags: number;
  payload: ReadonlyUint8Array;
  remainingAccountsHash: ReadonlyUint8Array;
};

let launchIdCounter = 0n;

export const launchTokenPrograms = {
  splToken(): LaunchTokenPrograms {
    return {
      baseTokenProgram: TOKEN_PROGRAM_ADDRESS,
      quoteTokenProgram: TOKEN_PROGRAM_ADDRESS,
    };
  },
  token2022Base(): LaunchTokenPrograms {
    return {
      baseTokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
      quoteTokenProgram: TOKEN_PROGRAM_ADDRESS,
    };
  },
} as const;

export function createLaunchId(): Uint8Array {
  const bytes = new Uint8Array(32);
  const view = new DataView(bytes.buffer);
  view.setBigUint64(0, BigInt(Date.now()), true);
  view.setBigUint64(8, launchIdCounter, true);
  launchIdCounter += 1n;
  bytes.set([0x44, 0x4f, 0x50, 0x4c], 28);
  return bytes;
}

function getSignerAddress(value: AddressOrSigner): Address {
  return getAddressFromAddressOrSigner(value);
}

function hasMetadata(metadata: LaunchMetadata | null | undefined): boolean {
  return Boolean(metadata?.metadataName);
}

function getInitializerProgramId(
  input: Pick<CreateLaunchInput, 'deployment' | 'programId'>,
): Address {
  return (
    input.programId ??
    input.deployment?.initializerProgram ??
    INITIALIZER_PROGRAM_ID
  );
}

function getInitializerConfig(
  input: Pick<CreateLaunchInput, 'deployment' | 'config'>,
): Address | undefined {
  return input.config ?? input.deployment?.initializerConfig;
}

function hashRemainingAccounts(
  accounts: ReadonlyArray<RemainingAccount> | undefined,
): Uint8Array | undefined {
  if (!accounts) {
    return undefined;
  }
  return computeRemainingAccountsHash(
    accounts.map(getAddressFromRemainingAccount),
  );
}

function isCustomMigrationConfig(
  migration: CreateLaunchMigrationConfig,
): migration is CreateLaunchCustomMigrationConfig {
  return migration.kind === 'custom';
}

function getCreateLaunchHookContext(
  input: CreateLaunchInput,
): CreateLaunchHookContext {
  const program = input.deployment?.cpmmHookProgram ?? CPMM_HOOK_PROGRAM_ID;
  if (!input.cosignerGate) {
    return { program };
  }
  if (!isResolvedManagedCosignerGate(input.cosignerGate)) {
    throw new Error(
      'cosignerGate must be returned by cpmmHook.resolveManagedCosignerGate',
    );
  }
  if (input.cosignerGate.programId !== program) {
    throw new Error(
      `managed cosigner gate was resolved for ${input.cosignerGate.programId}, expected ${program}`,
    );
  }

  return { program, cosignerGate: input.cosignerGate };
}

function resolveCpmmHookPayload(
  input: CreateLaunchInput,
  hookContext: CreateLaunchHookContext,
): ReadonlyUint8Array {
  let gateExpiry: CpmmHookPayloadArgs['gateExpiry'] = null;
  const cosignerGate = hookContext.cosignerGate;
  const expiresAt = cosignerGate?.expiresAt;
  if (cosignerGate && expiresAt !== undefined && expiresAt !== null) {
    gateExpiry = {
      mode: GATE_EXPIRY_UNIX_TIMESTAMP,
      value: expiresAt,
      cosigner: cosignerGate.cosigner,
    };
  }

  return encodeCpmmHookPayload({
    schedule: input.dynamicFee ?? null,
    gateExpiry,
  });
}

function resolveCreateLaunchHook({
  input,
  namespace,
  hookContext,
}: {
  input: CreateLaunchInput;
  namespace: Address;
  hookContext: CreateLaunchHookContext;
}): ResolvedCreateLaunchHook {
  const hasCosigner = hookContext.cosignerGate !== undefined;
  const hasSchedule = Boolean(input.dynamicFee);
  const remainingAccounts = getCpmmHookRemainingAccounts({
    namespace,
    config: hookContext.cosignerGate?.config,
    cosigner: hookContext.cosignerGate?.cosigner,
  });

  return {
    program: hookContext.program,
    flags:
      HF_BEFORE_SWAP |
      (hasSchedule ? HF_BEFORE_CREATE : 0) |
      (hasCosigner ? HF_FORWARD_READONLY_SIGNERS : 0),
    payload: resolveCpmmHookPayload(input, hookContext),
    remainingAccountsHash: remainingAccounts.hookRemainingAccountsHash,
  };
}

async function getAssociatedTokenAddress({
  owner,
  mint,
  tokenProgram,
}: {
  owner: Address;
  mint: Address;
  tokenProgram: Address;
}): Promise<Address> {
  const [ata] = await findAssociatedTokenPda({
    owner,
    mint,
    tokenProgram,
  });
  return ata;
}

async function resolveCreateLaunchMigration({
  addresses,
  input,
  tokenPrograms,
}: {
  addresses: CreateLaunchAddresses;
  input: CreateLaunchInput;
  tokenPrograms: LaunchTokenPrograms;
}): Promise<ResolvedCreateLaunchMigration | null> {
  const migration = input.migration === undefined ? true : input.migration;
  if (migration === false || migration === null) {
    return null;
  }

  const cpmmMigratorProgram =
    input.deployment?.cpmmMigratorProgram ?? CPMM_MIGRATOR_PROGRAM_ID;
  if (migration !== true && isCustomMigrationConfig(migration)) {
    if (!migration.program) {
      throw new Error('custom launch migration requires a migrator program');
    }
    return migration;
  }

  const cpmmMigration = migration === true ? {} : migration;
  const admin = cpmmMigration.admin ?? getSignerAddress(input.payer);
  const baseMint = getSignerAddress(input.launchAccounts.baseMint);
  const adminBaseAta =
    cpmmMigration.adminBaseAta ??
    (await getAssociatedTokenAddress({
      owner: admin,
      mint: baseMint,
      tokenProgram: tokenPrograms.baseTokenProgram,
    }));
  const adminQuoteAta =
    cpmmMigration.adminQuoteAta ??
    (await getAssociatedTokenAddress({
      owner: admin,
      mint: input.launchAccounts.quoteMint,
      tokenProgram: tokenPrograms.quoteTokenProgram,
    }));
  const recipients = [...(cpmmMigration.recipients ?? [])];
  const recipientAtas =
    cpmmMigration.recipientAtas ??
    (await Promise.all(
      recipients.map(({ wallet }) =>
        getAssociatedTokenAddress({
          owner: wallet,
          mint: baseMint,
          tokenProgram: tokenPrograms.baseTokenProgram,
        }),
      ),
    ));
  const migrationAccounts = await buildCpmmMigrationRemainingAccounts({
    launch: addresses.launch,
    baseMint,
    quoteMint: input.launchAccounts.quoteMint,
    launchAuthority: addresses.launchAuthority,
    adminBaseAta,
    adminQuoteAta,
    recipientAtas: [...recipientAtas],
    cpmmProgram: cpmmMigration.cpmmProgram ?? input.deployment?.cpmmProgram,
    cpmmMigratorProgram: cpmmMigration.program ?? cpmmMigratorProgram,
  });
  const initPayload = encodeRegisterLaunchPayload({
    cpmmConfig: migrationAccounts.cpmmConfig,
    initialSwapFeeBps:
      cpmmMigration.initialSwapFeeBps ?? input.curve.swapFeeBps,
    initialFeeSplitBps:
      cpmmMigration.initialFeeSplitBps ?? DEFAULT_CPMM_MIGRATION_FEE_SPLIT_BPS,
    recipients,
    minRaiseQuote: cpmmMigration.minRaiseQuote ?? 0n,
    minMigrationPriceQ64Opt: cpmmMigration.minMigrationPriceQ64Opt ?? null,
    migratedPoolHookConfig: cpmmMigration.migratedPoolHookConfig ?? null,
  });
  const migratePayload = encodeMigratePayload({
    baseForDistribution:
      cpmmMigration.baseForDistribution ?? input.supply.baseForDistribution,
    baseForLiquidity:
      cpmmMigration.baseForLiquidity ?? input.supply.baseForLiquidity,
  });

  return {
    program: cpmmMigration.program ?? cpmmMigratorProgram,
    initPayload,
    migratePayload,
    cpmmConfig: migrationAccounts.cpmmConfig,
    remainingAccounts: migrationAccounts.addresses,
    remainingAccountsHash: migrationAccounts.hash,
    cpmmMigration: migrationAccounts,
  };
}

export async function deriveCreateLaunchAddresses(
  input: DeriveCreateLaunchAddressesInput,
): Promise<CreateLaunchAddresses> {
  const programId =
    input.programId ??
    input.deployment?.initializerProgram ??
    INITIALIZER_PROGRAM_ID;
  const config =
    input.config ??
    input.deployment?.initializerConfig ??
    (await getConfigAddress(programId))[0];
  const [launch] = await getLaunchAddress(
    input.namespace,
    input.launchId,
    programId,
  );
  const [launchAuthority] = await getLaunchAuthorityAddress(launch, programId);
  const [launchFeeState] = await getLaunchFeeStateAddress(launch, programId);
  const metadataAccount = hasMetadata(input.metadata)
    ? (input.metadataAccount ??
      (await getTokenMetadataAddress(getSignerAddress(input.baseMint))))
    : input.metadataAccount;

  return {
    config,
    launch,
    launchAuthority,
    launchFeeState,
    metadataAccount,
  };
}

async function getMigrationInitRemainingAccountsHash({
  launch,
  migration,
}: {
  launch: Address;
  migration: ResolvedCreateLaunchMigration | null | undefined;
}): Promise<ReadonlyUint8Array> {
  if (!migration) {
    return EMPTY_REMAINING_ACCOUNTS_HASH;
  }
  if (migration.initRemainingAccountsHash) {
    return migration.initRemainingAccountsHash;
  }
  const initHash = hashRemainingAccounts(migration.initRemainingAccounts);
  if (initHash) {
    return initHash;
  }
  if (migration.cpmmConfig) {
    const migratorProgram = migration.program ?? CPMM_MIGRATOR_PROGRAM_ID;
    const [cpmmMigrationState] = await getCpmmMigratorStateAddress(
      launch,
      migratorProgram,
    );
    return computeRemainingAccountsHash([
      cpmmMigrationState,
      migration.cpmmConfig,
    ]);
  }
  return EMPTY_REMAINING_ACCOUNTS_HASH;
}

export async function createLaunch(
  input: CreateLaunchInput,
): Promise<CreateLaunchResult> {
  const programId = getInitializerProgramId(input);
  const launchId = input.launchId ?? createLaunchId();
  const hookContext = getCreateLaunchHookContext(input);
  const namespace = input.namespace ?? SYSTEM_PROGRAM_ADDRESS;
  const tokenPrograms = {
    ...launchTokenPrograms.splToken(),
    ...input.tokenPrograms,
  };
  const addresses =
    input.addresses ??
    (await deriveCreateLaunchAddresses({
      deployment: input.deployment,
      programId,
      config: getInitializerConfig(input),
      namespace,
      launchId,
      baseMint: input.launchAccounts.baseMint,
      metadata: input.metadata,
    }));
  const migration = await resolveCreateLaunchMigration({
    addresses,
    input,
    tokenPrograms,
  });
  const hook = resolveCreateLaunchHook({
    input,
    namespace,
    hookContext,
  });
  const migratorInitRemainingAccountsHash =
    await getMigrationInitRemainingAccountsHash({
      launch: addresses.launch,
      migration,
    });
  const migratorRemainingAccountsHash =
    migration?.remainingAccountsHash ??
    hashRemainingAccounts(migration?.remainingAccounts) ??
    EMPTY_REMAINING_ACCOUNTS_HASH;

  const instruction = await createInitializeLaunchInstruction(
    {
      config: addresses.config,
      launch: addresses.launch,
      launchAuthority: addresses.launchAuthority,
      baseMint: input.launchAccounts.baseMint,
      quoteMint: input.launchAccounts.quoteMint,
      baseVault: input.launchAccounts.baseVault,
      quoteVault: input.launchAccounts.quoteVault,
      launchFeeState: addresses.launchFeeState,
      payer: input.payer,
      authority: input.authority,
      hookProgram: hook.program,
      migratorProgram: migration?.program,
      cpmmConfig: migration?.cpmmConfig,
      baseTokenProgram: tokenPrograms.baseTokenProgram,
      quoteTokenProgram: tokenPrograms.quoteTokenProgram,
      systemProgram: input.systemProgram ?? SYSTEM_PROGRAM_ADDRESS,
      rent: input.rent ?? SYSVAR_RENT_ADDRESS,
      metadataAccount: addresses.metadataAccount,
      metadataProgram: input.metadataProgram ?? TOKEN_METADATA_PROGRAM_ID,
    },
    {
      namespace,
      launchId,
      baseDecimals: input.supply.baseDecimals,
      baseTotalSupply: input.supply.baseTotalSupply,
      baseForDistribution: input.supply.baseForDistribution,
      baseForLiquidity: input.supply.baseForLiquidity,
      curveVirtualBase: input.curve.curveVirtualBase,
      curveVirtualQuote: input.curve.curveVirtualQuote,
      swapFeeBps: input.curve.swapFeeBps,
      curveKind: CURVE_KIND_XYK,
      curveParams: new Uint8Array([CURVE_PARAMS_FORMAT_XYK_V0]),
      allowBuy: input.allowBuy ?? true,
      allowSell: input.allowSell ?? true,
      hookFlags: hook.flags,
      hookPayload: hook.payload,
      migratorInitPayload: migration?.initPayload ?? new Uint8Array(),
      migratorMigratePayload: migration?.migratePayload ?? new Uint8Array(),
      hookRemainingAccountsHash: hook.remainingAccountsHash,
      migratorInitRemainingAccountsHash,
      migratorRemainingAccountsHash,
      feeBeneficiaries: input.feeBeneficiaries ?? [],
      metadataName: input.metadata?.metadataName ?? '',
      metadataSymbol: input.metadata?.metadataSymbol ?? '',
      metadataUri: input.metadata?.metadataUri ?? '',
    },
    programId,
  );

  const preparedInstruction = migration?.initRemainingAccounts
    ? {
        ...instruction,
        accounts: [
          ...(instruction.accounts ?? []),
          ...(migration?.initRemainingAccounts ?? []).map(
            createReadonlyRemainingAccountMeta,
          ),
        ],
      }
    : instruction;

  return {
    namespace,
    launchId,
    addresses,
    instruction: preparedInstruction,
    cpmmMigration: migration?.cpmmMigration,
    ...(hookContext.cosignerGate
      ? { cosignerGate: hookContext.cosignerGate }
      : {}),
  };
}
