import { createHash } from 'node:crypto';
import {
  address,
  getAddressEncoder,
  getProgramDerivedAddress,
} from '@solana/kit';
import { describe, expect, it } from 'vitest';
import * as prediction from '@/solana/migrators/predictionMigrator/index.js';
import * as oracle from '@/solana/generated/trustedOracle/index.js';

// ABI fixtures match doppler-sol 8bac055: Anchor discriminators, Borsh little
// endian scalars, creator-scoped markets and mint-scoped entries.
const ORACLE = address('SysvarC1ock11111111111111111111111111111111');
const QUOTE = address('So11111111111111111111111111111111111111112');
const CREATOR = address('SysvarS1otHashes111111111111111111111111111');
const discriminator = (name: string) =>
  createHash('sha256').update(`global:${name}`).digest().subarray(0, 8);

describe('prediction refactor ABI', () => {
  it('encodes oracle outcome IDs as a Borsh vector and finalizes by ID', () => {
    const yes = new Uint8Array(32).fill(1);
    const no = new Uint8Array(32).fill(2);
    const encoded = oracle
      .getInitializeOracleInstructionDataEncoder()
      .encode({ nonce: 7n, outcomeIds: [yes, no] });
    expect(Buffer.from(encoded)).toEqual(
      Buffer.concat([
        discriminator('initialize_oracle'),
        Buffer.from([7, 0, 0, 0, 0, 0, 0, 0]),
        Buffer.from([2, 0, 0, 0]),
        yes,
        no,
      ]),
    );
    expect(
      Buffer.from(
        oracle
          .getFinalizeInstructionDataEncoder()
          .encode({ winningOutcomeId: no }),
      ),
    ).toEqual(Buffer.concat([discriminator('finalize'), no]));
  });

  it('uses the new settlement and registration wire format', () => {
    const outcomeId = new Uint8Array(32).fill(3);
    expect(
      Buffer.from(
        prediction
          .getRegisterEntryInstructionDataEncoder()
          .encode({ outcomeId }),
      ),
    ).toEqual(Buffer.concat([discriminator('register_entry'), outcomeId]));
    expect(
      Buffer.from(
        prediction.getMigrateEntryInstructionDataEncoder().encode({}),
      ),
    ).toEqual(discriminator('migrate_entry'));
    expect(
      Buffer.from(
        prediction
          .getRefundInstructionDataEncoder()
          .encode({ burnAmount: 513n }),
      ),
    ).toEqual(
      Buffer.concat([
        discriminator('refund'),
        Buffer.from([1, 2, 0, 0, 0, 0, 0, 0]),
      ]),
    );
  });

  it('matches the account lengths declared by the Rust state structs', () => {
    expect(prediction.getMarketSize()).toBe(486);
    expect(prediction.getEntrySize()).toBe(98);
    expect(oracle.getOracleStateSize()).toBe(339);
    expect(prediction.getOracleStateSize()).toBe(339);
  });

  it('derives markets with creator isolation and entries from the base mint', async () => {
    const enc = getAddressEncoder();
    const [market, bump] = await prediction.getPredictionMarketAddress(
      ORACLE,
      QUOTE,
      CREATOR,
    );
    expect([market, bump]).toEqual(
      await getProgramDerivedAddress({
        programAddress: prediction.PREDICTION_MIGRATOR_PROGRAM_ADDRESS,
        seeds: [
          Buffer.from('market'),
          enc.encode(ORACLE),
          enc.encode(QUOTE),
          enc.encode(CREATOR),
        ],
      }),
    );
    expect(
      (await prediction.getPredictionMarketAddress(ORACLE, QUOTE, ORACLE))[0],
    ).not.toBe(market);
    expect(await prediction.getPredictionEntryAddress(market, QUOTE)).toEqual(
      await getProgramDerivedAddress({
        programAddress: prediction.PREDICTION_MIGRATOR_PROGRAM_ADDRESS,
        seeds: [Buffer.from('entry'), enc.encode(market), enc.encode(QUOTE)],
      }),
    );
    expect(
      (await prediction.getPredictionEntryAddress(market, CREATOR))[0],
    ).not.toBe((await prediction.getPredictionEntryAddress(market, QUOTE))[0]);
    expect(
      (
        await prediction.getPredictionMarketAddress(
          ORACLE,
          QUOTE,
          CREATOR,
          ORACLE,
        )
      )[0],
    ).not.toBe(market);
  });
});
