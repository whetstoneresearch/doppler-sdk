import {
  findAssociatedTokenPda,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import { SYSTEM_PROGRAM_ADDRESS } from '@solana-program/system';
import { SYSVAR_RENT_ADDRESS } from '@solana/sysvars';
import {
  AccountRole,
  getAddressCodec,
  getProgramDerivedAddress,
  type AccountMeta,
  type AccountSignerMeta,
  type Address,
  type Instruction,
  type InstructionWithAccounts,
  type InstructionWithData,
  type ReadonlyUint8Array,
  type TransactionSigner,
} from '@solana/kit';
import {
  CPMM_PROGRAM_ID,
  SEED_AUTHORITY,
  SEED_CONFIG,
  SEED_POSITION,
  getSpotPoolAddress,
  sortMints,
} from '../../core/index.js';
import {
  SEED_PROTOCOL_FEE_OWNER,
  SEED_VAULT0,
  SEED_VAULT1,
} from '../../core/constants.js';
import {
  getCreateSpotPoolInstructionDataEncoder,
  type CreateSpotPoolInstructionDataArgs,
} from '../../generated/cpmmMigrator/index.js';
import {
  CPMM_MIGRATOR_PROGRAM_ID,
  SEED_MIGRATION_AUTHORITY,
} from './constants.js';

const addressCodec = getAddressCodec();
const textEncoder = new TextEncoder();
const U64_MAX = (1n << 64n) - 1n;
const PROTOCOL_FEE_POSITION_ID = 0n;

export type DeriveSpotPoolAccountsInput = {
  tokenAMint: Address;
  tokenBMint: Address;
  swapFeeBps: number;
  liquidityOwner: Address;
  tokenAProgram?: Address;
  tokenBProgram?: Address;
  tokenAAccount?: Address;
  tokenBAccount?: Address;
  token0Account?: Address;
  token1Account?: Address;
  positionId?: number | bigint;
  cpmmProgram?: Address;
  cpmmMigratorProgram?: Address;
};

export type SpotPoolAccounts = {
  cpmmConfig: Address;
  token0Mint: Address;
  token1Mint: Address;
  token0Program: Address;
  token1Program: Address;
  pool: Address;
  poolAuthority: Address;
  poolVault0: Address;
  poolVault1: Address;
  protocolFeeOwner: Address;
  protocolFeePosition: Address;
  position: Address;
  user0: Address;
  user1: Address;
  migrationAuthority: Address;
};

export type AddressOrSigner = Address | TransactionSigner;

export type CreateSpotPoolInstructionInput = Omit<
  DeriveSpotPoolAccountsInput,
  'liquidityOwner' | 'swapFeeBps'
> & {
  payer: AddressOrSigner;
  tokenAAmount: CreateSpotPoolInstructionDataArgs['amount0Max'];
  tokenBAmount: CreateSpotPoolInstructionDataArgs['amount1Max'];
  swapFeeBps: CreateSpotPoolInstructionDataArgs['swapFeeBps'];
  minSharesOut?: CreateSpotPoolInstructionDataArgs['minSharesOut'];
  liquidityOwner?: AddressOrSigner;
  systemProgram?: Address;
  rent?: Address;
};

export type CreateSpotPoolInstruction = Instruction &
  InstructionWithAccounts<(AccountMeta | AccountSignerMeta)[]> &
  InstructionWithData<ReadonlyUint8Array>;

async function pda(
  programAddress: Address,
  seeds: ReadonlyUint8Array[],
): Promise<Address> {
  const [derived] = await getProgramDerivedAddress({
    programAddress,
    seeds,
  });
  return derived;
}

function seed(value: string): Uint8Array {
  return textEncoder.encode(value);
}

function addressSeed(value: Address): ReadonlyUint8Array {
  return addressCodec.encode(value);
}

export function assertSafeInteger(name: string, value: number | bigint): void {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) {
    throw new RangeError(
      `${name} must be a safe integer when provided as a number; use bigint for values above Number.MAX_SAFE_INTEGER`,
    );
  }
}

function u64Seed(value: number | bigint): Uint8Array {
  assertSafeInteger('positionId', value);

  const bigintValue = BigInt(value);
  if (bigintValue < 0n || bigintValue > U64_MAX) {
    throw new RangeError('u64 position ID must be between 0 and 2^64 - 1');
  }

  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigUint64(0, bigintValue, true);
  return bytes;
}

function addressOf(value: AddressOrSigner): Address {
  return typeof value === 'string' ? value : value.address;
}

function accountMeta(
  value: AddressOrSigner,
  role: typeof AccountRole.READONLY_SIGNER | typeof AccountRole.WRITABLE_SIGNER,
): AccountMeta | AccountSignerMeta {
  if (typeof value === 'string') {
    return { address: value, role };
  }
  return { address: value.address, role, signer: value };
}

