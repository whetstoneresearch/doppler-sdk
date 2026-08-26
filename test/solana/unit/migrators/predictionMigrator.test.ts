import {
  ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
  getCloseAccountInstructionDataDecoder,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import { address } from '@solana/addresses';
import { generateKeyPairSigner } from '@solana/signers';
import { describe, expect, it } from 'vitest';

import { predictionMigrator } from '@/solana/index.js';
import {
  SYSTEM_PROGRAM_ADDRESS,
  TOKEN_2022_PROGRAM_ADDRESS,
} from '@/solana/core/constants.js';

const WINNER_MINT = address('So11111111111111111111111111111111111111112');
const QUOTE_MINT = address('Es9vMFrzaCERmJfrF4H2FYD7mGNi6fH4gHd8a4zYwF1');
const MARKET = address('SysvarRecentB1ockHashes11111111111111111111');
const POT_VAULT = address('SysvarS1otHashes111111111111111111111111111');
const RENT_DESTINATION = address('SysvarC1ock11111111111111111111111111111111');

describe('prediction migrator claims', () => {
  it('prepares a sponsored claim followed by an outcome ATA close', async () => {
    const payer = await generateKeyPairSigner();
    const claimer = await generateKeyPairSigner();
    const prepared = await predictionMigrator.prepareClaimAndClose({
      market: MARKET,
      potVault: POT_VAULT,
      winnerMint: WINNER_MINT,
      quoteMint: QUOTE_MINT,
      claimer,
      payer,
      outcomeTokenBalance: 42n,
      rentDestination: RENT_DESTINATION,
    });
    const claimData = predictionMigrator
      .getClaimInstructionDataDecoder()
      .decode(prepared.claimInstruction.data!);
    const closeData = getCloseAccountInstructionDataDecoder().decode(
      prepared.closeOutcomeTokenAccountInstruction.data!,
    );

    expect(claimData.burnAmount).toBe(42n);
    expect(closeData).toEqual({ discriminator: 9 });
    expect(prepared.instructions).toEqual([
      prepared.createQuoteTokenAccountInstruction,
      prepared.claimInstruction,
      prepared.closeOutcomeTokenAccountInstruction,
    ]);
    expect(prepared.createQuoteTokenAccountInstruction.programAddress).toBe(
      ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
    );
    expect(
      prepared.createQuoteTokenAccountInstruction.accounts!.map(
        ({ address }) => address,
      ),
    ).toEqual([
      payer.address,
      prepared.quoteTokenAccount,
      claimer.address,
      QUOTE_MINT,
      SYSTEM_PROGRAM_ADDRESS,
      TOKEN_PROGRAM_ADDRESS,
    ]);
    expect(
      prepared.claimInstruction.accounts!.map(({ address }) => address),
    ).toEqual([
      MARKET,
      expect.any(String),
      POT_VAULT,
      WINNER_MINT,
      QUOTE_MINT,
      expect.any(String),
      prepared.outcomeTokenAccount,
      prepared.quoteTokenAccount,
      claimer.address,
      expect.any(String),
      payer.address,
      TOKEN_PROGRAM_ADDRESS,
      TOKEN_PROGRAM_ADDRESS,
      SYSTEM_PROGRAM_ADDRESS,
    ]);
    expect(
      prepared.closeOutcomeTokenAccountInstruction.accounts!.map(
        ({ address }) => address,
      ),
    ).toEqual([
      prepared.outcomeTokenAccount,
      RENT_DESTINATION,
      claimer.address,
    ]);
  });

  it('defaults recovered rent to the payer', async () => {
    const payer = await generateKeyPairSigner();
    const claimer = await generateKeyPairSigner();
    const prepared = await predictionMigrator.prepareClaimAndClose({
      market: MARKET,
      potVault: POT_VAULT,
      winnerMint: WINNER_MINT,
      quoteMint: QUOTE_MINT,
      claimer,
      payer,
      outcomeTokenBalance: 0n,
    });

    expect(
      prepared.closeOutcomeTokenAccountInstruction.accounts![1]!.address,
    ).toBe(payer.address);
  });

  it('uses the configured Token-2022 program for the outcome account', async () => {
    const payer = await generateKeyPairSigner();
    const claimer = await generateKeyPairSigner();
    const prepared = await predictionMigrator.prepareClaimAndClose({
      market: MARKET,
      potVault: POT_VAULT,
      winnerMint: WINNER_MINT,
      quoteMint: QUOTE_MINT,
      claimer,
      payer,
      outcomeTokenBalance: 42n,
      baseTokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
    });

    expect(prepared.claimInstruction.accounts![11]!.address).toBe(
      TOKEN_2022_PROGRAM_ADDRESS,
    );
    expect(prepared.closeOutcomeTokenAccountInstruction.programAddress).toBe(
      TOKEN_2022_PROGRAM_ADDRESS,
    );
  });

  it('rejects outcome balances outside the u64 range', async () => {
    const payer = await generateKeyPairSigner();
    const claimer = await generateKeyPairSigner();
    const input = {
      market: MARKET,
      potVault: POT_VAULT,
      winnerMint: WINNER_MINT,
      quoteMint: QUOTE_MINT,
      claimer,
      payer,
    };

    await expect(
      predictionMigrator.prepareClaimAndClose({
        ...input,
        outcomeTokenBalance: -1n,
      }),
    ).rejects.toThrow(/outcomeTokenBalance must fit in a u64/);
    await expect(
      predictionMigrator.prepareClaimAndClose({
        ...input,
        outcomeTokenBalance: 1n << 64n,
      }),
    ).rejects.toThrow(/outcomeTokenBalance must fit in a u64/);
  });
});
