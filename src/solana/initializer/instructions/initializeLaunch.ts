import type { Address } from '@solana/kit';
import type { Instruction, AccountMeta } from '@solana/kit';
import type { TransactionSigner, AccountSignerMeta } from '@solana/kit';
import {
  ACCOUNT_ROLE_READONLY,
  ACCOUNT_ROLE_SIGNER,
  ACCOUNT_ROLE_WRITABLE,
  ACCOUNT_ROLE_WRITABLE_SIGNER,
  SYSTEM_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from '../../core/constants.js';
import {
  CURVE_KIND_XYK,
  CURVE_PARAMS_FORMAT_XYK_V0,
  INITIALIZER_PROGRAM_ID,
} from '../constants.js';
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
    | typeof ACCOUNT_ROLE_READONLY
    | typeof ACCOUNT_ROLE_WRITABLE
    | typeof ACCOUNT_ROLE_SIGNER
    | typeof ACCOUNT_ROLE_WRITABLE_SIGNER,
): AccountMeta | AccountSignerMeta {
  if (isTransactionSigner(value)) {
    return { address: value.address, role, signer: value };
  }
  return { address: value, role };
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
  authority?: AddressOrSigner; // optional creator/admin signer
  migratorProgram?: Address; // optional module hook program
  tokenProgram?: Address;
  systemProgram?: Address;
  rent: Address;
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
    tokenProgram = TOKEN_PROGRAM_ID,
    systemProgram = SYSTEM_PROGRAM_ID,
    rent,
  } = accounts;

  const keys: (AccountMeta | AccountSignerMeta)[] = [
    { address: config, role: ACCOUNT_ROLE_READONLY },
    { address: launch, role: ACCOUNT_ROLE_WRITABLE },
    { address: launchAuthority, role: ACCOUNT_ROLE_READONLY },
    createAccountMeta(baseMint, ACCOUNT_ROLE_WRITABLE_SIGNER),
    { address: quoteMint, role: ACCOUNT_ROLE_READONLY },
    createAccountMeta(baseVault, ACCOUNT_ROLE_WRITABLE_SIGNER),
    createAccountMeta(quoteVault, ACCOUNT_ROLE_WRITABLE_SIGNER),
    createAccountMeta(payer, ACCOUNT_ROLE_WRITABLE_SIGNER),
  ];

  // Optional accounts (Anchor will treat them as None if constraints don't match).
  if (authority) {
    keys.push(createAccountMeta(authority, ACCOUNT_ROLE_SIGNER));
  }
  if (migratorProgram) {
    keys.push({ address: migratorProgram, role: ACCOUNT_ROLE_READONLY });
  }

  keys.push({ address: tokenProgram, role: ACCOUNT_ROLE_READONLY });
  keys.push({ address: systemProgram, role: ACCOUNT_ROLE_READONLY });
  keys.push({ address: rent, role: ACCOUNT_ROLE_READONLY });

  const data = new Uint8Array(
    getInitializeLaunchInstructionDataEncoder().encode(args),
  );

  return {
    programAddress: programId,
    accounts: keys,
    data,
  };
}