export async function deriveSpotPoolAccounts({
  tokenAMint,
  tokenBMint,
  swapFeeBps,
  liquidityOwner,
  tokenAProgram = TOKEN_PROGRAM_ADDRESS,
  tokenBProgram = TOKEN_PROGRAM_ADDRESS,
  tokenAAccount,
  tokenBAccount,
  token0Account,
  token1Account,
  positionId = 0n,
  cpmmProgram = CPMM_PROGRAM_ID,
  cpmmMigratorProgram = CPMM_MIGRATOR_PROGRAM_ID,
}: DeriveSpotPoolAccountsInput): Promise<SpotPoolAccounts> {
  const [token0Mint, token1Mint] = sortMints(tokenAMint, tokenBMint);
  const token0IsA = token0Mint === tokenAMint;
  const token0Program = token0IsA ? tokenAProgram : tokenBProgram;
  const token1Program = token0IsA ? tokenBProgram : tokenAProgram;
  const [userA] = await findAssociatedTokenPda({
    owner: liquidityOwner,
    mint: tokenAMint,
    tokenProgram: tokenAProgram,
  });
  const [userB] = await findAssociatedTokenPda({
    owner: liquidityOwner,
    mint: tokenBMint,
    tokenProgram: tokenBProgram,
  });
  const user0 =
    token0Account ??
    (token0IsA ? (tokenAAccount ?? userA) : (tokenBAccount ?? userB));
  const user1 =
    token1Account ??
    (token0IsA ? (tokenBAccount ?? userB) : (tokenAAccount ?? userA));
  const [pool] = await getSpotPoolAddress(
    token0Mint,
    token1Mint,
    swapFeeBps,
    cpmmProgram,
  );
  const protocolFeeOwner = await pda(cpmmProgram, [
    seed(SEED_PROTOCOL_FEE_OWNER),
    addressSeed(pool),
  ]);

  return {
    cpmmConfig: await pda(cpmmProgram, [seed(SEED_CONFIG)]),
    token0Mint,
    token1Mint,
    token0Program,
    token1Program,
    pool,
    poolAuthority: await pda(cpmmProgram, [
      seed(SEED_AUTHORITY),
      addressSeed(pool),
    ]),
    poolVault0: await pda(cpmmProgram, [seed(SEED_VAULT0), addressSeed(pool)]),
    poolVault1: await pda(cpmmProgram, [seed(SEED_VAULT1), addressSeed(pool)]),
    protocolFeeOwner,
    protocolFeePosition: await pda(cpmmProgram, [
      seed(SEED_POSITION),
      addressSeed(pool),
      addressSeed(protocolFeeOwner),
      u64Seed(PROTOCOL_FEE_POSITION_ID),
    ]),
    position: await pda(cpmmProgram, [
      seed(SEED_POSITION),
      addressSeed(pool),
      addressSeed(liquidityOwner),
      u64Seed(positionId),
    ]),
    user0,
    user1,
    migrationAuthority: await pda(cpmmMigratorProgram, [
      seed(SEED_MIGRATION_AUTHORITY),
    ]),
  };
}

export async function createSpotPoolInstruction(
  input: CreateSpotPoolInstructionInput,
): Promise<CreateSpotPoolInstruction> {
  const payer = input.payer;
  const liquidityOwner = input.liquidityOwner ?? payer;
  const positionId = input.positionId ?? 0n;
  const minSharesOut = input.minSharesOut ?? 1n;
  assertSafeInteger('positionId', positionId);
  assertSafeInteger('tokenAAmount', input.tokenAAmount);
  assertSafeInteger('tokenBAmount', input.tokenBAmount);
  assertSafeInteger('minSharesOut', minSharesOut);
  const cpmmProgram = input.cpmmProgram ?? CPMM_PROGRAM_ID;
  const cpmmMigratorProgram =
    input.cpmmMigratorProgram ?? CPMM_MIGRATOR_PROGRAM_ID;
  const accounts = await deriveSpotPoolAccounts({
    ...input,
    liquidityOwner: addressOf(liquidityOwner),
    cpmmProgram,
    cpmmMigratorProgram,
    positionId,
  });
  const token0IsA = accounts.token0Mint === input.tokenAMint;

  return {
    programAddress: cpmmMigratorProgram,
    accounts: [
      { address: accounts.cpmmConfig, role: AccountRole.READONLY },
      accountMeta(payer, AccountRole.WRITABLE_SIGNER),
      accountMeta(liquidityOwner, AccountRole.READONLY_SIGNER),
      { address: accounts.token0Mint, role: AccountRole.READONLY },
      { address: accounts.token1Mint, role: AccountRole.READONLY },
      { address: accounts.pool, role: AccountRole.WRITABLE },
      { address: accounts.poolAuthority, role: AccountRole.READONLY },
      { address: accounts.poolVault0, role: AccountRole.WRITABLE },
      { address: accounts.poolVault1, role: AccountRole.WRITABLE },
      { address: accounts.protocolFeeOwner, role: AccountRole.READONLY },
      { address: accounts.protocolFeePosition, role: AccountRole.WRITABLE },
      { address: accounts.position, role: AccountRole.WRITABLE },
      { address: accounts.user0, role: AccountRole.WRITABLE },
      { address: accounts.user1, role: AccountRole.WRITABLE },
      { address: cpmmProgram, role: AccountRole.READONLY },
      { address: accounts.migrationAuthority, role: AccountRole.READONLY },
      { address: accounts.token0Program, role: AccountRole.READONLY },
      { address: accounts.token1Program, role: AccountRole.READONLY },
      {
        address: input.systemProgram ?? SYSTEM_PROGRAM_ADDRESS,
        role: AccountRole.READONLY,
      },
      {
        address: input.rent ?? SYSVAR_RENT_ADDRESS,
        role: AccountRole.READONLY,
      },
    ],
    data: getCreateSpotPoolInstructionDataEncoder().encode({
      swapFeeBps: input.swapFeeBps,
      positionId,
      amount0Max: token0IsA ? input.tokenAAmount : input.tokenBAmount,
      amount1Max: token0IsA ? input.tokenBAmount : input.tokenAAmount,
      minSharesOut,
    }),
  };
}
