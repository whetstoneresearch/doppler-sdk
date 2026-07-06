import type {
  AccountMeta,
  AccountSignerMeta,
  Address,
  Base58EncodedBytes,
  Base64EncodedBytes,
  ReadonlyUint8Array,
  TransactionSigner,
} from '@solana/kit';
import { AccountRole } from '@solana/kit';

export type AddressOrTransactionSigner = Address | TransactionSigner;

export type RemainingAccount =
  | Address
  | AccountMeta
  | AccountSignerMeta
  | TransactionSigner;

export type AccountMetaRole =
  | typeof AccountRole.READONLY
  | typeof AccountRole.WRITABLE
  | typeof AccountRole.READONLY_SIGNER
  | typeof AccountRole.WRITABLE_SIGNER;

export type EncodedProgramAccount = Readonly<{
  pubkey: Address;
  account: Readonly<{ data: readonly [string, 'base64'] }>;
}>;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isTransactionSigner(
  value: unknown,
): value is TransactionSigner {
  return isObject(value) && 'address' in value && 'signTransactions' in value;
}

export function getAddressFromAddressOrSigner(
  value: AddressOrTransactionSigner,
): Address {
  return isTransactionSigner(value) ? value.address : value;
}

export function getAddressFromRemainingAccount(
  account: RemainingAccount,
): Address {
  if (typeof account === 'string') {
    return account;
  }
  return account.address;
}

export function createAccountMeta(
  value: AddressOrTransactionSigner,
  role: AccountMetaRole,
): AccountMeta | AccountSignerMeta {
  if (isTransactionSigner(value)) {
    return { address: value.address, role, signer: value };
  }
  return { address: value, role };
}

export function createReadonlyRemainingAccountMeta(
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

export function bytesToBase64(bytes: ReadonlyUint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function bytesToBase64EncodedBytes(
  bytes: ReadonlyUint8Array,
): Base64EncodedBytes {
  return bytesToBase64(bytes) as Base64EncodedBytes;
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function addressToBase58EncodedBytes(
  address: Address,
): Base58EncodedBytes {
  // Solana addresses are base58 strings; this brands them for RPC memcmp filters.
  return address as unknown as Base58EncodedBytes;
}

function isEncodedProgramAccount(
  account: unknown,
): account is EncodedProgramAccount {
  if (!isObject(account) || typeof account.pubkey !== 'string') {
    return false;
  }
  const accountData = account.account;
  if (!isObject(accountData) || !Array.isArray(accountData.data)) {
    return false;
  }
  const [encodedData, encoding] = accountData.data;
  return typeof encodedData === 'string' && encoding === 'base64';
}

export function normalizeProgramAccountsResponse(
  response: unknown,
): EncodedProgramAccount[] {
  const accounts = Array.isArray(response)
    ? response
    : isObject(response) && Array.isArray(response.value)
      ? response.value
      : null;

  if (!accounts) {
    throw new Error('Unexpected getProgramAccounts response shape');
  }

  if (!accounts.every(isEncodedProgramAccount)) {
    throw new Error('Unexpected getProgramAccounts account shape');
  }

  return accounts;
}

export function warnAccountDecodeFailure(
  accountType: string,
  accountAddress: Address,
): void {
  console.warn(`Failed to decode ${accountType} account: ${accountAddress}`);
}
