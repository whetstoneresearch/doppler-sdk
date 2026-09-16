import {
  getCloseAccountInstruction,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import {
  type Address,
  type Instruction,
  type TransactionSigner,
} from '@solana/kit';
import { prepareClaimInstructions } from './claimInstructions.js';

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

  const {
    outcomeTokenAccount,
    quoteTokenAccount,
    createQuoteTokenAccountInstruction,
    claimInstruction,
  } = await prepareClaimInstructions({
    ...input,
    burnAmount: input.outcomeTokenBalance,
  });
  const baseTokenProgram = input.baseTokenProgram ?? TOKEN_PROGRAM_ADDRESS;
  const rentDestination = input.rentDestination ?? input.payer.address;
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
