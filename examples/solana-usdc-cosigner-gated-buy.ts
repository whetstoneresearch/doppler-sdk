/**
 * Example: USDC Cosigner-Gated Bonding Curve Buy (Solana)
 *
 * Creates a CPMM-migratable launch with the cosigner hook enabled for
 * pre-migration swaps, proves an unsigned buy fails, executes one cosigned
 * bonding-curve buy with devnet USDC, migrates, then performs an ungated CPMM swap.
 *
 * Configure two launch beneficiaries with:
 *   SOLANA_FEE_BENEFICIARY_1_WALLET / _BASE_AMOUNT / _SHARE_BPS
 *   SOLANA_FEE_BENEFICIARY_2_WALLET / _BASE_AMOUNT / _SHARE_BPS
 * The *_BASE_AMOUNT values are human token amounts and must sum to the launch
 * distribution allocation. The *_SHARE_BPS values must sum to 10000.
 */
import './env.js';

import {
  TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstruction,
} from '@solana-program/token';
import { SYSTEM_PROGRAM_ADDRESS } from '@solana-program/system';
import { generateKeyPairSigner } from '@solana/kit';
import { SYSVAR_RENT_ADDRESS } from '@solana/sysvars';

import {
  cosignerHook,
  cpmm,
  createLaunch,
  initializer,
} from '../src/solana/index.js';

import {
  DEFAULT_SWAP_FEE_BPS,
  DEFAULT_TEST_METADATA,
  DEVNET_USDC_MINT as USDC_MINT,
  assertCosignerRegistered,
  assertMigrationQuoteThreshold,
  assertSimulationRejected,
  assertSolanaExampleNetwork,
  assertTokenBalance,
  createSetComputeUnitLimitInstruction,
  createSolanaClientsFromEnv,
  getSolanaCpmmDeploymentFromEnv,
  loadCosigner,
  loadKeypairSignerFromEnv,
  loadLaunchBeneficiaries,
  parseDecimalTokenAmount,
  sendInitializeLaunchWithLookupTable,
  sendInstructions,
  simulateInstructions,
} from './solanaExampleHelpers.js';

