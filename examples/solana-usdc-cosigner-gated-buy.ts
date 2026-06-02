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
import {
  pipe,
  createTransactionMessage,
  generateKeyPairSigner,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  signTransactionMessageWithSigners,
  sendAndConfirmTransactionFactory,
  getSignatureFromTransaction,
  address,
  type Address,
  type TransactionSigner,
} from '@solana/kit';
import { SYSVAR_RENT_ADDRESS } from '@solana/sysvars';

import {
  cosignerHook,
  cpmm,
  initializer,
  cpmmMigrator,
} from '../src/solana/index.js';
import {
  assertTransactionFits,
  assertSolanaExampleNetwork,
  assertSimulationRejected,
  createLookupTableForInstruction,
  createSetComputeUnitLimitInstruction,
  createSolanaClientsFromEnv,
  getMetadataByteLength,
  getSolanaCpmmDeploymentFromEnv,
  loadKeypairSignerFromEnv,
  sendInstructions,
  simulateInstructions,
} from './solanaExampleHelpers.js';

type SolanaClients = ReturnType<typeof createSolanaClientsFromEnv>;
type LaunchBeneficiaryConfig = {
  recipients: { wallet: Address; amount: bigint }[];
  feeBeneficiaries: { wallet: Address; shareBps: number }[];
};

async function fetchOwnedTokenAmount({
  rpc,
  owner,
  mint,
  tokenAccount,
}: {
  rpc: SolanaClients['rpc'];
  owner: Address;
  mint: Address;
  tokenAccount: Address;
}): Promise<bigint | null> {
  const result = await rpc
    .getTokenAccountsByOwner(
      owner,
      { mint },
      { encoding: 'jsonParsed', commitment: 'confirmed' },
    )
    .send();
  const account = result.value.find(({ pubkey }) => pubkey === tokenAccount);
  return account
    ? BigInt(account.account.data.parsed.info.tokenAmount.amount)
    : null;
}

async function assertTokenBalance({
  rpc,
  owner,
  mint,
  tokenAccount,
  amount,
}: {
  rpc: SolanaClients['rpc'];
  owner: Address;
  mint: Address;
  tokenAccount: Address;
  amount: bigint;
}): Promise<void> {
  const balance = await fetchOwnedTokenAmount({
    rpc,
    owner,
    mint,
    tokenAccount,
  });
  if (balance === null || balance < amount) {
    throw new Error(
      `USDC token account ${tokenAccount} needs at least ${amount} atoms; current balance is ${balance ?? 0n}`,
    );
  }
}

// Standard devnet USDC mint.
const USDC_MINT: Address =
  '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU' as Address;

async function loadCosigner(): Promise<TransactionSigner> {
  if (!process.env.COSIGNER_KEYPAIR_PATH && !process.env.COSIGNER_KEYPAIR) {
    throw new Error(
      'COSIGNER_KEYPAIR_PATH or COSIGNER_KEYPAIR is required to sign cosigner-gated swaps.',
    );
  }

  return loadKeypairSignerFromEnv({
    pathEnv: 'COSIGNER_KEYPAIR_PATH',
    jsonEnv: 'COSIGNER_KEYPAIR',
    label: 'COSIGNER_KEYPAIR',
  });
}

