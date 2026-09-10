import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  address,
  generateKeyPairSigner,
  type Address,
  type Instruction,
} from '@solana/kit';
import {
  findAssociatedTokenPda,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import {
  initializer,
  curveSwapExactIn,
  predictionMigrator,
  predictionMarkets,
  trustedOracle,
} from '../../src/solana/index.js';
import {
  createSolanaClientsFromEnv,
  loadKeypairSignerFromEnv,
  sendInstructions,
  sendInitializeLaunchWithLookupTable,
  simulateInstructions,
  assertSimulationRejected,
  WSOL_MINT,
} from '../solanaExampleHelpers.js';
import {
  options,
  readManifest,
  saveManifest,
  type PublicMarket,
  type PublicOutcome,
} from './manifest.js';

export async function run() {
  const opts = options();
  const clients = createSolanaClientsFromEnv();
  const { rpc, network } = clients;
  const programs = {
    initializerProgram: address(
      process.env.SOLANA_INITIALIZER_PROGRAM_ID ??
        initializer.INITIALIZER_PROGRAM_ID,
    ),
    predictionMigratorProgram: address(
      process.env.SOLANA_PREDICTION_MIGRATOR_PROGRAM_ID ??
        predictionMigrator.PREDICTION_MIGRATOR_PROGRAM_ADDRESS,
    ),
    predictionHookProgram: address(
      process.env.SOLANA_PREDICTION_HOOK_PROGRAM_ID ??
        initializer.PREDICTION_HOOK_PROGRAM_ID,
    ),
    trustedOracleProgram: address(
      process.env.SOLANA_TRUSTED_ORACLE_PROGRAM_ID ??
        trustedOracle.TRUSTED_ORACLE_PROGRAM_ADDRESS,
    ),
  };
  assert.equal(
    programs.initializerProgram,
    initializer.INITIALIZER_PROGRAM_ID,
    'Prediction helpers require matching compiled program IDs',
  );
  assert.equal(
    programs.predictionMigratorProgram,
    predictionMigrator.PREDICTION_MIGRATOR_PROGRAM_ADDRESS,
  );
  assert.equal(
    programs.predictionHookProgram,
    initializer.PREDICTION_HOOK_PROGRAM_ID,
  );
  assert.equal(
    programs.trustedOracleProgram,
    trustedOracle.TRUSTED_ORACLE_PROGRAM_ADDRESS,
  );
  const genesisHash = await rpc.getGenesisHash().send();
  let manifest = await readManifest(opts.path);
  if (manifest) {
    assert.equal(
      manifest.genesisHash,
      genesisHash,
      'Manifest belongs to another ledger; choose another file after resetting a validator',
    );
    assert.deepEqual(
      manifest.programs,
      programs,
      'Program IDs differ from manifest',
    );
    assert.equal(
      manifest.scenario,
      opts.scenario,
      'Scenario differs from manifest',
    );
  }
  if (opts.action === 'inspect') {
    assert(manifest, 'Create a manifest with --action setup first');
    for (const m of manifest.markets)
      console.log(
        JSON.stringify(
          await predictionMarkets.fetchPredictionMarket(rpc, m.market),
          (_, v) => (typeof v === 'bigint' ? v.toString() : v),
          2,
        ),
      );
    return;
  }
  const payer = await loadKeypairSignerFromEnv();
  const creators = [payer];
  if (opts.scenario === 'shared' && ['all', 'setup'].includes(opts.action)) {
    creators.push(
      await loadKeypairSignerFromEnv({
        pathEnv: 'SOLANA_SECOND_CREATOR_KEYPAIR_PATH',
        jsonEnv: 'SOLANA_SECOND_CREATOR_KEYPAIR',
        label: 'Second creator',
      }),
    );
    assert.notEqual(
      creators[0].address,
      creators[1].address,
      'Shared oracle example needs two distinct creators',
    );
  }
  const count =
    opts.scenario === 'eight' ? 8 : opts.scenario === 'multi' ? 3 : 2;
  const labels =
    count === 2
      ? ['YES', 'NO']
      : Array.from({ length: count }, (_, i) => `OUTCOME_${i + 1}`);
  const outcomeIds = labels.map(
    (label) =>
      new Uint8Array(
        createHash('sha256').update(`doppler-example:${label}`).digest(),
      ),
  );
  const exists = async (account: Address) =>
    (
      await rpc
        .getAccountInfo(account, {
          encoding: 'base64',
          commitment: 'confirmed',
        })
        .send()
    ).value !== null;
  const persist = () => saveManifest(opts.path, manifest!);
  const record = async (action: string, signature: string) => {
    manifest!.signatures.push({
      action,
      signature,
      confirmedAt: new Date().toISOString(),
    });
    await persist();
    console.log(`${action}: ${signature}`);
  };
  const send = async (action: string, instructions: readonly Instruction[]) =>
    record(
      action,
      await sendInstructions({
        ...clients,
        payer,
        instructions: [...instructions],
      }),
    );
  if (!manifest) {
    assert(['all', 'setup'].includes(opts.action), 'Run --action setup first');
    const nonce = BigInt(Date.now());
    const prepared = await predictionMarkets.prepareOracle({
      oracleAuthority: payer,
      nonce,
      outcomeIds,
    });
    manifest = {
      version: 1,
      scenario: opts.scenario,
      network,
      genesisHash,
      programs,
      authority: payer.address,
      nonce: nonce.toString(),
      oracle: prepared.oracle,
      quoteMint: address(process.env.SOLANA_PREDICTION_QUOTE_MINT ?? WSOL_MINT),
      markets: [],
      signatures: [],
    };
    await persist();
  }
  const m = manifest;
  const launchAccounts = async (outcome: PublicOutcome) => {
    const quoteMint =
      m.markets.find((market) =>
        market.outcomes.some((item) => item.launch === outcome.launch),
      )?.quoteMint ?? m.quoteMint;
    const launch = await initializer.fetchLaunch(rpc, outcome.launch, {
      programId: programs.initializerProgram,
      commitment: 'confirmed',
    });
    assert(launch, `Missing launch ${outcome.launch}`);
    assert.equal(
      launch.namespace,
      m.oracle,
      'Launch oracle binding differs from manifest',
    );
    assert.equal(
      launch.baseMint,
      outcome.baseMint,
      'Launch mint differs from manifest',
    );
    assert.equal(
      launch.quoteMint,
      quoteMint,
      'Launch quote differs from manifest',
    );
    assert.equal(launch.hookProgram, programs.predictionHookProgram);
    assert.equal(launch.migratorProgram, programs.predictionMigratorProgram);
    const [[launchAuthority], [launchFeeState], [config]] = await Promise.all([
      initializer.getLaunchAuthorityAddress(
        outcome.launch,
        programs.initializerProgram,
      ),
      initializer.getLaunchFeeStateAddress(
        outcome.launch,
        programs.initializerProgram,
      ),
      initializer.getConfigAddress(programs.initializerProgram),
    ]);
    return {
      launch: outcome.launch,
      launchAuthority,
      launchFeeState,
      config,
      baseMint: outcome.baseMint,
      quoteMint,
      baseVault: launch.baseVault,
      quoteVault: launch.quoteVault,
      payer,
    };
  };

  const rejectBuy = async (
    label: string,
    market: PublicMarket,
    outcome: PublicOutcome,
  ) => {
    const prepared = await predictionMarkets.prepareBuy({
      ...(await launchAccounts(outcome)),
      oracle: m.oracle,
      market: market.market,
      amountIn: 10_000_000n,
      minAmountOut: 1n,
      wrapSol: market.quoteMint === WSOL_MINT,
    });
    const result = await simulateInstructions({
      ...clients,
      payer,
      instructions: prepared.instructions,
    });
    assertSimulationRejected(label, result.err);
    assert(
      result.logs?.some((log) => log.includes('Error Code: HookRejected')),
      `${label}: expected HookRejected, got ${JSON.stringify(result.err, (_, value) => (typeof value === 'bigint' ? value.toString() : value))}`,
    );
  };
  if (['all', 'setup'].includes(opts.action)) {
    assert.equal(
      m.authority,
      payer.address,
      'Setup requires original oracle authority',
    );
    if (!(await exists(m.oracle)))
      await send(
        'oracle',
        (
          await predictionMarkets.prepareOracle({
            oracleAuthority: payer,
            nonce: BigInt(m.nonce),
            outcomeIds,
          })
        ).instructions,
      );
    const marketProfiles = creators.map((creator) => ({
      creator,
      quoteMint: m.quoteMint,
    }));
    if (opts.scenario === 'shared') {
      assert(
        process.env.SOLANA_SECOND_QUOTE_MINT,
        'Shared scenario requires SOLANA_SECOND_QUOTE_MINT funded in the primary participant ATA',
      );
      const secondQuote = address(process.env.SOLANA_SECOND_QUOTE_MINT);
      assert.notEqual(secondQuote, m.quoteMint);
      marketProfiles.push({ creator: payer, quoteMint: secondQuote });
    }
    for (const { creator, quoteMint } of marketProfiles) {
      const prepared = await predictionMarkets.prepareMarket({
        creator,
        oracle: m.oracle,
        quoteMint,
      });
      let market = m.markets.find(
        (item) =>
          item.creator === creator.address && item.quoteMint === quoteMint,
      );
      if (!market) {
        market = {
          creator: creator.address,
          quoteMint,
          market: prepared.market,
          outcomes: [],
        };
        m.markets.push(market);
        await persist();
      }
      if (!(await exists(market.market)))
        await send(`market:${creator.address}`, prepared.instructions);
      for (let i = 0; i < count; i++) {
        const previous: PublicOutcome | undefined = market.outcomes[i];
        if (previous && (await exists(previous.launch))) {
          await launchAccounts(previous);
          const view = await predictionMarkets.fetchPredictionMarket(
            rpc,
            market.market,
          );
          assert.equal(view.market.data.creator, creator.address);
          assert.equal(view.market.data.outcomeMints[i], previous.baseMint);
          assert.deepEqual(
            [...view.oracle.data.outcomeIds[i]],
            [...outcomeIds[i]],
          );
          assert(
            view.entries.some(
              (entry) =>
                entry.address === previous.entry &&
                entry.data.baseMint === previous.baseMint,
            ),
          );
          continue;
        }
        const [baseMint, baseVault, quoteVault] = await Promise.all([
          generateKeyPairSigner(),
          generateKeyPairSigner(),
          generateKeyPairSigner(),
        ]);
        const launchId = new Uint8Array(
          createHash('sha256')
            .update(`${m.oracle}:${creator.address}:${quoteMint}:${labels[i]}`)
            .digest(),
        );
        const launch = await predictionMarkets.prepareOutcomeLaunch({
          oracle: m.oracle,
          creator,
          outcomeId: outcomeIds[i],
          launch: {
            payer,
            launchId,
            programId: programs.initializerProgram,
            launchAccounts: {
              baseMint,
              baseVault,
              quoteVault,
              quoteMint,
            },
            supply: {
              baseDecimals: 6,
              baseTotalSupply: 1_000_000_000_000n,
              baseForDistribution: 0n,
              baseForLiquidity: 0n,
            },
            curve: {
              curveVirtualBase: 1_000_000_000_000n,
              curveVirtualQuote: 1_000_000_000n,
              swapFeeBps: 100,
            },
            metadata: null,
            feeBeneficiaries: [{ wallet: creator.address, shareBps: 10_000 }],
          },
        });
        market.outcomes[i] = {
          label: labels[i],
          outcomeId: [...outcomeIds[i]],
          launch: launch.addresses.launch,
          baseMint: baseMint.address,
          entry: launch.entry,
        };
        // Persist addresses before submission so a confirmed launch can be recovered after a process crash.
        await persist();
        await record(
          `register:${market.market}:${labels[i]}`,
          await sendInitializeLaunchWithLookupTable({
            ...clients,
            payer,
            instruction: launch.instruction,
          }),
        );
        if (i === 0 && opts.action === 'all')
          await rejectBuy('incomplete market buy', market, market.outcomes[0]);
      }
      const state = await predictionMarkets.fetchPredictionMarket(
        rpc,
        market.market,
      );
      assert.equal(
        state.market.data.registeredBitmap,
        (1 << count) - 1,
        'Every declared outcome must be registered',
      );
    }
    if (opts.scenario === 'shared')
      assert.notEqual(m.markets[0].market, m.markets[1].market);
    if (opts.action === 'setup') return;
  }

  const tokenBalance = async (mint: Address) => {
    const [ata] = await findAssociatedTokenPda({
      owner: payer.address,
      mint,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });
    return (await exists(ata))
      ? BigInt(
          (
            await rpc
              .getTokenAccountBalance(ata, { commitment: 'confirmed' })
              .send()
          ).value.amount,
        )
      : 0n;
  };
  const buy = async () => {
    for (const market of m.markets)
      for (const [index, outcome] of market.outcomes.entries()) {
        if (opts.scenario === 'void' && index === 0) continue;
        const key = `buy:${market.market}:${outcome.label}:${payer.address}`;
        if (m.signatures.some((s) => s.action === key)) continue;
        // A funded balance is also a recovery signal after confirmation but before manifest write.
        if ((await tokenBalance(outcome.baseMint)) > 0n) continue;
        const accounts = await launchAccounts(outcome);
        const quote = await predictionMarkets.fetchPredictionBuyQuote(rpc, {
          market: market.market,
          baseMint: outcome.baseMint,
          amountIn: 10_000_000n,
          slippageBps: 100,
        });
        const prepared = await predictionMarkets.prepareBuy({
          ...accounts,
          oracle: m.oracle,
          market: market.market,
          amountIn: 10_000_000n,
          minAmountOut: quote.minAmountOut,
          wrapSol: market.quoteMint === WSOL_MINT,
        });
        await send(key, prepared.instructions);
        assert(
          (await tokenBalance(outcome.baseMint)) > 0n,
          'Buy must deliver outcome tokens',
        );
        if (opts.action === 'all') {
          const sell = await curveSwapExactIn({
            ...accounts,
            amountIn: 1n,
            minAmountOut: 0n,
            tradeDirection: 1,
            hook: {
              program: initializer.PREDICTION_HOOK_PROGRAM_ID,
              remainingAccounts: [m.oracle, market.market],
            },
          });
          const rejected = await simulateInstructions({
            ...clients,
            payer,
            instructions: sell.instructions,
          });
          assertSimulationRejected('prediction outcome sell', rejected.err);
          assert(
            rejected.logs?.some((log) =>
              log.includes('Error Code: SellNotAllowed'),
            ),
            'Expected SellNotAllowed',
          );
        }
      }
  };
  const settle = async (market: PublicMarket, outcomes = market.outcomes) => {
    for (const outcome of outcomes) {
      const state = await predictionMarkets.fetchPredictionMarket(
        rpc,
        market.market,
      );
      if (
        state.entries.find((e) => e.address === outcome.entry)?.data.isMigrated
      )
        continue;
      await send(
        `settle:${outcome.launch}`,
        (
          await predictionMarkets.prepareSettlement({
            ...(await launchAccounts(outcome)),
            oracle: m.oracle,
            market: market.market,
          })
        ).instructions,
      );
      const after = await predictionMarkets.fetchPredictionMarket(
        rpc,
        market.market,
      );
      assert(
        after.entries.find((e) => e.address === outcome.entry)?.data.isMigrated,
        'Entry settlement must persist',
      );
    }
  };
  const claim = async (
    market: PublicMarket,
    harvest = false,
    partial = false,
  ) => {
    const state = await predictionMarkets.fetchPredictionMarket(
      rpc,
      market.market,
    );
    assert(
      state.market.data.isResolved,
      'Settle the winning entry before payouts',
    );
    const outcomes = state.market.data.isVoid
      ? market.outcomes.slice(1)
      : [market.outcomes[0]];
    for (const outcome of outcomes) {
      const balanceBefore = await tokenBalance(outcome.baseMint);
      const burnAmount = harvest
        ? 0n
        : partial
          ? balanceBefore / 2n
          : balanceBefore;
      if (burnAmount === 0n) {
        if (state.market.data.isVoid) continue;
        const receipt = await predictionMarkets.fetchPredictionClaimReceipt(
          rpc,
          market.market,
          payer.address,
        );
        if (
          !receipt ||
          predictionMarkets.previewClaim({
            market: state.market.data,
            receipt: receipt.data,
            burnAmount: 0n,
          }).claimableNow === 0n
        )
          continue;
      }
      const receipt = await predictionMarkets.fetchPredictionClaimReceipt(
        rpc,
        market.market,
        payer.address,
      );
      const expectedPayout = state.market.data.isVoid
        ? predictionMarkets.previewRefund({
            isVoid: true,
            entry: state.entries.find(
              (entry) => entry.address === outcome.entry,
            )!.data,
            burnAmount,
            currentMintSupply: BigInt(
              (
                await rpc
                  .getTokenSupply(outcome.baseMint, { commitment: 'confirmed' })
                  .send()
              ).value.amount,
            ),
          }).refundAmount
        : predictionMarkets.previewClaim({
            market: state.market.data,
            receipt: receipt?.data,
            burnAmount,
          }).claimableNow;
      const before = await tokenBalance(market.quoteMint);
      const common = {
        market: market.market,
        potVault: state.market.data.potVault,
        quoteMint: market.quoteMint,
        payer,
        burnAmount,
      };
      const prepared = state.market.data.isVoid
        ? await predictionMarkets.prepareRefund({
            ...common,
            baseMint: outcome.baseMint,
            refunder: payer,
          })
        : await predictionMarkets.prepareClaim({
            ...common,
            winnerMint: outcome.baseMint,
            claimer: payer,
          });
      await send(
        `${harvest ? 'harvest' : state.market.data.isVoid ? 'refund' : 'claim'}:${outcome.baseMint}`,
        prepared.instructions,
      );
      assert.equal(
        await tokenBalance(outcome.baseMint),
        balanceBefore - burnAmount,
        'Claim/refund must burn exactly the requested amount',
      );
      const after = await tokenBalance(market.quoteMint);
      assert.equal(
        after - before,
        expectedPayout,
        'Quote payout must match accounting preview exactly',
      );
      if (burnAmount > 0n)
        assert(after > before, 'Funded position must receive quote');
      console.log(`payout ${outcome.label}: ${after - before} quote atoms`);
    }
  };
  if (['all', 'buy'].includes(opts.action)) await buy();
  if (opts.action === 'all' && opts.scenario !== 'void') {
    for (const market of m.markets) {
      const tokenAmount = await tokenBalance(market.outcomes[0].baseMint);
      if (tokenAmount === 0n) continue; // completed manifest replay
      const estimate = await predictionMarkets.fetchPotentialPayoutIfWinner(
        rpc,
        {
          market: market.market,
          candidateMint: market.outcomes[0].baseMint,
          tokenAmount,
        },
      );
      assert.equal(estimate.isEstimate, true);
      const view = await predictionMarkets.fetchPredictionMarket(
        rpc,
        market.market,
      );
      assert.equal(
        estimate.unsettledContributions,
        BigInt(view.entries.filter((entry) => !entry.data.isMigrated).length) *
          (10_000_000n - initializer.getCurveSwapFeeAmount(10_000_000n, 100)),
        'Estimate must exclude launch fees from purchased contributions',
      );
      console.log(
        `Potential payout if YES/outcome 1 wins (estimate): ${estimate.payoutQuoteForTokenAmount} quote atoms`,
      );
    }
  }
  if (['all', 'resolve'].includes(opts.action)) {
    assert.equal(
      m.authority,
      payer.address,
      'Only the oracle authority can resolve',
    );
    const state = await predictionMarkets.fetchPredictionMarket(
      rpc,
      m.markets[0].market,
    );
    if (!state.oracle.data.isFinalized && opts.action === 'all') {
      const unauthorized = await generateKeyPairSigner();
      const forbidden = predictionMarkets.prepareFinalize({
        oracleAuthority: unauthorized,
        oracle: m.oracle,
        winningOutcomeId: outcomeIds[0],
      });
      const rejected = await simulateInstructions({
        ...clients,
        payer,
        instructions: forbidden.instructions,
      });
      assertSimulationRejected(
        'unauthorized oracle finalization',
        rejected.err,
      );
      assert(
        rejected.logs?.some(
          (log) =>
            log.includes('Error Code: ConstraintSeeds') ||
            log.includes('Error Code: Unauthorized'),
        ),
        'Expected oracle authority constraint',
      );
    }
    if (!state.oracle.data.isFinalized)
      await send(
        'resolve',
        (
          await predictionMarkets.prepareFinalize({
            oracleAuthority: payer,
            oracle: m.oracle,
            winningOutcomeId: outcomeIds[0],
          })
        ).instructions,
      );
  }
  if (opts.action === 'all') {
    const current = await predictionMarkets.fetchPredictionMarket(
      rpc,
      m.markets[0].market,
    );
    // A settled launch rejects at Initializer phase validation before reaching the hook.
    // Exercise the finalization hook only while this entry remains in its trading phase.
    if (
      !current.entries.find(
        (entry) => entry.address === m.markets[0].outcomes[0].entry,
      )?.data.isMigrated
    )
      await rejectBuy(
        'finalized oracle buy',
        m.markets[0],
        m.markets[0].outcomes[0],
      );
  }
  if (opts.action === 'all' && opts.scenario === 'incremental') {
    for (const market of m.markets) {
      await settle(market, [market.outcomes[0]]);
      await claim(market);
      await settle(market, market.outcomes.slice(1));
      await claim(market, true);
    }
  } else {
    if (['all', 'settle'].includes(opts.action))
      for (const market of m.markets) await settle(market);
    if (['all', 'claim'].includes(opts.action))
      for (const market of m.markets) {
        if (opts.action === 'all' && opts.scenario === 'binary')
          await claim(market, false, true);
        await claim(market);
      }
  }
  for (const market of m.markets) {
    const state = await predictionMarkets.fetchPredictionMarket(
      rpc,
      market.market,
    );
    console.log(`market ${market.market}: ${JSON.stringify(state.status)}`);
    if (opts.action === 'all') {
      assert(state.market.data.isResolved);
      assert.equal(state.market.data.isVoid, opts.scenario === 'void');
      assert(state.entries.every((entry) => entry.data.isMigrated));
    }
  }
  console.log(`Public manifest: ${opts.path}`);
}