async function main() {
  const payer = await loadKeypairSignerFromEnv();
  const cosigner = await loadCosigner();
  const { rpc, rpcSubscriptions, network } = createSolanaClientsFromEnv();
  assertSolanaExampleNetwork(network, ['devnet', 'custom']);
  const deployment = await getSolanaCpmmDeploymentFromEnv(network);
  const [cosignerConfig] = await cosignerHook.getCosignerHookConfigAddress(
    deployment.cosignerHookProgram,
  );

  console.log('Checking cosigner hook config...');
  await assertCosignerRegistered({
    rpc,
    cosignerHookProgram: deployment.cosignerHookProgram,
    cosignerConfig,
    cosigner,
  });

  const BASE_DECIMALS = 6;
  const BASE_TOTAL_SUPPLY = 1_000_000_000n * 10n ** BigInt(BASE_DECIMALS);
  const BASE_FOR_DISTRIBUTION = 200_000_000n * 10n ** BigInt(BASE_DECIMALS);
  const BASE_FOR_LIQUIDITY = 50_000_000n * 10n ** BigInt(BASE_DECIMALS);
  const BASE_FOR_CURVE =
    BASE_TOTAL_SUPPLY - BASE_FOR_DISTRIBUTION - BASE_FOR_LIQUIDITY;
  const QUOTE_DECIMALS = 6;
  const SWAP_FEE_BPS = DEFAULT_SWAP_FEE_BPS;
  const BUY_AMOUNT_IN = parseDecimalTokenAmount(
    'SOLANA_COSIGNER_BUY_AMOUNT_USDC',
    QUOTE_DECIMALS,
  );
  if (BUY_AMOUNT_IN === 0n) {
    throw new Error(
      'SOLANA_COSIGNER_BUY_AMOUNT_USDC must be greater than zero',
    );
  }
  const minRaiseQuote = BUY_AMOUNT_IN > 1_000n ? BUY_AMOUNT_IN / 2n : 1n;
  const launchBeneficiaries = loadLaunchBeneficiaries({
    baseDecimals: BASE_DECIMALS,
    expectedDistributionAmount: BASE_FOR_DISTRIBUTION,
  });

  const numerairePriceUsd = 1;
  const { start } = cpmm.marketCapToCurveParams({
    startMarketCapUSD: 100_000,
    endMarketCapUSD: 10_000_000,
    baseTotalSupply: BASE_TOTAL_SUPPLY,
    baseForCurve: BASE_FOR_CURVE,
    baseDecimals: BASE_DECIMALS,
    quoteDecimals: QUOTE_DECIMALS,
    numerairePriceUSD: numerairePriceUsd,
  });

  const baseMint = await generateKeyPairSigner();
  const baseVault = await generateKeyPairSigner();
  const quoteVault = await generateKeyPairSigner();
  const metadata = DEFAULT_TEST_METADATA;

  const namespace = cosignerConfig;
  const launchId = initializer.launchIdFromU64(BigInt(Date.now()));
  const launchAddresses = await initializer.deriveCreateLaunchAddresses({
    deployment,
    namespace,
    launchId,
    baseMint,
    metadata,
  });
  const { launch, launchAuthority, launchFeeState } = launchAddresses;
  const [payerQuoteAta] = await findAssociatedTokenPda({
    owner: payer.address,
    mint: USDC_MINT,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  await assertTokenBalance({
    rpc,
    owner: payer.address,
    mint: USDC_MINT,
    tokenAccount: payerQuoteAta,
    amount: BUY_AMOUNT_IN,
  });

  const { signedHookRemainingAccounts, unsignedHookRemainingAccounts } =
    cosignerHook.getCosignerHookRemainingAccounts({ namespace, cosigner });

  console.log('Creating cosigner-gated launch...');
  console.log('  Launch:            ', launch);
  console.log('  Base mint:         ', baseMint.address);
  console.log('  Cosigner hook:     ', deployment.cosignerHookProgram);
  console.log('  Cosigner config:   ', cosignerConfig);
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
        quoteMint: USDC_MINT,
        baseVault,
        quoteVault,
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
      cosigner,
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
  const migrationAccounts = cpmmMigration;

  const launchSignature = await sendInitializeLaunchWithLookupTable({
    rpc,
    rpcSubscriptions,
    payer,
    instruction: initializeLaunchIx,
    metadata,
  });
  console.log('  Launch tx:         ', launchSignature);

  const [userBaseAta] = await findAssociatedTokenPda({
    owner: payer.address,
    mint: baseMint.address,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  const [userQuoteAta] = await findAssociatedTokenPda({
    owner: payer.address,
    mint: USDC_MINT,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  const setupAndFund = [
    getCreateAssociatedTokenIdempotentInstruction({
      payer,
      ata: userBaseAta,
      owner: payer.address,
      mint: baseMint.address,
    }),
    getCreateAssociatedTokenIdempotentInstruction({
      payer,
      ata: userQuoteAta,
      owner: payer.address,
      mint: USDC_MINT,
    }),
  ];
  const swapAccounts = {
    launch,
    launchAuthority,
    baseVault: baseVault.address,
    quoteVault: quoteVault.address,
    launchFeeState,
    userBaseAccount: userBaseAta,
    userQuoteAccount: userQuoteAta,
    baseMint: baseMint.address,
    quoteMint: USDC_MINT,
    user: payer,
    hookProgram: deployment.cosignerHookProgram,
    baseTokenProgram: TOKEN_PROGRAM_ADDRESS,
    quoteTokenProgram: TOKEN_PROGRAM_ADDRESS,
  };

  const unsignedSwapIx = initializer.createCurveSwapExactInInstruction(
    { ...swapAccounts, remainingAccounts: unsignedHookRemainingAccounts },
    {
      amountIn: BUY_AMOUNT_IN,
      minAmountOut: 1n,
      tradeDirection: initializer.TRADE_DIRECTION_BUY,
    },
    deployment.initializerProgram,
  );
  const unsignedResult = await simulateInstructions({
    rpc,
    payer,
    instructions: [...setupAndFund, unsignedSwapIx],
  });
  assertSimulationRejected('Unsigned bonding curve buy', unsignedResult.err);

  const signedSwapIx = initializer.createCurveSwapExactInInstruction(
    { ...swapAccounts, remainingAccounts: signedHookRemainingAccounts },
    {
      amountIn: BUY_AMOUNT_IN,
      minAmountOut: 1n,
      tradeDirection: initializer.TRADE_DIRECTION_BUY,
    },
    deployment.initializerProgram,
  );
  const buySignature = await sendInstructions({
    rpc,
    rpcSubscriptions,
    payer,
    instructions: [...setupAndFund, signedSwapIx],
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

  const { quoteVaultAmount, pendingQuoteFees } =
    await assertMigrationQuoteThreshold({
      rpc,
      quoteVault: quoteVault.address,
      pendingQuoteFees: initializer.getCurveSwapFeeAmount(
        BUY_AMOUNT_IN,
        SWAP_FEE_BPS,
      ),
      minRaiseQuote,
    });
  console.log('  Quote vault amount:', quoteVaultAmount.toString());
  console.log('  Pending quote fees:', pendingQuoteFees.toString());
  console.log('');

  const createRecipientAtaIxs = migrationAccounts.recipientAtas.map(
    (ata, index) =>
      getCreateAssociatedTokenIdempotentInstruction({
        payer,
        ata,
        owner: launchBeneficiaries.recipients[index].wallet,
        mint: baseMint.address,
      }),
  );

  const migrateLaunchIxBase = initializer.createMigrateLaunchInstruction(
    {
      config: deployment.initializerConfig,
      launch,
      launchAuthority,
      baseMint: baseMint.address,
      quoteMint: USDC_MINT,
      baseVault: baseVault.address,
      quoteVault: quoteVault.address,
      launchFeeState,
      migratorProgram: deployment.cpmmMigratorProgram,
      payer,
      baseTokenProgram: TOKEN_PROGRAM_ADDRESS,
      quoteTokenProgram: TOKEN_PROGRAM_ADDRESS,
      systemProgram: SYSTEM_PROGRAM_ADDRESS,
      rent: SYSVAR_RENT_ADDRESS,
    },
    deployment.initializerProgram,
  );
  const migrateLaunchIx = {
    ...migrateLaunchIxBase,
    accounts: [
      ...(migrateLaunchIxBase.accounts ?? []),
      ...migrationAccounts.metas,
    ],
  };
  const migrationSignature = await sendInstructions({
    rpc,
    rpcSubscriptions,
    payer,
    instructions: [
      createSetComputeUnitLimitInstruction(800_000),
      ...createRecipientAtaIxs,
      migrateLaunchIx,
    ],
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
    USDC_MINT,
    {
      commitment: 'confirmed',
      programId: deployment.cpmmProgram,
    },
  );
  if (!poolResult) {
    throw new Error('CPMM pool was not found after migration');
  }

  const { address: poolAddress, account: pool } = poolResult;
  if (pool.hookProgram !== SYSTEM_PROGRAM_ADDRESS || pool.hookFlags !== 0) {
    throw new Error(
      `Migrated pool hook mismatch: got program ${pool.hookProgram} flags ${pool.hookFlags}, expected no CPMM hook`,
    );
  }

  const tradeDirection = pool.token0Mint === baseMint.address ? 0 : 1;
  const CPMM_SWAP_AMOUNT_IN = 1_000_000n;
  const quote = cpmm.getSwapQuote(pool, CPMM_SWAP_AMOUNT_IN, tradeDirection);
  const minAmountOut = (quote.amountOut * 9_500n) / 10_000n;
  const userToken0 =
    pool.token0Mint === baseMint.address ? userBaseAta : userQuoteAta;
  const userToken1 =
    pool.token1Mint === baseMint.address ? userBaseAta : userQuoteAta;
  const cpmmSwapIx = cpmm.createSwapInstruction({
    config: migrationAccounts.cpmmConfig,
    pool: poolAddress,
    authority: pool.authority,
    vault0: pool.vault0,
    vault1: pool.vault1,
    token0Mint: pool.token0Mint,
    token1Mint: pool.token1Mint,
    userToken0,
    userToken1,
    user: payer,
    amountIn: CPMM_SWAP_AMOUNT_IN,
    minAmountOut,
    tradeDirection,
    programId: deployment.cpmmProgram,
  });
  const cpmmSwapSignature = await sendInstructions({
    rpc,
    rpcSubscriptions,
    payer,
    instructions: [createSetComputeUnitLimitInstruction(400_000), cpmmSwapIx],
  });
  console.log('  Ungated CPMM swap tx:', cpmmSwapSignature);
  console.log('');
  console.log('Cosigner-gated buy and ungated CPMM migration flow complete.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
