import type { Address, Instruction } from '@solana/kit';
import { getStructCodec, getU64Codec, AccountRole } from '@solana/kit';
import { INITIALIZER_PROGRAM_ID } from '../constants.js';
import { getPreviewSwapExactInInstructionDataEncoder } from '../../generated/initializer/index.js';

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
    { address: launch, role: AccountRole.READONLY },
    { address: baseVault, role: AccountRole.READONLY },
    { address: quoteVault, role: AccountRole.READONLY },
  ] as const;

  const accountsList = sentinelProgram
    ? [...keys, { address: sentinelProgram, role: AccountRole.READONLY }]
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
