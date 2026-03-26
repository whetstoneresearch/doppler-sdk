import type { Address, Instruction } from '@solana/kit';
import { getStructCodec, getU64Codec, AccountRole } from '@solana/kit';
import {
  INITIALIZER_INSTRUCTION_DISCRIMINATORS,
  INITIALIZER_PROGRAM_ID,
} from '../constants.js';
import { encodeInstructionData } from '../../core/codecs.js';

export interface PreviewMigrationResult {
  baseVaultAmount: bigint;
  quoteVaultAmount: bigint;
  baseMintSupply: bigint;
}

const previewMigrationResultCodec = getStructCodec([
  ['baseVaultAmount', getU64Codec()],
  ['quoteVaultAmount', getU64Codec()],
  ['baseMintSupply', getU64Codec()],
]);

export interface PreviewMigrationAccounts {
  launch: Address;
  baseMint: Address;
  baseVault: Address;
  quoteVault: Address;
}

export function createPreviewMigrationInstruction(
  accounts: PreviewMigrationAccounts,
  programId: Address = INITIALIZER_PROGRAM_ID,
): Instruction {
  const { launch, baseMint, baseVault, quoteVault } = accounts;

  const keys = [
    { address: launch, role: AccountRole.READONLY },
    { address: baseMint, role: AccountRole.READONLY },
    { address: baseVault, role: AccountRole.READONLY },
    { address: quoteVault, role: AccountRole.READONLY },
  ];

  const data = encodeInstructionData(
    INITIALIZER_INSTRUCTION_DISCRIMINATORS.previewMigration,
  );

  return { programAddress: programId, accounts: keys, data };
}

export function decodePreviewMigrationResult(
  data: Uint8Array,
): PreviewMigrationResult {
  return previewMigrationResultCodec.decode(data);
}
