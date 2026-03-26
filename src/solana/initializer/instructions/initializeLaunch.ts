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
} from '../../core/constants.js';
import {
  CURVE_KIND_XYK,
  CURVE_PARAMS_FORMAT_XYK_V0,
  INITIALIZER_PROGRAM_ID,
} from '../constants.js';
import { CPMM_MIGRATOR_PROGRAM_ID } from '../../migrators/cpmmMigrator/constants.js';
import { PREDICTION_MIGRATOR_PROGRAM_ADDRESS } from '../../generated/predictionMigrator/programs/predictionMigrator.js';
import type { InitializeLaunchArgsArgs } from '../../generated/initializer/index.js';
import { getInitializeLaunchInstructionDataEncoder } from '../../generated/initializer/index.js';

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
  // index 7 = config PDA — resolved at call time from accounts.config
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
  tokenProgram?: Address;
  systemProgram?: Address;
  rent: Address;
  /** Required when args.metadataName is non-empty. Derive with getTokenMetadataAddress(baseMint). */
  metadataAccount?: Address;
  /**
   * Optional Address Lookup Table to reference for static accounts.
   * When provided, constant non-signer accounts (tokenProgram, systemProgram,
   * rent, migratorProgram, quoteMint when WSOL, metadataProgram, config) are
   * encoded as ALT lookup metas instead of 32-byte static keys, reducing
   * transaction size by ~200+ bytes and enabling V4 metadata within the
   * 1232-byte Solana transaction limit.
   *
   * Use DOPPLER_DEVNET_ALT for devnet.
   */
  addressLookupTable?: Address;
}

function validateInitializeLaunchCurveParams(
  args: InitializeLaunchArgsArgs,
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

export function createInitializeLaunchInstruction(
  accounts: InitializeLaunchAccounts,
  args: InitializeLaunchArgsArgs,
  programId: Address = INITIALIZER_PROGRAM_ID,
): Instruction {
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
    tokenProgram = TOKEN_PROGRAM_ADDRESS,
    systemProgram = SYSTEM_PROGRAM_ADDRESS,
    rent,
    metadataAccount,
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

  // Build an ALT index map that also includes the config PDA at index 7.
  const altIndexMap: Record<string, number> = alt
    ? { ...ALT_INDEX, [config]: 7 }
    : {};

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

  keys.push(staticOrLookup(tokenProgram, AccountRole.READONLY));
  keys.push(staticOrLookup(systemProgram, AccountRole.READONLY));
  keys.push(staticOrLookup(rent, AccountRole.READONLY));

  if (withMetadata) {
    keys.push({ address: metadataAccount!, role: AccountRole.WRITABLE });
    keys.push(staticOrLookup(TOKEN_METADATA_PROGRAM_ID, AccountRole.READONLY));
  }

  const data = new Uint8Array(
    getInitializeLaunchInstructionDataEncoder().encode(args),
  );

  return { programAddress: programId, accounts: keys, data };
}
