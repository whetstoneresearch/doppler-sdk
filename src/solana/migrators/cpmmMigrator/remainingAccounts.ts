import { AccountRole, type AccountMeta, type Address } from '@solana/kit';

import {
  CPMM_PROGRAM_ID,
  getPoolInitAddresses,
  getPositionAddress,
} from '../../core/index.js';
import { computeRemainingAccountsHash } from '../../initializer/helpers.js';
import {
  getCpmmMigrationAuthorityAddress,
  getCpmmMigratorStateAddress,
} from './pda.js';

export interface CpmmMigrationRemainingAccountsInput {
  launch: Address;
  baseMint: Address;
  quoteMint: Address;
  launchAuthority: Address;
  adminBaseAta: Address;
  adminQuoteAta: Address;
  recipientAtas: Address[];
  cpmmProgram?: Address;
}

export interface CpmmMigrationRemainingAccounts {
  addresses: Address[];
  metas: AccountMeta[];
  hash: Uint8Array;
  cpmmMigratorState: Address;
  cpmmConfig: Address;
  pool: Address;
  poolAuthority: Address;
  poolVault0: Address;
  poolVault1: Address;
  protocolPosition: Address;
  launchLpPosition: Address;
  migrationAuthority: Address;
}

export async function buildCpmmMigrationRemainingAccounts({
  launch,
  baseMint,
  quoteMint,
  launchAuthority,
  adminBaseAta,
  adminQuoteAta,
  recipientAtas,
  cpmmProgram = CPMM_PROGRAM_ID,
}: CpmmMigrationRemainingAccountsInput): Promise<CpmmMigrationRemainingAccounts> {
  const [cpmmMigratorState] = await getCpmmMigratorStateAddress(launch);
  const [migrationAuthority] = await getCpmmMigrationAuthorityAddress();
  const poolInit = await getPoolInitAddresses(baseMint, quoteMint, cpmmProgram);
  const pool = poolInit.pool[0];
  const [launchLpPosition] = await getPositionAddress(
    pool,
    launchAuthority,
    0n,
    cpmmProgram,
  );

  const addresses = [
    cpmmMigratorState,
    poolInit.config[0],
    pool,
    poolInit.authority[0],
    poolInit.vault0[0],
    poolInit.vault1[0],
    poolInit.protocolPosition[0],
    launchLpPosition,
    cpmmProgram,
    migrationAuthority,
    adminBaseAta,
    adminQuoteAta,
    ...recipientAtas,
  ];

  return {
    addresses,
    hash: computeRemainingAccountsHash(addresses),
    metas: [
      { address: cpmmMigratorState, role: AccountRole.WRITABLE },
      { address: poolInit.config[0], role: AccountRole.READONLY },
      { address: pool, role: AccountRole.WRITABLE },
      { address: poolInit.authority[0], role: AccountRole.READONLY },
      { address: poolInit.vault0[0], role: AccountRole.WRITABLE },
      { address: poolInit.vault1[0], role: AccountRole.WRITABLE },
      { address: poolInit.protocolPosition[0], role: AccountRole.WRITABLE },
      { address: launchLpPosition, role: AccountRole.WRITABLE },
      { address: cpmmProgram, role: AccountRole.READONLY },
      { address: migrationAuthority, role: AccountRole.READONLY },
      { address: adminBaseAta, role: AccountRole.WRITABLE },
      { address: adminQuoteAta, role: AccountRole.WRITABLE },
      ...recipientAtas.map((address) => ({
        address,
        role: AccountRole.WRITABLE,
      })),
    ],
    cpmmMigratorState,
    cpmmConfig: poolInit.config[0],
    pool,
    poolAuthority: poolInit.authority[0],
    poolVault0: poolInit.vault0[0],
    poolVault1: poolInit.vault1[0],
    protocolPosition: poolInit.protocolPosition[0],
    launchLpPosition,
    migrationAuthority,
  };
}

export async function buildCpmmMigrationRemainingAccountsHash(
  input: CpmmMigrationRemainingAccountsInput,
): Promise<Uint8Array> {
  return (await buildCpmmMigrationRemainingAccounts(input)).hash;
}
