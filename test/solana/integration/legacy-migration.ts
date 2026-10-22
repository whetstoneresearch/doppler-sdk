/** Legacy compatibility scenario: gated buy, migration, and ungated pool swap. */
import '../../../examples/env.js';

import { TOKEN_PROGRAM_ADDRESS } from '@solana-program/token';
import { SYSTEM_PROGRAM_ADDRESS } from '@solana-program/system';
import { generateKeyPairSigner } from '@solana/kit';

import {
  assertMigrationQuoteThreshold,
  dopplerLaunchHookV1,
  cpmm,
  createLaunch,
  curveSwapExactIn,
  initializer,
  migrateLaunch,
  swapExactIn,
} from '../../../src/solana/index.js';
import { TOKEN_2022_PROGRAM_ADDRESS } from '../../../src/solana/core/constants.js';
import { fetchLaunchFeeState } from '../../../src/solana/generated/initializer/accounts/launchFeeState.js';

import {
  DEFAULT_SWAP_FEE_BPS,
  DEFAULT_TEST_METADATA,
  WSOL_MINT,
  assertSimulationRejected,
  assertSolanaExampleNetwork,
  createSolanaClientsFromEnv,
  getSolPriceUsd,
  getSolanaUsdcMintFromEnv,
  getSolanaCpmmDeploymentFromEnv,
  loadCosigner,
  loadKeypairSignerFromEnv,
  loadLaunchBeneficiaries,
  parseDecimalTokenAmount,
  sendInitializeLaunchWithLookupTable,
  sendInstructions,
  simulateInstructions,
} from '../../../examples/solanaExampleHelpers.js';

