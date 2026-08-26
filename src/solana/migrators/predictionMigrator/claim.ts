import {
  ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
  getCloseAccountInstruction,
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
  getPredictionEntryByMintAddress,
  getPredictionMarketAuthorityAddress,
} from './pda.js';

const MAX_U64 = (1n << 64n) - 1n;

export type PrepareClaimAndCloseInput = {
  market: Address;
  potVault: Address;
  winnerMint: Address;
  quoteMint: Address;
  claimer: TransactionSigner;
  payer: TransactionSigner;
  /** Full balance of the claimer's outcome ATA. */
  outcomeTokenBalance: bigint;
  /** Receives the outcome ATA's recovered rent. Defaults to the payer. */
  rentDestination?: Address;
  baseTokenProgram?: Address;
  quoteTokenProgram?: Address;
  associatedTokenProgram?: Address;
  systemProgram?: Address;
  predictionMigratorProgram?: Address;
};

export type PrepareClaimAndCloseResult = {
  outcomeTokenAccount: Address;
  quoteTokenAccount: Address;
  createQuoteTokenAccountInstruction: Instruction;
  claimInstruction: Instruction;
  closeOutcomeTokenAccountInstruction: Instruction;
  instructions: Instruction[];
};

/**
 * Prepares an atomic prediction-market claim followed by closing the emptied outcome ATA.
 *
 * The close fails and rolls back the transaction unless `outcomeTokenBalance` matches the
 * account's full balance. Only close after the market no longer needs later `claim(0)` harvests;
 * the on-chain claim path requires this ATA even when no additional outcome tokens are burned.
 */
export async function prepareClaimAndClose(
  input: PrepareClaimAndCloseInput,
): Promise<PrepareClaimAndCloseResult> {
  if (input.outcomeTokenBalance < 0n || input.outcomeTokenBalance > MAX_U64) {
    throw new Error('outcomeTokenBalance must fit in a u64');
  }

  const baseTokenProgram = input.baseTokenProgram ?? TOKEN_PROGRAM_ADDRESS;
  const quoteTokenProgram = input.quoteTokenProgram ?? TOKEN_PROGRAM_ADDRESS;
  const associatedTokenProgram =
    input.associatedTokenProgram ?? ASSOCIATED_TOKEN_PROGRAM_ADDRESS;
  const systemProgram = input.systemProgram ?? SYSTEM_PROGRAM_ADDRESS;
  const predictionMigratorProgram =
    input.predictionMigratorProgram ?? PREDICTION_MIGRATOR_PROGRAM_ADDRESS;
  const rentDestination = input.rentDestination ?? input.payer.address;

  const [
    [outcomeTokenAccount],
    [quoteTokenAccount],
    [marketAuthority],
    [entryByMint],
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
    getPredictionEntryByMintAddress(
      input.market,
      input.winnerMint,
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
      entryByMint,
      claimerWinnerAta: outcomeTokenAccount,
      claimerQuoteAta: quoteTokenAccount,
      claimer: input.claimer,
      receipt,
      payer: input.payer,
      baseTokenProgram,
      quoteTokenProgram,
      systemProgram,
      burnAmount: input.outcomeTokenBalance,
    },
    { programAddress: predictionMigratorProgram },
  );
  const closeOutcomeTokenAccountInstruction = getCloseAccountInstruction(
    {
      account: outcomeTokenAccount,
      destination: rentDestination,
      owner: input.claimer,
    },
    { programAddress: baseTokenProgram },
  );

  return {
    outcomeTokenAccount,
    quoteTokenAccount,
    createQuoteTokenAccountInstruction,
    claimInstruction,
    closeOutcomeTokenAccountInstruction,
    instructions: [
      createQuoteTokenAccountInstruction,
      claimInstruction,
      closeOutcomeTokenAccountInstruction,
    ],
  };
}
