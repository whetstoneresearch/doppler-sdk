import type {
  Address,
  Instruction,
  AccountMeta,
  TransactionSigner,
  AccountSignerMeta,
  ReadonlyUint8Array,
} from '@solana/kit';
import {
  AccountRole,
  getProgramDerivedAddress,
  getAddressEncoder,
} from '@solana/kit';
import {
  SYSTEM_PROGRAM_ADDRESS,
  TOKEN_PROGRAM_ADDRESS,
  TOKEN_METADATA_PROGRAM_ID,
} from '../../core/constants.js';
import {
  CURVE_KIND_XYK,
  CURVE_PARAMS_FORMAT_XYK_V0,
  INITIALIZER_PROGRAM_ID,
  SF_AFTER_CREATE,
  SF_BEFORE_CREATE,
} from '../constants.js';
import { computeRemainingAccountsHash } from '../helpers.js';
import { CPMM_MIGRATOR_PROGRAM_ID } from '../../migrators/cpmmMigrator/constants.js';
import { getCpmmMigratorStateAddress } from '../../migrators/cpmmMigrator/pda.js';
import { PREDICTION_MIGRATOR_PROGRAM_ADDRESS } from '../../generated/predictionMigrator/programs/predictionMigrator.js';
import {
  getPredictionMarketAddress,
  getPredictionMarketAuthorityAddress,
  getPredictionPotVaultAddress,
  getPredictionEntryAddress,
  getPredictionEntryByMintAddress,
} from '../../migrators/predictionMigrator/pda.js';
import type { InitializeLaunchArgsArgs } from '../../generated/initializer/index.js';
import { getInitializeLaunchInstructionDataEncoder } from '../../generated/initializer/index.js';

/**
 * Public params for createInitializeLaunchInstruction.
 * - allowBuy / allowSell are boolean; converted to u8 wire format (1/0).
 * - migratorProgram is omitted — it is derived from accounts.migratorProgram
 *   so callers do not need to repeat it in both the accounts object and args.
 */
export type InitializeLaunchParams = Omit<
  InitializeLaunchArgsArgs,
  | 'allowBuy'
  | 'allowSell'
  | 'sentinelProgram'
  | 'migratorProgram'
  | 'sentinelCreateRemainingAccountsLen'
  | 'sentinelCreateRemainingAccountsHash'
> & {
  allowBuy: boolean;
  allowSell: boolean;
  sentinelProgram?: Address;
  sentinelCreateRemainingAccountsLen?: number;
  sentinelCreateRemainingAccountsHash?: ReadonlyUint8Array;
};

type AddressOrSigner = Address | TransactionSigner;
type ReadonlyRemainingAccount = AddressOrSigner;

function isTransactionSigner(
  value: AddressOrSigner,
): value is TransactionSigner {
  return (
    typeof value === 'object' &&
    value !== null &&
    'address' in value &&
    'signTransactions' in value
  );
}

function createAccountMeta(
  value: AddressOrSigner,
  role:
    | typeof AccountRole.READONLY
    | typeof AccountRole.WRITABLE
    | typeof AccountRole.READONLY_SIGNER
    | typeof AccountRole.WRITABLE_SIGNER,
): AccountMeta | AccountSignerMeta {
  if (isTransactionSigner(value)) {
    return { address: value.address, role, signer: value };
  }
  return { address: value, role };
}

/**
 * Derive the Metaplex token metadata PDA for a given mint.
 * Seeds: ["metadata", TOKEN_METADATA_PROGRAM_ID, mint]
 *
 * Pass the result as `metadataAccount` in InitializeLaunchAccounts
 * whenever `metadataName` is non-empty.
 */
export async function getTokenMetadataAddress(mint: Address): Promise<Address> {
  const encoder = getAddressEncoder();
  const [metadataAddress] = await getProgramDerivedAddress({
    programAddress: TOKEN_METADATA_PROGRAM_ID,
    seeds: [
      new TextEncoder().encode('metadata'),
      encoder.encode(TOKEN_METADATA_PROGRAM_ID),
      encoder.encode(mint),
    ],
  });
  return metadataAddress;
}

