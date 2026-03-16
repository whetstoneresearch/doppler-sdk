import type { Address } from '@solana/kit';
import type { Instruction } from '@solana/kit';
import { getStructCodec, getU64Codec } from '@solana/kit';
import { ACCOUNT_ROLE_READONLY } from '../../core/constants.js';
import { INITIALIZER_PROGRAM_ID } from '../constants.js';
import { getPreviewSwapExactInInstructionDataEncoder } from '../../generated/initializer/instructions/previewSwapExactIn.js';

export interface PreviewSwapExactInResult {
  amountOut: bigint;
  feePaid: bigint;
}

const previewSwapExactInResultCodec = getStructCodec([
  ['amountOut', getU64Codec()],
  ['feePaid', getU64Codec()],
]);

export interface PreviewSwapExactInAccounts {
  launch: Address;
  baseVault: Address;
  quoteVault: Address;
  sentinelProgram?: Address;
}

export function createPreviewSwapExactInInstruction(
  accounts: PreviewSwapExactInAccounts,
  args: { amountIn: bigint; direction: number },
  programId: Address = INITIALIZER_PROGRAM_ID,
): Instruction {
  const { launch, baseVault, quoteVault, sentinelProgram } = accounts;

  const keys = [
    { address: launch, role: ACCOUNT_ROLE_READONLY },
    { address: baseVault, role: ACCOUNT_ROLE_READONLY },
    { address: quoteVault, role: ACCOUNT_ROLE_READONLY },
  ] as const;

  const accountsList = sentinelProgram
    ? [...keys, { address: sentinelProgram, role: ACCOUNT_ROLE_READONLY }]
    : keys;

  const data = new Uint8Array(
    getPreviewSwapExactInInstructionDataEncoder().encode(args),
  );

  return { programAddress: programId, accounts: accountsList, data };
}

export function decodePreviewSwapExactInResult(
  data: Uint8Array,
): PreviewSwapExactInResult {
  return previewSwapExactInResultCodec.decode(data);
}