async function main() {
  const payer = await loadKeypairSignerFromEnv();
  const cosigner = await loadCosigner();
  const { rpc, rpcSubscriptions, network } = createSolanaClientsFromEnv();
  assertSolanaExampleNetwork(network, ['devnet', 'custom']);
  const deployment = await getSolanaCpmmDeploymentFromEnv(network);
  const managedCosignerGate =
    await dopplerLaunchHookV1.resolveManagedCosignerGate(rpc, {
      programId: deployment.dopplerLaunchHookV1Program,
    });
  const dopplerLaunchHookV1Config = managedCosignerGate.config;
  if (cosigner.address !== managedCosignerGate.cosigner) {
    throw new Error(
      `COSIGNER_KEYPAIR resolves to ${cosigner.address}, but this launch requires managed cosigner ${managedCosignerGate.cosigner}`,
    );
  }

  const BASE_DECIMALS = 6;
  const BASE_TOTAL_SUPPLY = 1_000_000_000n * 10n ** BigInt(BASE_DECIMALS);
  const BASE_FOR_DISTRIBUTION = 200_000_000n * 10n ** BigInt(BASE_DECIMALS);
  const BASE_FOR_LIQUIDITY = 50_000_000n * 10n ** BigInt(BASE_DECIMALS);
  const BASE_FOR_CURVE =
    BASE_TOTAL_SUPPLY - BASE_FOR_DISTRIBUTION - BASE_FOR_LIQUIDITY;
  const quote = process.env.SOLANA_QUOTE ?? 'sol';
  const tokenKind = process.env.SOLANA_BASE_TOKEN_PROGRAM ?? 'spl';
  if (quote !== 'sol' && quote !== 'usdc')
    throw new Error('Invalid SOLANA_QUOTE');
  if (tokenKind !== 'spl' && tokenKind !== 'token2022')
    throw new Error('Invalid SOLANA_BASE_TOKEN_PROGRAM');
  const quoteMint =
    quote === 'sol' ? WSOL_MINT : getSolanaUsdcMintFromEnv(network);
  const baseTokenProgram =
    tokenKind === 'token2022'
      ? TOKEN_2022_PROGRAM_ADDRESS
      : TOKEN_PROGRAM_ADDRESS;
  const QUOTE_DECIMALS = quote === 'sol' ? 9 : 6;
  const SWAP_FEE_BPS = DEFAULT_SWAP_FEE_BPS;
  const BUY_AMOUNT_IN = parseDecimalTokenAmount(
    quote === 'sol'
      ? 'SOLANA_COSIGNER_BUY_AMOUNT_SOL'
      : 'SOLANA_COSIGNER_BUY_AMOUNT_USDC',
    QUOTE_DECIMALS,
  );
  if (BUY_AMOUNT_IN === 0n) {
    throw new Error('SOLANA_COSIGNER_BUY_AMOUNT_SOL must be greater than zero');
  }
  const minRaiseQuote = BUY_AMOUNT_IN > 1_000n ? BUY_AMOUNT_IN / 2n : 1n;
  const launchBeneficiaries = loadLaunchBeneficiaries({
    baseDecimals: BASE_DECIMALS,
    expectedDistributionAmount: BASE_FOR_DISTRIBUTION,
  });

  const solPriceUsd = quote === 'sol' ? await getSolPriceUsd() : 1;
  const { start } = cpmm.marketCapToCurveParams({
    startMarketCapUSD: 100_000,
    endMarketCapUSD: 10_000_000,
    baseTotalSupply: BASE_TOTAL_SUPPLY,
    baseForCurve: BASE_FOR_CURVE,
    baseDecimals: BASE_DECIMALS,
    quoteDecimals: QUOTE_DECIMALS,
    numerairePriceUSD: solPriceUsd,
  });

  const baseMint = await generateKeyPairSigner();
  const metadata = DEFAULT_TEST_METADATA;

  const namespace = dopplerLaunchHookV1Config;
  const launchId = initializer.launchIdFromU64(BigInt(Date.now()));
  const launchAddresses = await initializer.deriveCreateLaunchAddresses({
    deployment,
    namespace,
    launchId,
    baseMint,
    metadata,
  });
  const { launch, launchAuthority, launchFeeState } = launchAddresses;

  console.log('Creating legacy cosigner-gated launch...');
  console.log('  Launch:            ', launch);
  console.log('  Base mint:         ', baseMint.address);
  console.log(
    '  Doppler launch hook v1:         ',
    deployment.dopplerLaunchHookV1Program,
  );
  console.log('  Doppler launch hook v1 config:  ', dopplerLaunchHookV1Config);
  console.log('  Signing cosigner:  ', cosigner.address);
  console.log('  Buy amount atoms:  ', BUY_AMOUNT_IN.toString());
  console.log('  Migration threshold atoms:', minRaiseQuote.toString());
  console.log('  Fee beneficiaries: ');
  for (const [
    index,
    beneficiary,
  ] of launchBeneficiaries.feeBeneficiaries.entries()) {
    console.log(
      `    [${index}] ${beneficiary.wallet} share=${beneficiary.shareBps}bps allocation=${launchBeneficiaries.recipients[index].amount}`,
    );
  }

  const { instruction: initializeLaunchIx, cpmmMigration } = await createLaunch(
    {
      deployment,
      namespace,
      launchId,
      addresses: launchAddresses,
      launchAccounts: {
        baseMint,
        quoteMint,
      },
      payer,
      authority: payer,
      supply: {
        baseDecimals: BASE_DECIMALS,
        baseTotalSupply: BASE_TOTAL_SUPPLY,
        baseForDistribution: BASE_FOR_DISTRIBUTION,
        baseForLiquidity: BASE_FOR_LIQUIDITY,
      },
      curve: {
        curveVirtualBase: start.curveVirtualBase,
        curveVirtualQuote: start.curveVirtualQuote,
        swapFeeBps: SWAP_FEE_BPS,
      },
      tokenPrograms: {
        baseTokenProgram,
        quoteTokenProgram: TOKEN_PROGRAM_ADDRESS,
      },
      cosignerGate: managedCosignerGate,
      migration: {
        recipients: launchBeneficiaries.recipients,
        minRaiseQuote,
      },
      metadata,
      feeBeneficiaries: launchBeneficiaries.feeBeneficiaries,
    },
  );
  if (!cpmmMigration) {
    throw new Error('CPMM migration accounts were not prepared');
  }
  const { signedHookRemainingAccounts, unsignedHookRemainingAccounts } =
    dopplerLaunchHookV1.getDopplerLaunchHookV1RemainingAccounts({
      namespace,
      config: managedCosignerGate.config,
      cosigner,
    });
  const migrationAccounts = cpmmMigration;

  const launchSignature = await sendInitializeLaunchWithLookupTable({
    rpc,
    rpcSubscriptions,
    payer,
    instruction: initializeLaunchIx,
    metadata,
  });
  console.log('  Launch tx:         ', launchSignature);

  const swapBaseInput = {
    deployment,
    launch,
    launchAuthority,
    baseVault: launchAddresses.baseVault,
    quoteVault: launchAddresses.quoteVault,
    launchFeeState,
    baseMint: baseMint.address,
    quoteMint,
    payer,
    amountIn: BUY_AMOUNT_IN,
    minAmountOut: 1n,
    tradeDirection: initializer.TRADE_DIRECTION_BUY,
    baseTokenProgram,
    quoteTokenProgram: TOKEN_PROGRAM_ADDRESS,
  } as const;

  const unsignedBuy = await curveSwapExactIn({
    ...swapBaseInput,
    remainingAccounts: unsignedHookRemainingAccounts,
  });
  const unsignedResult = await simulateInstructions({
    rpc,
    payer,
    instructions: unsignedBuy.instructions,
  });
  assertSimulationRejected('Unsigned bonding curve buy', unsignedResult.err);

  const signedBuy = await curveSwapExactIn({
    ...swapBaseInput,
    remainingAccounts: signedHookRemainingAccounts,
  });
  const buySignature = await sendInstructions({
    rpc,
    rpcSubscriptions,
    payer,
    instructions: signedBuy.instructions,
  });
  console.log('  Cosigned buy tx:   ', buySignature);

  const launchAccount = await initializer.fetchLaunch(rpc, launch, {
    commitment: 'confirmed',
    programId: deployment.initializerProgram,
  });
  if (!launchAccount) {
    throw new Error('Launch account was not found after buy');
  }
  console.log(
    '  Launch phase:      ',
    initializer.phaseLabel(launchAccount.phase),
  );

  const expectedQuoteFee = initializer.getCurveSwapFeeAmount(
    BUY_AMOUNT_IN,
    SWAP_FEE_BPS,
  );
  const { data: feeState } = await fetchLaunchFeeState(rpc, launchFeeState, {
    commitment: 'confirmed',
  });
  if (
    feeState.cumulatedQuoteFees !== expectedQuoteFee ||
    feeState.cumulatedBaseFees !== 0n
  ) {
    throw new Error('Curve fee accounting does not match the executed buy');
  }

  const { quoteVaultAmount, pendingQuoteFees } =
    await assertMigrationQuoteThreshold({
      rpc,
      quoteVault: launchAddresses.quoteVault,
      pendingQuoteFees: initializer.getCurveSwapFeeAmount(
        BUY_AMOUNT_IN,
        SWAP_FEE_BPS,
      ),
      minRaiseQuote,
    });
  console.log('  Quote vault amount:', quoteVaultAmount.toString());
  console.log('  Pending quote fees:', pendingQuoteFees.toString());
  console.log('');

  const migration = migrateLaunch({
    deployment,
    launch,
    launchAuthority,
    baseMint: baseMint.address,
    quoteMint,
    baseVault: launchAddresses.baseVault,
    quoteVault: launchAddresses.quoteVault,
    launchFeeState,
    payer,
    cpmmMigration: migrationAccounts,
    recipients: launchBeneficiaries.recipients,
    baseTokenProgram,
    quoteTokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  const migrationSignature = await sendInstructions({
    rpc,
    rpcSubscriptions,
    payer,
    instructions: migration.instructions,
  });
  console.log('  Migration tx:      ', migrationSignature);

  const migratedLaunch = await initializer.fetchLaunch(rpc, launch, {
    commitment: 'confirmed',
    programId: deployment.initializerProgram,
  });
  if (!migratedLaunch) {
    throw new Error('Launch account was not found after migration');
  }
  console.log(
    '  Migrated phase:    ',
    initializer.phaseLabel(migratedLaunch.phase),
  );

  const poolResult = await cpmm.getPoolByMints(
    rpc,
    baseMint.address,
    quoteMint,
    {
      commitment: 'confirmed',
      programId: deployment.cpmmProgram,
    },
  );
  if (!poolResult) {
    throw new Error('CPMM pool was not found after migration');
  }

  const { account: pool } = poolResult;
  if (pool.hookProgram !== SYSTEM_PROGRAM_ADDRESS || pool.hookFlags !== 0) {
    throw new Error(
      `Migrated pool hook mismatch: got program ${pool.hookProgram} flags ${pool.hookFlags}, expected no Doppler launch hook v1`,
    );
  }

  const tradeDirection = pool.token0Mint === baseMint.address ? 0 : 1;
  const CPMM_SWAP_AMOUNT_IN = 1_000_000n;
  const cpmmSwap = await swapExactIn({
    deployment,
    pool: poolResult,
    payer,
    amountIn: CPMM_SWAP_AMOUNT_IN,
    slippageBps: 500n,
    tradeDirection,
    token0Program:
      pool.token0Mint === baseMint.address
        ? baseTokenProgram
        : TOKEN_PROGRAM_ADDRESS,
    token1Program:
      pool.token1Mint === baseMint.address
        ? baseTokenProgram
        : TOKEN_PROGRAM_ADDRESS,
  });
  const cpmmSwapSignature = await sendInstructions({
    rpc,
    rpcSubscriptions,
    payer,
    instructions: cpmmSwap.instructions,
  });
  console.log('  Ungated CPMM swap tx:', cpmmSwapSignature);
  console.log('');
  console.log('Legacy migration scenario complete.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
