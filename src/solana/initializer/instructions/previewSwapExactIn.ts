import type { Address, Instruction } from '@solana/kit';
import { getStructCodec, getU64Codec, AccountRole } from '@solana/kit';
import {
  createReadonlyRemainingAccountMeta,
  type RemainingAccount,
} from '../../core/accounts.js';
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
  launchFeeState: Address;
  baseVault: Address;
  quoteVault: Address;
  hookProgram?: Address;
  remainingAccounts?: RemainingAccount[];
}

export function createPreviewSwapExactInInstruction(
  accounts: PreviewSwapExactInAccounts,
  args: { amountIn: bigint; tradeDirection: number },
  programId: Address = INITIALIZER_PROGRAM_ID,
): Instruction {
  const {
    launch,
    launchFeeState,
    baseVault,
    quoteVault,
    hookProgram,
    remainingAccounts = [],
  } = accounts;

  const keys = [
    { address: launch, role: AccountRole.READONLY },
    { address: launchFeeState, role: AccountRole.READONLY },
    { address: baseVault, role: AccountRole.READONLY },
    { address: quoteVault, role: AccountRole.READONLY },
  ] as const;

  const accountsList = hookProgram
    ? [...keys, { address: hookProgram, role: AccountRole.READONLY }]
    : keys;

  const accountsWithRemaining = [
    ...accountsList,
    ...remainingAccounts.map(createReadonlyRemainingAccountMeta),
  ];

  const data = new Uint8Array(
    getPreviewSwapExactInInstructionDataEncoder().encode(args),
  );

  return { programAddress: programId, accounts: accountsWithRemaining, data };
}

export function decodePreviewSwapExactInResult(
  data: Uint8Array,
): PreviewSwapExactInResult {
  return previewSwapExactInResultCodec.decode(data);
}
