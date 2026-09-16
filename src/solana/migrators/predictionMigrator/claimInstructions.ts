import {
  ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
  getCreateAssociatedTokenIdempotentInstruction,
  findAssociatedTokenPda,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import {
  type Address,
  type Instruction,
  type TransactionSigner,
} from '@solana/kit';

import { SYSTEM_PROGRAM_ADDRESS } from '../../core/constants.js';
import {
  getClaimInstructionAsync,
  PREDICTION_MIGRATOR_PROGRAM_ADDRESS,
} from '../../generated/predictionMigrator/index.js';
import {
  getPredictionClaimReceiptAddress,
  getPredictionMarketAuthorityAddress,
} from './pda.js';

const MAX_U64 = (1n << 64n) - 1n;

export type ClaimInstructionInput = {
  market: Address;
  potVault: Address;
  winnerMint: Address;
  quoteMint: Address;
  claimer: TransactionSigner;
  payer: TransactionSigner;
  burnAmount: bigint;
  baseTokenProgram?: Address;
  quoteTokenProgram?: Address;
  associatedTokenProgram?: Address;
  systemProgram?: Address;
  predictionMigratorProgram?: Address;
};
export type ClaimInstructions = {
  outcomeTokenAccount: Address;
  quoteTokenAccount: Address;
  receipt: Address;
  createOutcomeTokenAccountInstruction: Instruction;
  createQuoteTokenAccountInstruction: Instruction;
  claimInstruction: Instruction;
};
/** @internal Shared account derivation and wire construction for prediction claims. */
export async function prepareClaimInstructions(
  input: ClaimInstructionInput,
): Promise<ClaimInstructions> {
  if (input.burnAmount < 0n || input.burnAmount > MAX_U64)
    throw new Error('burnAmount must fit in a u64');
  const baseTokenProgram = input.baseTokenProgram ?? TOKEN_PROGRAM_ADDRESS;
  const quoteTokenProgram = input.quoteTokenProgram ?? TOKEN_PROGRAM_ADDRESS;
  const associatedTokenProgram =
    input.associatedTokenProgram ?? ASSOCIATED_TOKEN_PROGRAM_ADDRESS;
  const systemProgram = input.systemProgram ?? SYSTEM_PROGRAM_ADDRESS;
  const predictionMigratorProgram =
    input.predictionMigratorProgram ?? PREDICTION_MIGRATOR_PROGRAM_ADDRESS;

  const [
    [outcomeTokenAccount],
    [quoteTokenAccount],
    [marketAuthority],
    [receipt],
  ] = await Promise.all([
    findAssociatedTokenPda({
      owner: input.claimer.address,
      mint: input.winnerMint,
      tokenProgram: baseTokenProgram,
    }),
    findAssociatedTokenPda({
      owner: input.claimer.address,
      mint: input.quoteMint,
      tokenProgram: quoteTokenProgram,
    }),
    getPredictionMarketAuthorityAddress(
      input.market,
      predictionMigratorProgram,
    ),
    getPredictionClaimReceiptAddress(
      input.market,
      input.claimer.address,
      predictionMigratorProgram,
    ),
  ]);

  const createQuoteTokenAccountInstruction =
    getCreateAssociatedTokenIdempotentInstruction(
      {
        payer: input.payer,
        ata: quoteTokenAccount,
        owner: input.claimer.address,
        mint: input.quoteMint,
        systemProgram,
        tokenProgram: quoteTokenProgram,
      },
      { programAddress: associatedTokenProgram },
    );
  const claimInstruction = await getClaimInstructionAsync(
    {
      market: input.market,
      marketAuthority,
      potVault: input.potVault,
      winnerMint: input.winnerMint,
      quoteMint: input.quoteMint,
      claimerWinnerAta: outcomeTokenAccount,
      claimerQuoteAta: quoteTokenAccount,
      claimer: input.claimer,
      receipt,
      payer: input.payer,
      baseTokenProgram,
      quoteTokenProgram,
      systemProgram,
      burnAmount: input.burnAmount,
    },
    { programAddress: predictionMigratorProgram },
  );
  const createOutcomeTokenAccountInstruction =
    getCreateAssociatedTokenIdempotentInstruction(
      {
        payer: input.payer,
        ata: outcomeTokenAccount,
        owner: input.claimer.address,
        mint: input.winnerMint,
        tokenProgram: baseTokenProgram,
        systemProgram,
      },
      { programAddress: associatedTokenProgram },
    );
  return {
    outcomeTokenAccount,
    quoteTokenAccount,
    receipt,
    createOutcomeTokenAccountInstruction,
    createQuoteTokenAccountInstruction,
    claimInstruction,
  };
}
