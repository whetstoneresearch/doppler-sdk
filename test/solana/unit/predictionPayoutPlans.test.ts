import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  AccountRole,
  getAddressEncoder,
  getProgramDerivedAddress,
  type Address,
} from '@solana/kit';
import {
  findAssociatedTokenPda,
  TOKEN_PROGRAM_ADDRESS,
  ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import * as pm from '@/solana/predictionMarkets/index.js';
import * as prediction from '@/solana/migrators/predictionMigrator/index.js';
import * as oracleClient from '@/solana/trustedOracle/index.js';
import { TOKEN_2022_PROGRAM_ADDRESS } from '@/solana/core/constants.js';
import {
  fixture,
  encoded,
  ZERO,
  QUOTE,
  mints,
  creator,
  payer,
  ids,
} from '../fixtures/prediction.js';

const bytes = getAddressEncoder();
const discriminator = (name: string) =>
  createHash('sha256').update(`global:${name}`).digest().subarray(0, 8);
const pda = async (seed: string, ...addresses: Address[]) =>
  (
    await getProgramDerivedAddress({
      programAddress: prediction.PREDICTION_MIGRATOR_PROGRAM_ADDRESS,
      seeds: [Buffer.from(seed), ...addresses.map((a) => bytes.encode(a))],
    })
  )[0];
const metas = (ix: {
  accounts?: readonly { address: Address; role: AccountRole }[];
}) => ix.accounts?.map((a) => [a.address, a.role]);
const R = AccountRole.READONLY,
  W = AccountRole.WRITABLE;
const RS = AccountRole.READONLY_SIGNER,
  WS = AccountRole.WRITABLE_SIGNER;

async function context() {
  const f = await fixture();
  const potVault = await pda('pot_vault', f.market);
  const authority = await pda('market_authority', f.market);
  const receipt = await pda('receipt', f.market, creator.address);
  const entry = await pda('entry', f.market, mints[0]);
  const [baseAta] = await findAssociatedTokenPda({
    owner: creator.address,
    mint: mints[0],
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  const [quoteAta] = await findAssociatedTokenPda({
    owner: creator.address,
    mint: QUOTE,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  const common = {
    market: f.market,
    potVault,
    quoteMint: QUOTE,
    payer,
    burnAmount: 513n,
  };
  return {
    ...f,
    potVault,
    authority,
    receipt,
    entry,
    baseAta,
    quoteAta,
    common,
  };
}
function assertAta(
  ix: Parameters<typeof metas>[0] & { programAddress: Address },
  ata: Address,
  mint: Address,
) {
  expect(ix.programAddress).toBe(ASSOCIATED_TOKEN_PROGRAM_ADDRESS);
  expect(metas(ix)).toEqual([
    [payer.address, WS],
    [ata, W],
    [creator.address, R],
    [mint, R],
    [ZERO, R],
    [TOKEN_PROGRAM_ADDRESS, R],
  ]);
}

describe('high-level payout instruction contracts', () => {
  it('builds a sponsored claim with exact account order, roles and independent wire bytes', async () => {
    const f = await context();
    const plan = await pm.prepareClaim({
      ...f.common,
      winnerMint: mints[0],
      claimer: creator,
    });
    expect(plan.receipt).toBe(f.receipt);
    expect(plan.instructions).toHaveLength(3);
    assertAta(plan.instructions[0], f.baseAta, mints[0]);
    assertAta(plan.instructions[1], f.quoteAta, QUOTE);
    const ix = plan.claimInstruction;
    expect(ix.programAddress).toBe(
      prediction.PREDICTION_MIGRATOR_PROGRAM_ADDRESS,
    );
    expect(metas(ix)).toEqual([
      [f.market, W],
      [f.authority, R],
      [f.potVault, W],
      [mints[0], W],
      [QUOTE, R],
      [f.baseAta, W],
      [f.quoteAta, W],
      [creator.address, RS],
      [f.receipt, W],
      [payer.address, WS],
      [TOKEN_PROGRAM_ADDRESS, R],
      [TOKEN_PROGRAM_ADDRESS, R],
      [ZERO, R],
    ]);
    expect(ix.accounts?.[7]).toMatchObject({ signer: creator });
    expect(ix.accounts?.[9]).toMatchObject({ signer: payer });
    expect(Buffer.from(ix.data!)).toEqual(
      Buffer.concat([
        discriminator('claim'),
        Buffer.from([1, 2, 0, 0, 0, 0, 0, 0]),
      ]),
    );
  });
  it('harvest recreates both ATAs for the recipient while the sponsor pays', async () => {
    const f = await context();
    const plan = await pm.prepareHarvest({
      ...f.common,
      winnerMint: mints[0],
      claimer: creator,
    });
    assertAta(plan.instructions[0], f.baseAta, mints[0]);
    assertAta(plan.instructions[1], f.quoteAta, QUOTE);
    expect(plan.instructions[2]).toBe(plan.claimInstruction);
    expect(Buffer.from(plan.claimInstruction.data!)).toEqual(
      Buffer.concat([discriminator('claim'), Buffer.alloc(8)]),
    );
    expect(plan.claimInstruction.accounts?.[7]).toMatchObject({
      address: creator.address,
      signer: creator,
    });
    expect(plan.claimInstruction.accounts?.[9]).toMatchObject({
      address: payer.address,
      signer: payer,
    });
  });
  it('builds a sponsored refund using the refunder mint PDA and token accounts', async () => {
    const f = await context();
    const plan = await pm.prepareRefund({
      ...f.common,
      baseMint: mints[0],
      refunder: creator,
    });
    expect(plan.entry).toBe(f.entry);
    expect(plan.instructions).toHaveLength(2);
    assertAta(plan.instructions[0], f.quoteAta, QUOTE);
    const ix = plan.refundInstruction;
    expect(ix.programAddress).toBe(
      prediction.PREDICTION_MIGRATOR_PROGRAM_ADDRESS,
    );
    expect(metas(ix)).toEqual([
      [f.market, W],
      [f.entry, W],
      [f.authority, R],
      [f.potVault, W],
      [mints[0], W],
      [QUOTE, R],
      [f.baseAta, W],
      [f.quoteAta, W],
      [creator.address, RS],
      [TOKEN_PROGRAM_ADDRESS, R],
      [TOKEN_PROGRAM_ADDRESS, R],
    ]);
    expect(ix.accounts?.[8]).toMatchObject({ signer: creator });
    expect(Buffer.from(ix.data!)).toEqual(
      Buffer.concat([
        discriminator('refund'),
        Buffer.from([1, 2, 0, 0, 0, 0, 0, 0]),
      ]),
    );
  });
  it.each([-1n, 1n << 64n])(
    'rejects out-of-range burn amounts: %s',
    async (burnAmount) => {
      const f = await context();
      await expect(
        pm.prepareClaim({
          ...f.common,
          burnAmount,
          winnerMint: mints[0],
          claimer: creator,
        }),
      ).rejects.toThrow('u64');
      await expect(
        pm.prepareRefund({
          ...f.common,
          burnAmount,
          baseMint: mints[0],
          refunder: creator,
        }),
      ).rejects.toThrow('u64');
    },
  );
  it('rejects zero refunds and Token-2022 on either side of either payout', async () => {
    const f = await context();
    await expect(
      pm.prepareRefund({
        ...f.common,
        burnAmount: 0n,
        baseMint: mints[0],
        refunder: creator,
      }),
    ).rejects.toThrow('positive');
    for (const field of ['baseTokenProgram', 'quoteTokenProgram'] as const) {
      const bad = { ...f.common, [field]: TOKEN_2022_PROGRAM_ADDRESS };
      await expect(
        pm.prepareClaim({ ...bad, winnerMint: mints[0], claimer: creator }),
      ).rejects.toThrow('SPL Token');
      await expect(
        pm.prepareRefund({ ...bad, baseMint: mints[0], refunder: creator }),
      ).rejects.toThrow('SPL Token');
    }
  });
});

describe('claim receipt reads', () => {
  it('returns null for a missing receipt', async () => {
    const f = await context();
    expect(
      await pm.fetchPredictionClaimReceipt(f.rpc, f.market, creator.address),
    ).toBeNull();
  });
  it.each(['valid', 'owner', 'market', 'claimer', 'discriminator'] as const)(
    'validates receipt %s',
    async (kind) => {
      const f = await context();
      const empty = prediction
        .getClaimReceiptDecoder()
        .decode(new Uint8Array(prediction.getClaimReceiptSize()));
      const data = Uint8Array.from(
        prediction.getClaimReceiptEncoder().encode({
          ...empty,
          market: kind === 'market' ? ZERO : f.market,
          claimer: kind === 'claimer' ? payer.address : creator.address,
          burnedAmount: 513n,
          rewardDebt: 42n,
        }),
      );
      if (kind === 'discriminator') data[0] ^= 255;
      f.accounts.set(
        f.receipt,
        encoded(
          data,
          kind === 'owner'
            ? ZERO
            : prediction.PREDICTION_MIGRATOR_PROGRAM_ADDRESS,
        ),
      );
      const read = pm.fetchPredictionClaimReceipt(
        f.rpc,
        f.market,
        creator.address,
      );
      if (kind === 'valid')
        expect(await read).toMatchObject({
          address: f.receipt,
          data: {
            market: f.market,
            claimer: creator.address,
            burnedAmount: 513n,
            rewardDebt: 42n,
          },
        });
      else
        await expect(read).rejects.toThrow(
          kind === 'owner'
            ? 'Unexpected account owner'
            : 'Invalid prediction claim receipt',
        );
    },
  );
});

describe('oracle planner and reuse contracts', () => {
  it('finalizes by the intended ID with the authority signer and writable oracle', async () => {
    const f = await fixture();
    const plan = pm.prepareFinalize({
      oracleAuthority: creator,
      oracle: f.oracle,
      winningOutcomeId: ids[1],
    });
    expect(plan.instructions).toHaveLength(1);
    const ix = plan.instructions[0];
    expect(ix.programAddress).toBe(oracleClient.TRUSTED_ORACLE_PROGRAM_ADDRESS);
    expect(metas(ix)).toEqual([
      [creator.address, RS],
      [f.oracle, W],
    ]);
    expect(ix.accounts?.[0]).toMatchObject({ signer: creator });
    expect(Buffer.from(ix.data!)).toEqual(
      Buffer.concat([discriminator('finalize'), ids[1]]),
    );
    for (const invalid of [new Uint8Array(32), new Uint8Array(31).fill(1)])
      expect(() =>
        pm.prepareFinalize({
          oracleAuthority: creator,
          oracle: f.oracle,
          winningOutcomeId: invalid,
        }),
      ).toThrow('Outcome ID');
  });
  it('accepts only the identical unfinalized outcome order', async () => {
    const f = await fixture({ finalized: false });
    const oracle = oracleClient
      .getOracleStateDecoder()
      .decode(Buffer.from(f.accounts.get(f.oracle)!.data[0], 'base64'));
    expect(() => pm.assertReusableOracle(oracle, ids)).not.toThrow();
    expect(() =>
      pm.assertReusableOracle({ ...oracle, isFinalized: true }, ids),
    ).toThrow('already finalized');
    for (const invalid of [
      ids.slice(0, 2),
      [ids[1], ids[0], ids[2]],
      [ids[0], ids[1], pm.outcomeIdFromLabel('DIFFERENT')],
    ])
      expect(() => pm.assertReusableOracle(oracle, invalid)).toThrow(
        'set/order',
      );
  });
});
