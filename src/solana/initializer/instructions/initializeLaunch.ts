import type {
  Address,
  Instruction,
  AccountMeta,
  AccountLookupMeta,
  TransactionSigner,
  AccountSignerMeta,
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
  SYSVAR_INSTRUCTIONS_ADDRESS,
} from '../../core/constants.js';
import {
  CURVE_KIND_XYK,
  CURVE_PARAMS_FORMAT_XYK_V0,
  INITIALIZER_PROGRAM_ID,
} from '../constants.js';
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
  'allowBuy' | 'allowSell' | 'migratorProgram'
> & {
  allowBuy: boolean;
  allowSell: boolean;
};

type AddressOrSigner = Address | TransactionSigner;

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

/**
 * Known index of each static account in the Doppler devnet ALT
 * (7r5rdLkGMzTq5Q2kBhkePw4ZTeZEooHgTXktYoamNmVq).
 */
const ALT_INDEX: Record<string, number> = {
  [TOKEN_PROGRAM_ADDRESS]: 0,
  [SYSTEM_PROGRAM_ADDRESS]: 1,
  SysvarRent111111111111111111111111111111111: 2,
  [INITIALIZER_PROGRAM_ID]: 3,
  [TOKEN_METADATA_PROGRAM_ID]: 4,
  [CPMM_MIGRATOR_PROGRAM_ID]: 5,
  So11111111111111111111111111111111111111112: 6,
  [PREDICTION_MIGRATOR_PROGRAM_ADDRESS]: 8,
};

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
  migratorProgram?: Address;
  baseTokenProgram?: Address;
  quoteTokenProgram?: Address;
  systemProgram?: Address;
  rent: Address;
  /** Required when args.metadataName is non-empty. Derive with getTokenMetadataAddress(baseMint). */
  metadataAccount?: Address;
  metadataProgram?: Address;
  instructionsSysvar?: Address;
  /** Required when migratorProgram is the CPMM migrator. */
  cpmmConfig?: Address;
  /**
   * Optional Address Lookup Table to reference for static accounts.
   * When provided, constant non-signer accounts (base/quote token program,
   * systemProgram, rent, migratorProgram, quoteMint when WSOL, metadataProgram)
   * are encoded as ALT lookup metas instead of 32-byte static keys, reducing
   * transaction size while keeping versioned config PDAs explicit.
   *
   * Use DOPPLER_DEVNET_ALT for devnet.
   */
  addressLookupTable?: Address;
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
    migratorProgram,
    baseTokenProgram = TOKEN_PROGRAM_ADDRESS,
    quoteTokenProgram = TOKEN_PROGRAM_ADDRESS,
    systemProgram = SYSTEM_PROGRAM_ADDRESS,
    rent,
    metadataAccount,
    metadataProgram = TOKEN_METADATA_PROGRAM_ID,
    instructionsSysvar = SYSVAR_INSTRUCTIONS_ADDRESS,
    addressLookupTable: alt,
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

  const altIndexMap: Record<string, number> = alt ? ALT_INDEX : {};

  function staticOrLookup(
    addr: Address,
    role: AccountRole.READONLY | AccountRole.WRITABLE,
  ): AccountMeta | AccountLookupMeta {
    if (alt && altIndexMap[addr] !== undefined) {
      return {
        address: addr,
        role,
        lookupTableAddress: alt,
        addressIndex: altIndexMap[addr]!,
      };
    }
    return { address: addr, role };
  }

  const keys: (AccountMeta | AccountSignerMeta | AccountLookupMeta)[] = [
    staticOrLookup(config, AccountRole.READONLY),
    { address: launch, role: AccountRole.WRITABLE },
    { address: launchAuthority, role: AccountRole.READONLY },
    createAccountMeta(baseMint, AccountRole.WRITABLE_SIGNER),
    staticOrLookup(quoteMint, AccountRole.READONLY),
    createAccountMeta(baseVault, AccountRole.WRITABLE_SIGNER),
    createAccountMeta(quoteVault, AccountRole.WRITABLE_SIGNER),
    createAccountMeta(payer, AccountRole.WRITABLE_SIGNER),
  ];

  if (authority) {
    keys.push(createAccountMeta(authority, AccountRole.READONLY_SIGNER));
  }
  if (migratorProgram) {
    keys.push(staticOrLookup(migratorProgram, AccountRole.READONLY));
  }

  keys.push(staticOrLookup(baseTokenProgram, AccountRole.READONLY));
  keys.push(staticOrLookup(quoteTokenProgram, AccountRole.READONLY));
  keys.push(staticOrLookup(systemProgram, AccountRole.READONLY));
  keys.push(staticOrLookup(rent, AccountRole.READONLY));

  if (withMetadata) {
    keys.push({ address: metadataAccount!, role: AccountRole.WRITABLE });
    keys.push(staticOrLookup(metadataProgram, AccountRole.READONLY));
  } else {
    keys.push({ address: programId, role: AccountRole.READONLY });
    keys.push({ address: programId, role: AccountRole.READONLY });
  }

  keys.push({ address: instructionsSysvar, role: AccountRole.READONLY });

  const encoderArgs: InitializeLaunchArgsArgs = {
    ...args,
    allowBuy: args.allowBuy ? 1 : 0,
    allowSell: args.allowSell ? 1 : 0,
    migratorProgram: migratorProgram ?? SYSTEM_PROGRAM_ADDRESS,
  };

  const data = new Uint8Array(
    getInitializeLaunchInstructionDataEncoder().encode(encoderArgs),
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
