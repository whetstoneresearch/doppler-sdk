import {
  AccountRole,
  type AccountMeta,
  type AccountSignerMeta,
  type Address,
  type Instruction,
  type ReadonlyUint8Array,
  type TransactionSigner,
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
  DOPPLER_NATIVE_COSIGNER_HOOK_PROGRAM_ID,
  GATE_EXPIRY_UNIX_TIMESTAMP,
  encodeCosignerGateExpiryPayload,
  getCosignerHookConfigAddress,
} from '../cosignerHook/index.js';
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
  CPMM_HOOK_PROGRAM_ID,
  CURVE_KIND_XYK,
  CURVE_PARAMS_FORMAT_XYK_V0,
  EMPTY_REMAINING_ACCOUNTS_HASH,
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

type AddressOrSigner = InitializeLaunchAccounts['baseMint'];
type RemainingAccount =
  | Address
  | AccountMeta
  | AccountSignerMeta
  | TransactionSigner;

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

export type CreateLaunchHookMode = 'cpmm' | 'cosigner' | false;

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
        | 'cpmmMigratorProgram'
        | 'cpmmProgram'
        | 'cpmmHookProgram'
        | 'cosignerHookProgram'
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
  hook?: CreateLaunchHookMode | null;
  cosigner?: AddressOrSigner;
  cosignGateExpiresAt?: bigint | number | null;
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
  mode: CreateLaunchHookMode;
  cosignerConfig?: Address;
};

type ResolvedCreateLaunchHook = {
  program?: Address;
  flags: number;
  payload?: ReadonlyUint8Array;
  remainingAccounts?: ReadonlyArray<RemainingAccount>;
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

function isTransactionSigner(value: unknown): value is TransactionSigner {
  return (
    typeof value === 'object' &&
    value !== null &&
    'address' in value &&
    'signTransactions' in value
  );
}

function getAccountAddress(account: RemainingAccount): Address {
  if (typeof account === 'string') {
    return account;
  }
  return account.address;
}

function getSignerAddress(value: AddressOrSigner): Address {
  return isTransactionSigner(value) ? value.address : value;
}

function getRemainingAccountMeta(
  account: RemainingAccount,
): AccountMeta | AccountSignerMeta {
  if (typeof account === 'string') {
    return { address: account, role: AccountRole.READONLY };
  }
  if (isTransactionSigner(account)) {
    return {
      address: account.address,
      role: AccountRole.READONLY_SIGNER,
      signer: account,
    };
  }
  return account;
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
  return computeRemainingAccountsHash(accounts.map(getAccountAddress));
}

function isCustomMigrationConfig(
  migration: CreateLaunchMigrationConfig,
): migration is CreateLaunchCustomMigrationConfig {
  return migration.kind === 'custom';
}

function getCreateLaunchHookMode(
  input: CreateLaunchInput,
): CreateLaunchHookMode {
  if (input.hook !== undefined && input.hook !== null) {
    return input.hook;
  }
  return input.cosigner ? 'cosigner' : 'cpmm';
}

async function getCreateLaunchHookContext(
  input: CreateLaunchInput,
): Promise<CreateLaunchHookContext> {
  const mode = getCreateLaunchHookMode(input);
  if (mode !== 'cosigner') {
    return { mode };
  }
  const [cosignerConfig] = await getCosignerHookConfigAddress(
    input.deployment?.cosignerHookProgram ??
      DOPPLER_NATIVE_COSIGNER_HOOK_PROGRAM_ID,
  );
  return { mode, cosignerConfig };
}

function getCosignerHookRemainingAccounts({
  namespace,
  cosigner,
  cosignerConfig,
}: {
  namespace: Address;
  cosigner: AddressOrSigner;
  cosignerConfig: Address;
}): RemainingAccount[] {
  const accounts: RemainingAccount[] =
    namespace === cosignerConfig
      ? [cosignerConfig]
      : [namespace, cosignerConfig];
  accounts.push(cosigner);
  return accounts;
}

function resolveCosignerHookPayload(
  input: CreateLaunchInput,
): ReadonlyUint8Array {
  if (
    input.cosignGateExpiresAt === undefined ||
    input.cosignGateExpiresAt === null
  ) {
    return new Uint8Array();
  }
  if (!input.cosigner) {
    throw new Error('cosigner is required when cosignGateExpiresAt is set');
  }
  return encodeCosignerGateExpiryPayload({
    mode: GATE_EXPIRY_UNIX_TIMESTAMP,
    value: input.cosignGateExpiresAt,
    cosigner: getSignerAddress(input.cosigner),
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
  if (hookContext.mode === false) {
    return {
      flags: 0,
      remainingAccountsHash: EMPTY_REMAINING_ACCOUNTS_HASH,
    };
  }
  if (hookContext.mode === 'cosigner') {
    if (!input.cosigner) {
      throw new Error('cosigner is required when hook is "cosigner"');
    }
    if (!hookContext.cosignerConfig) {
      throw new Error('cosigner hook config could not be derived');
    }
    const remainingAccounts = getCosignerHookRemainingAccounts({
      namespace,
      cosigner: input.cosigner,
      cosignerConfig: hookContext.cosignerConfig,
    });
    return {
      program:
        input.deployment?.cosignerHookProgram ??
        DOPPLER_NATIVE_COSIGNER_HOOK_PROGRAM_ID,
      flags: HF_BEFORE_SWAP | HF_FORWARD_READONLY_SIGNERS,
      payload: resolveCosignerHookPayload(input),
      remainingAccounts,
      remainingAccountsHash:
        hashRemainingAccounts(remainingAccounts) ??
        EMPTY_REMAINING_ACCOUNTS_HASH,
    };
  }
  return {
    program: input.deployment?.cpmmHookProgram ?? CPMM_HOOK_PROGRAM_ID,
    flags: HF_BEFORE_SWAP,
    payload: new Uint8Array(),
    remainingAccountsHash: EMPTY_REMAINING_ACCOUNTS_HASH,
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
  const hookContext = await getCreateLaunchHookContext(input);
  const namespace =
    input.namespace ??
    hookContext.cosignerConfig ??
    getSignerAddress(input.payer);
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
      hookPayload: hook.payload ?? new Uint8Array(),
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
            getRemainingAccountMeta,
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
  };
}