export interface InitializeLaunchAccounts {
  config: Address;
  launch: Address;
  launchAuthority: Address;
  baseMint: AddressOrSigner;
  quoteMint: Address;
  baseVault: AddressOrSigner;
  quoteVault: AddressOrSigner;
  payer: AddressOrSigner;
  authority?: AddressOrSigner;
  sentinelProgram?: Address;
  migratorProgram?: Address;
  baseTokenProgram?: Address;
  quoteTokenProgram?: Address;
  systemProgram?: Address;
  rent: Address;
  /** Required when args.metadataName is non-empty. Derive with getTokenMetadataAddress(baseMint). */
  metadataAccount?: Address;
  metadataProgram?: Address;
  /** Required when migratorProgram is the CPMM migrator. */
  cpmmConfig?: Address;
  /**
   * Remaining accounts committed to initialize_launch create hooks.
   * These are forwarded as readonly metas; TransactionSigner values are
   * forwarded as readonly signers.
   */
  sentinelCreateRemainingAccounts?: ReadonlyArray<ReadonlyRemainingAccount>;
}

function validateInitializeLaunchCurveParams(
  args: InitializeLaunchParams,
): void {
  if (args.curveKind !== CURVE_KIND_XYK) {
    throw new Error(
      `unsupported curve kind: ${args.curveKind}; only CURVE_KIND_XYK is currently enabled`,
    );
  }
  if (
    args.curveParams.length !== 1 ||
    args.curveParams[0] !== CURVE_PARAMS_FORMAT_XYK_V0
  ) {
    throw new Error('xyk curve params must be [CURVE_PARAMS_FORMAT_XYK_V0]');
  }
}