async function fetchActiveCosigners({
  rpc,
  cosignerHookProgram,
  cosignerConfig,
}: {
  rpc: SolanaClients['rpc'];
  cosignerHookProgram: Address;
  cosignerConfig: Address;
}): Promise<Address[]> {
  const existingConfig = await cosignerHook.fetchMaybeCosignerConfig(
    rpc,
    cosignerConfig,
    { commitment: 'confirmed' },
  );

  if (!existingConfig.exists) {
    throw new Error(
      `Cosigner hook config ${cosignerConfig} does not exist. The integrator/admin must initialize it before running this flow.`,
    );
  }

  if (existingConfig.programAddress !== cosignerHookProgram) {
    throw new Error(
      `Cosigner hook config ${cosignerConfig} is owned by ${existingConfig.programAddress}, expected ${cosignerHookProgram}`,
    );
  }

  const activeCosigners = existingConfig.data.cosigners.slice(
    0,
    existingConfig.data.cosignerCount,
  );
  if (activeCosigners.length === 0) {
    throw new Error(
      `Cosigner hook config ${cosignerConfig} does not include any active cosigners`,
    );
  }

  return activeCosigners;
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function parseShareBps(name: string): number {
  const value = Number(requiredEnv(name));
  if (!Number.isInteger(value) || value <= 0 || value > 10_000) {
    throw new Error(`${name} must be an integer from 1 to 10000`);
  }
  return value;
}

function parseDecimalTokenAmount(name: string, decimals: number): bigint {
  const value = requiredEnv(name);
  if (!/^\d+(\.\d+)?$/.test(value)) {
    throw new Error(`${name} must be a non-negative decimal token amount`);
  }

  const [whole, fractional = ''] = value.split('.');
  if (fractional.length > decimals) {
    throw new Error(`${name} has more than ${decimals} decimal places`);
  }

  return (
    BigInt(whole) * 10n ** BigInt(decimals) +
    BigInt(fractional.padEnd(decimals, '0'))
  );
}

function loadLaunchBeneficiaries({
  baseDecimals,
  expectedDistributionAmount,
}: {
  baseDecimals: number;
  expectedDistributionAmount: bigint;
}): LaunchBeneficiaryConfig {
  const recipients: LaunchBeneficiaryConfig['recipients'] = [];
  const feeBeneficiaries: LaunchBeneficiaryConfig['feeBeneficiaries'] = [];

  for (let i = 1; i <= 2; i++) {
    const prefix = `SOLANA_FEE_BENEFICIARY_${i}`;
    const wallet = address(requiredEnv(`${prefix}_WALLET`));
    const amount = parseDecimalTokenAmount(
      `${prefix}_BASE_AMOUNT`,
      baseDecimals,
    );
    const shareBps = parseShareBps(`${prefix}_SHARE_BPS`);

    if (amount === 0n) {
      throw new Error(`${prefix}_BASE_AMOUNT must be greater than zero`);
    }

    recipients.push({ wallet, amount });
    feeBeneficiaries.push({ wallet, shareBps });
  }

  const totalAmount = recipients.reduce((sum, entry) => sum + entry.amount, 0n);
  if (totalAmount !== expectedDistributionAmount) {
    throw new Error(
      `SOLANA_FEE_BENEFICIARY_*_BASE_AMOUNT values must sum to ${expectedDistributionAmount} base atoms`,
    );
  }

  const totalShareBps = feeBeneficiaries.reduce(
    (sum, entry) => sum + entry.shareBps,
    0,
  );
  if (totalShareBps !== 10_000) {
    throw new Error(
      'SOLANA_FEE_BENEFICIARY_*_SHARE_BPS values must sum to 10000',
    );
  }

  return { recipients, feeBeneficiaries };
}

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
  const activeCosigners = await fetchActiveCosigners({
    rpc,
    cosignerHookProgram: deployment.cosignerHookProgram,
    cosignerConfig,
  });
  if (!activeCosigners.includes(cosigner.address)) {
    throw new Error(
      `COSIGNER_KEYPAIR resolves to ${cosigner.address}, which is not registered in cosigner hook config ${cosignerConfig}`,
    );
  }

  const BASE_DECIMALS = 6;
  const BASE_TOTAL_SUPPLY = 1_000_000_000n * 10n ** BigInt(BASE_DECIMALS);
  const BASE_FOR_DISTRIBUTION = 200_000_000n * 10n ** BigInt(BASE_DECIMALS);
  const BASE_FOR_LIQUIDITY = 50_000_000n * 10n ** BigInt(BASE_DECIMALS);
  const BASE_FOR_CURVE =
    BASE_TOTAL_SUPPLY - BASE_FOR_DISTRIBUTION - BASE_FOR_LIQUIDITY;
  const QUOTE_DECIMALS = 6;
  const SWAP_FEE_BPS = 200;
  const CPMM_SWAP_FEE_SPLIT_BPS = 10_000;
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
  const metadataAccount = await initializer.getTokenMetadataAddress(
    baseMint.address,
  );

  const namespace = cosignerConfig;
  const launchId = initializer.launchIdFromU64(BigInt(Date.now()));
  const [launch] = await initializer.getLaunchAddress(
    namespace,
    launchId,
    deployment.initializerProgram,
  );
  const [launchAuthority] = await initializer.getLaunchAuthorityAddress(
    launch,
    deployment.initializerProgram,
  );
  const [launchFeeState] = await initializer.getLaunchFeeStateAddress(
    launch,
    deployment.initializerProgram,
  );
  const [payerBaseAta] = await findAssociatedTokenPda({
    owner: payer.address,
    mint: baseMint.address,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
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
  const recipientAtas = await Promise.all(
    launchBeneficiaries.recipients.map(async ({ wallet }) => {
      const [ata] = await findAssociatedTokenPda({
        owner: wallet,
        mint: baseMint.address,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
      });
      return ata;
    }),
  );

  const migrationAccounts =
    await cpmmMigrator.buildCpmmMigrationRemainingAccounts({
      launch,
      baseMint: baseMint.address,
      quoteMint: USDC_MINT,
      launchAuthority,
      adminBaseAta: payerBaseAta,
      adminQuoteAta: payerQuoteAta,
      recipientAtas,
      cpmmProgram: deployment.cpmmProgram,
      cpmmMigratorProgram: deployment.cpmmMigratorProgram,
    });

  const signedHookRemainingAccounts = [namespace, cosigner];
  const unsignedHookRemainingAccounts = [namespace, cosigner.address];
  const hookRemainingAccountsHash = initializer.computeRemainingAccountsHash([
    namespace,
    cosigner.address,
  ]);

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

  const migratorInitPayload = cpmmMigrator.encodeRegisterLaunchPayload({
    cpmmConfig: migrationAccounts.cpmmConfig,
    initialSwapFeeBps: SWAP_FEE_BPS,
    initialFeeSplitBps: CPMM_SWAP_FEE_SPLIT_BPS,
    recipients: launchBeneficiaries.recipients,
    minRaiseQuote,
    minMigrationPriceQ64Opt: null,
    migratedPoolHookConfig: null,
  });
  const migratorMigratePayload = cpmmMigrator.encodeMigratePayload({
    baseForDistribution: BASE_FOR_DISTRIBUTION,
    baseForLiquidity: BASE_FOR_LIQUIDITY,
  });

  const metadata = {
    metadataName: 'TEST',
    metadataSymbol: 'TEST',
    metadataUri: 'https://example.com/metadata/test-token.json',
  };
  const initializeLaunchIx =
    await initializer.createInitializeLaunchInstruction(
      {
        config: deployment.initializerConfig,
        launch,
        launchAuthority,
        baseMint,
        quoteMint: USDC_MINT,
        baseVault,
        quoteVault,
        launchFeeState,
        payer,
        authority: payer,
        hookProgram: deployment.cosignerHookProgram,
        migratorProgram: deployment.cpmmMigratorProgram,
        cpmmConfig: migrationAccounts.cpmmConfig,
        baseTokenProgram: TOKEN_PROGRAM_ADDRESS,
        quoteTokenProgram: TOKEN_PROGRAM_ADDRESS,
        rent: SYSVAR_RENT_ADDRESS,
        metadataAccount,
      },
      {
        namespace,
        launchId,
        baseDecimals: BASE_DECIMALS,
        baseTotalSupply: BASE_TOTAL_SUPPLY,
        baseForDistribution: BASE_FOR_DISTRIBUTION,
        baseForLiquidity: BASE_FOR_LIQUIDITY,
        curveVirtualBase: start.curveVirtualBase,
        curveVirtualQuote: start.curveVirtualQuote,
        swapFeeBps: SWAP_FEE_BPS,
        curveKind: initializer.CURVE_KIND_XYK,
        curveParams: new Uint8Array([initializer.CURVE_PARAMS_FORMAT_XYK_V0]),
        allowBuy: true,
        allowSell: true,
        hookProgram: deployment.cosignerHookProgram,
        hookFlags:
          initializer.HF_BEFORE_SWAP | initializer.HF_FORWARD_READONLY_SIGNERS,
        hookPayload: new Uint8Array(),
        migratorInitPayload,
        migratorMigratePayload,
        hookRemainingAccountsHash,
        migratorInitRemainingAccountsHash:
          initializer.computeRemainingAccountsHash([
            migrationAccounts.cpmmMigrationState,
            migrationAccounts.cpmmConfig,
          ]),
        migratorRemainingAccountsHash: migrationAccounts.hash,
        feeBeneficiaries: launchBeneficiaries.feeBeneficiaries,
        ...metadata,
      },
      deployment.initializerProgram,
    );

  const lookupTable = await createLookupTableForInstruction({
    rpc,
    rpcSubscriptions,
    payer,
    instruction: initializeLaunchIx,
    label: 'initialize_launch lookup table',
  });
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
  const launchMessage = initializer.compressTransactionMessageWithLookupTable(
    pipe(
      createTransactionMessage({ version: 0 }),
      (tx) => setTransactionMessageFeePayerSigner(payer, tx),
      (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
      (tx) => appendTransactionMessageInstructions([initializeLaunchIx], tx),
    ),
    lookupTable,
  );
  assertTransactionFits(launchMessage, {
    label: 'initialize_launch',
    metadataBytes: getMetadataByteLength(metadata),
  });
  const signedLaunch = await signTransactionMessageWithSigners(launchMessage);
  await sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions })(
    signedLaunch as Parameters<
      ReturnType<typeof sendAndConfirmTransactionFactory>
    >[0],
    { commitment: 'confirmed' },
  );
  console.log(
    '  Launch tx:         ',
    getSignatureFromTransaction(signedLaunch),
  );

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
    config: deployment.initializerConfig,
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

  const quoteVaultBalance = await rpc
    .getTokenAccountBalance(quoteVault.address, { commitment: 'confirmed' })
    .send();
  const quoteVaultAmount = BigInt(quoteVaultBalance.value.amount);
  const pendingQuoteFees =
    (BUY_AMOUNT_IN * BigInt(SWAP_FEE_BPS) + 9_999n) / 10_000n;
  const migrationQuoteAmount = quoteVaultAmount - pendingQuoteFees;
  console.log('  Quote vault amount:', quoteVaultAmount.toString());
  console.log('  Pending quote fees:', pendingQuoteFees.toString());
  if (migrationQuoteAmount < minRaiseQuote) {
    throw new Error(
      `Migration quote amount ${migrationQuoteAmount} is below threshold ${minRaiseQuote}`,
    );
  }
  console.log('');

  const createRecipientAtaIxs = recipientAtas.map((ata, index) =>
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
