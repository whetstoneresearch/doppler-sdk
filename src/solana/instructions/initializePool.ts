import type { Address } from '@solana/kit';
import type { Instruction, AccountMeta } from '@solana/kit';
import type { TransactionSigner, AccountSignerMeta } from '@solana/kit';
import {
  PROGRAM_ID,
  SYSTEM_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  INSTRUCTION_DISCRIMINATORS,
  ACCOUNT_ROLE_READONLY,
  ACCOUNT_ROLE_WRITABLE,
  ACCOUNT_ROLE_WRITABLE_SIGNER,
} from '../core/constants.js';
import type { InitializePoolArgs } from '../core/types.js';
import {
  initializePoolArgsCodec,
  encodeInstructionData,
} from '../core/codecs.js';

/** Type that can be either an Address or a TransactionSigner */
type AddressOrSigner = Address | TransactionSigner;

/** Check if value is a TransactionSigner (duck typing) */
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

/** Create an account meta, embedding signer if provided */
function createSignerAccountMeta(
  value: AddressOrSigner,
  role: typeof ACCOUNT_ROLE_WRITABLE_SIGNER,
): AccountMeta | AccountSignerMeta {
  if (isTransactionSigner(value)) {
    return {
      address: value.address,
      role,
      signer: value,
    };
  }
  return { address: value, role };
}

/**
 * Accounts required for initialize_pool instruction
 */
export interface InitializePoolAccounts {
  /** AmmConfig account (read-only) */
  config: Address;
  /** Pool account to initialize (writable, PDA: ['pool', token0_mint, token1_mint]) */
  pool: Address;
  /** Protocol position account (writable, PDA: ['protocol_position', pool]) */
  protocolPosition: Address;
  /** Pool authority PDA (read-only, PDA: ['authority', pool]) */
  authority: Address;
  /** Vault for token0 (writable signer - pass TransactionSigner to include signer in instruction) */
  vault0: Address | TransactionSigner;
  /** Vault for token1 (writable signer - pass TransactionSigner to include signer in instruction) */
  vault1: Address | TransactionSigner;
  /** Token0 mint (read-only, must be lexicographically smaller) */
  token0Mint: Address;
  /** Token1 mint (read-only, must be lexicographically larger) */
  token1Mint: Address;
  /** Payer for account creation (writable signer - pass TransactionSigner to include signer in instruction) */
  payer: Address | TransactionSigner;
  /** SPL Token program */
  tokenProgram?: Address;
  /** System program */
  systemProgram?: Address;
  /** Rent sysvar */
  rent: Address;
}

/**
 * Create an initialize_pool instruction
 *
 * Initializes a new trading pool for a token pair. The mints must be in canonical order
 * (token0 < token1 by bytes). Use sortMints() to ensure proper ordering.
 *
 * @param accounts - Required accounts for pool initialization
 * @param args - Instruction arguments (mintA, mintB, fees, liquidityMeasureSide, numeraire override)
 * @param programId - Program ID (defaults to CPMM program)
 * @returns Instruction to initialize the pool
 *
 * @example
 * ```ts
 * const addresses = await getPoolInitAddresses(mintA, mintB);
 * const ix = createInitializePoolInstruction(
 *   {
 *     config: addresses.config[0],
 *     pool: addresses.pool[0],
 *     protocolPosition: addresses.protocolPosition[0],
 *     authority: addresses.authority[0],
 *     vault0: vault0Keypair.publicKey,
 *     vault1: vault1Keypair.publicKey,
 *     token0Mint: addresses.token0,
 *     token1Mint: addresses.token1,
 *     payer: payerPublicKey,
 *     rent: SYSVAR_RENT_PUBKEY,
 *   },
 *   {
 *     mintA: mintA,
 *     mintB: mintB,
 *     initialSwapFeeBps: 30,
 *     initialFeeSplitBps: 5000,
 *     liquidityMeasureSide: 0,
 *     numeraireMintOverride: null,
 *   }
 * );
 * ```
 */
export function createInitializePoolInstruction(
  accounts: InitializePoolAccounts,
  args: InitializePoolArgs,
  programId: Address = PROGRAM_ID,
): Instruction {
  const {
    config,
    pool,
    protocolPosition,
    authority,
    vault0,
    vault1,
    token0Mint,
    token1Mint,
    payer,
    tokenProgram = TOKEN_PROGRAM_ID,
    systemProgram = SYSTEM_PROGRAM_ID,
    rent,
  } = accounts;

  // Build account metas in order expected by the program
  // For signer accounts (vault0, vault1, payer), embed the signer if provided
  const keys: (AccountMeta | AccountSignerMeta)[] = [
    { address: config, role: ACCOUNT_ROLE_READONLY },
    { address: pool, role: ACCOUNT_ROLE_WRITABLE },
    { address: protocolPosition, role: ACCOUNT_ROLE_WRITABLE },
    { address: authority, role: ACCOUNT_ROLE_READONLY },
    createSignerAccountMeta(vault0, ACCOUNT_ROLE_WRITABLE_SIGNER),
    createSignerAccountMeta(vault1, ACCOUNT_ROLE_WRITABLE_SIGNER),
    { address: token0Mint, role: ACCOUNT_ROLE_READONLY },
    { address: token1Mint, role: ACCOUNT_ROLE_READONLY },
    createSignerAccountMeta(payer, ACCOUNT_ROLE_WRITABLE_SIGNER),
    { address: tokenProgram, role: ACCOUNT_ROLE_READONLY },
    { address: systemProgram, role: ACCOUNT_ROLE_READONLY },
    { address: rent, role: ACCOUNT_ROLE_READONLY },
  ];

  const data = encodeInstructionData(
    INSTRUCTION_DISCRIMINATORS.initializePool,
    initializePoolArgsCodec,
    args,
  );

  return {
    programAddress: programId,
    accounts: keys,
    data,
  };
}