export async function createInitializeLaunchInstruction(
  accounts: InitializeLaunchAccounts,
  args: InitializeLaunchParams,
  programId: Address = INITIALIZER_PROGRAM_ID,
): Promise<Instruction> {
  validateInitializeLaunchCurveParams(args);

  const {
    config,
    launch,
    launchAuthority,
    baseMint,
    quoteMint,
    baseVault,
    quoteVault,
    payer,
    authority,
    sentinelProgram,
    migratorProgram,
    baseTokenProgram = TOKEN_PROGRAM_ADDRESS,
    quoteTokenProgram = TOKEN_PROGRAM_ADDRESS,
    systemProgram = SYSTEM_PROGRAM_ADDRESS,
    rent,
    metadataAccount,
    metadataProgram = TOKEN_METADATA_PROGRAM_ID,
    sentinelCreateRemainingAccounts = [],
  } = accounts;

  const withMetadata = Boolean(
    args.metadataName && args.metadataName.length > 0,
  );

  if (withMetadata && !metadataAccount) {
    throw new Error(
      'metadataName is set but metadataAccount was not provided. ' +
        'Derive it with await initializer.getTokenMetadataAddress(baseMintAddress).',
    );
  }

  const createHooksEnabled =
    (args.sentinelFlags & (SF_BEFORE_CREATE | SF_AFTER_CREATE)) !== 0;
  const sentinelCreateRemainingAccountAddresses =
    sentinelCreateRemainingAccounts.map((account) =>
      isTransactionSigner(account) ? account.address : account,
    );

  const keys: (AccountMeta | AccountSignerMeta)[] = [
    { address: config, role: AccountRole.READONLY },
    { address: launch, role: AccountRole.WRITABLE },
    { address: launchAuthority, role: AccountRole.READONLY },
    createAccountMeta(baseMint, AccountRole.WRITABLE_SIGNER),
    { address: quoteMint, role: AccountRole.READONLY },
    createAccountMeta(baseVault, AccountRole.WRITABLE_SIGNER),
    createAccountMeta(quoteVault, AccountRole.WRITABLE_SIGNER),
    createAccountMeta(payer, AccountRole.WRITABLE_SIGNER),
  ];

  keys.push(
    authority
      ? createAccountMeta(authority, AccountRole.READONLY_SIGNER)
      : { address: programId, role: AccountRole.READONLY },
  );
  keys.push(
    sentinelProgram
      ? { address: sentinelProgram, role: AccountRole.READONLY }
      : { address: programId, role: AccountRole.READONLY },
  );
  keys.push(
    migratorProgram
      ? { address: migratorProgram, role: AccountRole.READONLY }
      : { address: programId, role: AccountRole.READONLY },
  );

  keys.push({ address: baseTokenProgram, role: AccountRole.READONLY });
  keys.push({ address: quoteTokenProgram, role: AccountRole.READONLY });
  keys.push({ address: systemProgram, role: AccountRole.READONLY });
  keys.push({ address: rent, role: AccountRole.READONLY });

  if (withMetadata) {
    keys.push({ address: metadataAccount!, role: AccountRole.WRITABLE });
    keys.push({ address: metadataProgram, role: AccountRole.READONLY });
  } else {
    keys.push({ address: programId, role: AccountRole.READONLY });
    keys.push({ address: programId, role: AccountRole.READONLY });
  }

  const encoderArgs: InitializeLaunchArgsArgs = {
    ...args,
    allowBuy: args.allowBuy ? 1 : 0,
    allowSell: args.allowSell ? 1 : 0,
    sentinelProgram:
      args.sentinelProgram ?? sentinelProgram ?? SYSTEM_PROGRAM_ADDRESS,
    sentinelCreateRemainingAccountsLen:
      args.sentinelCreateRemainingAccountsLen ??
      sentinelCreateRemainingAccounts.length,
    migratorProgram: migratorProgram ?? SYSTEM_PROGRAM_ADDRESS,
    sentinelCreateRemainingAccountsHash:
      args.sentinelCreateRemainingAccountsHash ??
      (createHooksEnabled
        ? computeRemainingAccountsHash(sentinelCreateRemainingAccountAddresses)
        : new Uint8Array(32)),
  };

  const data = new Uint8Array(
    getInitializeLaunchInstructionDataEncoder().encode(encoderArgs),
  );

  keys.push(
    ...sentinelCreateRemainingAccounts.map((account) =>
      createAccountMeta(
        account,
        isTransactionSigner(account)
          ? AccountRole.READONLY_SIGNER
          : AccountRole.READONLY,
      ),
    ),
  );

  // When using the CPMM migrator, append the module-specific accounts required
  // by register_launch:
  //   [state, cpmm_config]
  if (migratorProgram === CPMM_MIGRATOR_PROGRAM_ID) {
    if (!accounts.cpmmConfig) {
      throw new Error(
        'cpmmConfig is required when migratorProgram is CPMM_MIGRATOR_PROGRAM_ID',
      );
    }
    const [cpmmMigratorState] = await getCpmmMigratorStateAddress(launch);
    keys.push({ address: cpmmMigratorState, role: AccountRole.WRITABLE });
    keys.push({ address: accounts.cpmmConfig, role: AccountRole.READONLY });
  }

  // When using the prediction migrator, automatically derive and append the 6
  // remaining accounts required by register_entry:
  //   [oracle_state, market, pot_vault, market_authority, entry, entry_by_mint]
  // namespace === oracle_state and launchId === entryId per program validation.
  if (migratorProgram === PREDICTION_MIGRATOR_PROGRAM_ADDRESS) {
    const oracleState = args.namespace as Address;
    const entryId = args.launchId;
    const baseMintAddress = isTransactionSigner(baseMint)
      ? baseMint.address
      : baseMint;

    const [market] = await getPredictionMarketAddress(oracleState, quoteMint);
    const [potVault] = await getPredictionPotVaultAddress(market);
    const [marketAuthority] = await getPredictionMarketAuthorityAddress(market);
    const [entry] = await getPredictionEntryAddress(market, entryId);
    const [entryByMint] = await getPredictionEntryByMintAddress(
      market,
      baseMintAddress,
    );

    keys.push({ address: oracleState, role: AccountRole.READONLY });
    keys.push({ address: market, role: AccountRole.WRITABLE });
    keys.push({ address: potVault, role: AccountRole.WRITABLE });
    keys.push({ address: marketAuthority, role: AccountRole.READONLY });
    keys.push({ address: entry, role: AccountRole.WRITABLE });
    keys.push({ address: entryByMint, role: AccountRole.WRITABLE });
  }

  return { programAddress: programId, accounts: keys, data };
}
