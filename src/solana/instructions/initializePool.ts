import type {
  Address,
  Instruction,
  AccountMeta,
  TransactionSigner,
  AccountSignerMeta,
} from '@solana/kit';
import { AccountRole } from '@solana/kit';
import {
  CPMM_PROGRAM_ID,
  SYSTEM_PROGRAM_ADDRESS,
  TOKEN_PROGRAM_ADDRESS,
  INSTRUCTION_DISCRIMINATORS,
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
  role: typeof AccountRole.READONLY_SIGNER | typeof AccountRole.WRITABLE_SIGNER,
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
  /** Vault PDA for token0 (writable, PDA: ['vault0', pool]) */
  vault0: Address;
  /** Vault PDA for token1 (writable, PDA: ['vault1', pool]) */
  vault1: Address;
  /** Token0 mint (read-only, must be lexicographically smaller) */
  token0Mint: Address;
  /** Token1 mint (read-only, must be lexicographically larger) */
  token1Mint: Address;
  /** Payer for account creation (writable signer - pass TransactionSigner to include signer in instruction) */
  payer: Address | TransactionSigner;
  /** Token0 program; defaults to tokenProgram or classic SPL Token */
  token0Program?: Address;
  /** Token1 program; defaults to tokenProgram or classic SPL Token */
  token1Program?: Address;
  /** Deprecated shared token program fallback */
  tokenProgram?: Address;
  /** System program */
  systemProgram?: Address;
  /** Rent sysvar */
  rent: Address;
  /** Migrator authority PDA signer authorizing pool initialization */
  migrationAuthority: Address | TransactionSigner;
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
 *     vault0: addresses.vault0[0],
 *     vault1: addresses.vault1[0],
 *     token0Mint: addresses.token0,
 *     token1Mint: addresses.token1,
 *     payer: payerSigner,
 *     rent: SYSVAR_RENT_PUBKEY,
 *     migrationAuthority,
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
  programId: Address = CPMM_PROGRAM_ID,
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
    token0Program,
    token1Program,
    tokenProgram = TOKEN_PROGRAM_ADDRESS,
    systemProgram = SYSTEM_PROGRAM_ADDRESS,
    rent,
    migrationAuthority,
  } = accounts;
  const resolvedToken0Program = token0Program ?? tokenProgram;
  const resolvedToken1Program = token1Program ?? tokenProgram;

  // Build account metas in order expected by the program.
  const keys: (AccountMeta | AccountSignerMeta)[] = [
    { address: config, role: AccountRole.READONLY },
    { address: pool, role: AccountRole.WRITABLE },
    { address: protocolPosition, role: AccountRole.WRITABLE },
    { address: authority, role: AccountRole.READONLY },
    { address: vault0, role: AccountRole.WRITABLE },
    { address: vault1, role: AccountRole.WRITABLE },
    { address: token0Mint, role: AccountRole.READONLY },
    { address: token1Mint, role: AccountRole.READONLY },
    createSignerAccountMeta(payer, AccountRole.WRITABLE_SIGNER),
    { address: resolvedToken0Program, role: AccountRole.READONLY },
    { address: resolvedToken1Program, role: AccountRole.READONLY },
    { address: systemProgram, role: AccountRole.READONLY },
    { address: rent, role: AccountRole.READONLY },
    createSignerAccountMeta(migrationAuthority, AccountRole.READONLY_SIGNER),
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
