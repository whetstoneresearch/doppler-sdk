import {
  type Address,
  type Instruction,
  type TransactionSigner,
} from '@solana/kit';
import {
  TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstruction,
} from '@solana-program/token';
import * as prediction from '../migrators/predictionMigrator/index.js';
import { assertPredictionTokenProgram } from './builders.js';
import { prepareClaimInstructions } from '../migrators/predictionMigrator/claimInstructions.js';
import { assertU64 } from './validation.js';
export type PrepareClaimInput = {
  market: Address;
  potVault: Address;
  winnerMint: Address;
  quoteMint: Address;
  claimer: TransactionSigner;
  payer: TransactionSigner;
  burnAmount: bigint;
  baseTokenProgram?: Address;
  quoteTokenProgram?: Address;
};
export type PrepareClaimResult = {
  outcomeTokenAccount: Address;
  quoteTokenAccount: Address;
  receipt: Address;
  claimInstruction: Instruction;
  instructions: Instruction[];
};
/** Prepare a claim, including ATA setup for initial claims and later harvests. */
export async function prepareClaim(
  input: PrepareClaimInput,
): Promise<PrepareClaimResult> {
  assertPredictionTokenProgram(input.baseTokenProgram);
  assertPredictionTokenProgram(input.quoteTokenProgram);
  const {
    createOutcomeTokenAccountInstruction,
    createQuoteTokenAccountInstruction,
    ...claim
  } = await prepareClaimInstructions(input);
  return {
    ...claim,
    instructions: [
      createOutcomeTokenAccountInstruction,
      createQuoteTokenAccountInstruction,
      claim.claimInstruction,
    ],
  };
}
/** Recreates an empty outcome ATA if it was closed, so later settlement proceeds remain harvestable. */
export function prepareHarvest(input: Omit<PrepareClaimInput, 'burnAmount'>) {
  return prepareClaim({ ...input, burnAmount: 0n });
}
export type PrepareRefundInput = Omit<
  PrepareClaimInput,
  'winnerMint' | 'claimer'
> & { baseMint: Address; refunder: TransactionSigner };
export type PrepareRefundResult = {
  outcomeTokenAccount: Address;
  quoteTokenAccount: Address;
  entry: Address;
  refundInstruction: Instruction;
  instructions: Instruction[];
};
export async function prepareRefund(
  input: PrepareRefundInput,
): Promise<PrepareRefundResult> {
  assertU64(input.burnAmount, 'burnAmount');
  if (input.burnAmount === 0n)
    throw new Error('Refund burnAmount must be positive');
  assertPredictionTokenProgram(input.baseTokenProgram);
  assertPredictionTokenProgram(input.quoteTokenProgram);
  const [
    [outcomeTokenAccount],
    [quoteTokenAccount],
    [marketAuthority],
    [entry],
  ] = await Promise.all([
    findAssociatedTokenPda({
      owner: input.refunder.address,
      mint: input.baseMint,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    }),
    findAssociatedTokenPda({
      owner: input.refunder.address,
      mint: input.quoteMint,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    }),
    prediction.getPredictionMarketAuthorityAddress(input.market),
    prediction.getPredictionEntryAddress(input.market, input.baseMint),
  ]);
  const setup = getCreateAssociatedTokenIdempotentInstruction({
    payer: input.payer,
    ata: quoteTokenAccount,
    owner: input.refunder.address,
    mint: input.quoteMint,
  });
  const refundInstruction = prediction.getRefundInstruction({
    ...input,
    marketAuthority,
    entry,
    refunderBaseAta: outcomeTokenAccount,
    refunderQuoteAta: quoteTokenAccount,
    baseTokenProgram: TOKEN_PROGRAM_ADDRESS,
    quoteTokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  return {
    outcomeTokenAccount,
    quoteTokenAccount,
    entry,
    refundInstruction,
    instructions: [setup, refundInstruction],
  };
}
/** Current pot entitlement only; future unsettled contributions are not promised. */
export function previewClaim(input: {
  market: Pick<
    prediction.Market,
    'isResolved' | 'isVoid' | 'totalPot' | 'claimableSupply'
  >;
  receipt?: Pick<prediction.ClaimReceipt, 'burnedAmount' | 'rewardDebt'>;
  burnAmount: bigint;
}) {
  assertU64(input.burnAmount, 'burnAmount');
  const { market } = input;
  if (!market.isResolved || market.isVoid || market.claimableSupply === 0n)
    throw new Error('Winning entry must be settled in a non-void market');
  const burnedAmount = (input.receipt?.burnedAmount ?? 0n) + input.burnAmount;
  if (burnedAmount > market.claimableSupply)
    throw new Error('Burn exceeds fixed claimable supply');
  const cumulativeEntitlement =
    (burnedAmount * market.totalPot) / market.claimableSupply;
  const claimableNow =
    cumulativeEntitlement - (input.receipt?.rewardDebt ?? 0n);
  if (claimableNow < 0n)
    throw new Error(
      'Receipt debt exceeds entitlement; refresh consistent state',
    );
  return {
    claimableNow,
    cumulativeEntitlement,
    burnedAmount,
    canExecute: input.burnAmount === 0n || claimableNow > 0n,
  };
}
export function previewRefund(input: {
  entry: Pick<
    prediction.Entry,
    'isMigrated' | 'contribution' | 'refundSupply' | 'refundedQuote'
  >;
  isVoid: boolean;
  burnAmount: bigint;
  currentMintSupply: bigint;
}) {
  assertU64(input.burnAmount, 'burnAmount');
  assertU64(input.currentMintSupply, 'currentMintSupply');
  const { entry } = input;
  if (!input.isVoid || !entry.isMigrated || entry.refundSupply === 0n)
    throw new Error(
      'Refund requires a void market and settled entry with circulating supply',
    );
  if (
    input.burnAmount === 0n ||
    input.burnAmount > input.currentMintSupply ||
    input.currentMintSupply > entry.refundSupply
  )
    throw new Error('Invalid refund burn/supply');
  const isFinalRefund = input.burnAmount === input.currentMintSupply;
  const refundAmount = isFinalRefund
    ? entry.contribution - entry.refundedQuote
    : (input.burnAmount * entry.contribution) / entry.refundSupply;
  if (
    refundAmount < 0n ||
    refundAmount + entry.refundedQuote > entry.contribution
  )
    throw new Error('Refund exceeds contribution');
  return { refundAmount, isFinalRefund };
}
