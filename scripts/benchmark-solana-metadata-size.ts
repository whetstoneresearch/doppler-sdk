import {
  appendTransactionMessageInstructions,
  createTransactionMessage,
  generateKeyPairSigner,
  getTransactionMessageSize,
  isTransactionMessageWithinSizeLimit,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  type Address,
} from '@solana/kit';
import { SYSTEM_PROGRAM_ADDRESS } from '@solana-program/system';
import {
  findAssociatedTokenPda,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import { SYSVAR_RENT_ADDRESS } from '@solana/sysvars';

import {
  cpmm,
  cpmmMigrator,
  initializer,
  predictionMigrator,
  trustedOracle,
} from '../src/solana/index.js';

const WSOL_MINT = 'So11111111111111111111111111111111111111112' as Address;
const TX_SIZE_LIMIT = 1232;
const METADATA_NAME = 'N'.repeat(20);
const METADATA_SYMBOL = 'S'.repeat(10);
const SAMPLE_METADATA = {
  metadataName: 'TEST',
  metadataSymbol: 'TEST',
  metadataUri: 'https://example.com/metadata/test-token.json',
};
const REQUESTED_METADATA = {
  metadataName: 'Frenzy Devnet Cosigner',
  metadataSymbol: 'FDC',
  metadataUri: 'https://example.com/frenzy-devnet-cosigner.json',
};
const DUMMY_BLOCKHASH = {
  blockhash: '11111111111111111111111111111111',
  lastValidBlockHeight: 0n,
};

type Shape = 'simple' | 'advanced';

interface BenchmarkContext {
  shape: Shape;
  migratedPoolHookConfig: boolean;
  payer: Awaited<ReturnType<typeof generateKeyPairSigner>>;
  baseMint: Awaited<ReturnType<typeof generateKeyPairSigner>>;
  baseVault: Awaited<ReturnType<typeof generateKeyPairSigner>>;
  quoteVault: Awaited<ReturnType<typeof generateKeyPairSigner>>;
  launch: Address;
  launchAuthority: Address;
  initializerConfig: Address;
  cpmmConfig: Address;
  cpmmMigrationState: Address;
  migrationHash: Uint8Array;
  metadataAccount: Address;
  migratorInitPayload: Uint8Array;
  migratorMigratePayload: Uint8Array;
}

function metadataBytes(metadata: {
  metadataName: string;
  metadataSymbol: string;
  metadataUri: string;
}): number {
  const encoder = new TextEncoder();
  return (
    encoder.encode(metadata.metadataName).length +
    encoder.encode(metadata.metadataSymbol).length +
    encoder.encode(metadata.metadataUri).length
  );
}

async function setupContext(
  shape: Shape,
  {
    migratedPoolHookConfig = false,
  }: {
    migratedPoolHookConfig?: boolean;
  } = {},
): Promise<BenchmarkContext> {
  const payer = await generateKeyPairSigner();
  const baseMint = await generateKeyPairSigner();
  const baseVault = await generateKeyPairSigner();
  const quoteVault = await generateKeyPairSigner();

  const namespace = payer.address;
  const launchId = initializer.launchIdFromU64(shape === 'simple' ? 1n : 2n);
  const [launch] = await initializer.getLaunchAddress(namespace, launchId);
  const [launchAuthority] = await initializer.getLaunchAuthorityAddress(launch);
  const [initializerConfig] = await initializer.getConfigAddress();
  const metadataAccount = await initializer.getTokenMetadataAddress(
    baseMint.address,
  );

  const [payerBaseAta] = await findAssociatedTokenPda({
    owner: payer.address,
    mint: baseMint.address,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  const [payerQuoteAta] = await findAssociatedTokenPda({
    owner: payer.address,
    mint: WSOL_MINT,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });

  const recipientAtas =
    shape === 'advanced' ? [payerBaseAta, payerBaseAta] : [];
  const migrationAccounts =
    await cpmmMigrator.buildCpmmMigrationRemainingAccounts({
      launch,
      baseMint: baseMint.address,
      quoteMint: WSOL_MINT,
      launchAuthority,
      adminBaseAta: payerBaseAta,
      adminQuoteAta: payerQuoteAta,
      recipientAtas,
    });

  const baseDecimals = 6;
  const baseForDistribution =
    shape === 'advanced' ? 200_000_000n * 10n ** BigInt(baseDecimals) : 0n;
  const baseForLiquidity =
    shape === 'advanced' ? 50_000_000n * 10n ** BigInt(baseDecimals) : 0n;
  const creatorShare = (baseForDistribution * 70n) / 100n;
  const teamShare = baseForDistribution - creatorShare;

  const migratorInitPayload = cpmmMigrator.encodeRegisterLaunchPayload({
    cpmmConfig: migrationAccounts.cpmmConfig,
    initialSwapFeeBps: 100,
    initialFeeSplitBps: 5000,
    recipients:
      shape === 'advanced'
        ? [
            { wallet: payer.address, amount: creatorShare },
            { wallet: payer.address, amount: teamShare },
          ]
        : [],
    minRaiseQuote: 50n * 1_000_000_000n,
    minMigrationPriceQ64Opt: null,
    migratedPoolHookConfig: migratedPoolHookConfig
      ? {
          hookProgram: initializer.CPMM_HOOK_PROGRAM_ID,
          hookFlags: cpmm.HF_BEFORE_SWAP | cpmm.HF_FORWARD_READONLY_SIGNERS,
        }
      : null,
  });

  const migratorMigratePayload = cpmmMigrator.encodeMigratePayload({
    baseForDistribution,
    baseForLiquidity,
  });

  return {
    shape,
    migratedPoolHookConfig,
    payer,
    baseMint,
    baseVault,
    quoteVault,
    launch,
    launchAuthority,
    initializerConfig,
    cpmmConfig: migrationAccounts.cpmmConfig,
    cpmmMigrationState: migrationAccounts.cpmmMigrationState,
    migrationHash: migrationAccounts.hash,
    metadataAccount,
    migratorInitPayload,
    migratorMigratePayload,
  };
}

async function buildMessage(
  context: BenchmarkContext,
  metadata: {
    metadataName: string;
    metadataSymbol: string;
    metadataUri: string;
  },
  options: { simulateLaunchAlt?: boolean } = {},
) {
  const baseDecimals = 6;
  const baseTotalSupply = 1_000_000_000n * 10n ** BigInt(baseDecimals);
  const baseForDistribution =
    context.shape === 'advanced'
      ? 200_000_000n * 10n ** BigInt(baseDecimals)
      : 0n;
  const baseForLiquidity =
    context.shape === 'advanced'
      ? 50_000_000n * 10n ** BigInt(baseDecimals)
      : 0n;

  const ix = await initializer.createInitializeLaunchInstruction(
    {
      config: context.initializerConfig,
      launch: context.launch,
      launchAuthority: context.launchAuthority,
      baseMint: context.baseMint,
      quoteMint: WSOL_MINT,
      baseVault: context.baseVault,
      quoteVault: context.quoteVault,
      payer: context.payer,
      authority: context.payer,
      migratorProgram: cpmmMigrator.CPMM_MIGRATOR_PROGRAM_ID,
      cpmmConfig: context.cpmmConfig,
      baseTokenProgram: TOKEN_PROGRAM_ADDRESS,
      quoteTokenProgram: TOKEN_PROGRAM_ADDRESS,
      systemProgram: SYSTEM_PROGRAM_ADDRESS,
      rent: SYSVAR_RENT_ADDRESS,
      metadataAccount: context.metadataAccount,
    },
    {
      namespace: context.payer.address,
      launchId: initializer.launchIdFromU64(
        context.shape === 'simple' ? 1n : 2n,
      ),
      baseDecimals,
      baseTotalSupply,
      baseForDistribution,
      baseForLiquidity,
      curveVirtualBase: 1_000_000_000n,
      curveVirtualQuote: 1_000_000_000n,
      curveFeeBps: 200,
      curveKind: initializer.CURVE_KIND_XYK,
      curveParams: new Uint8Array([initializer.CURVE_PARAMS_FORMAT_XYK_V0]),
      allowBuy: true,
      allowSell: true,
      hookFlags: initializer.HF_BEFORE_SWAP,
      hookPayload: new Uint8Array(),
      migratorInitPayload: context.migratorInitPayload,
      migratorMigratePayload: context.migratorMigratePayload,
      hookRemainingAccountsHash: initializer.EMPTY_REMAINING_ACCOUNTS_HASH,
      migratorInitRemainingAccountsHash:
        initializer.computeRemainingAccountsHash([
          context.cpmmMigrationState,
          context.cpmmConfig,
        ]),
      migratorRemainingAccountsHash: context.migrationHash,
      feeBeneficiaries: [{ wallet: context.payer.address, shareBps: 10_000 }],
      ...metadata,
    },
  );

  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayerSigner(context.payer, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(DUMMY_BLOCKHASH, tx),
    (tx) => appendTransactionMessageInstructions([ix], tx),
  );

  return options.simulateLaunchAlt
    ? initializer.compressTransactionMessageWithLookupTable(message, {
        lookupTableAddress:
          '7r5rdLkGMzTq5Q2kBhkePw4ZTeZEooHgTXktYoamNmVq' as Address,
        addresses: initializer.getInstructionLookupTableAddresses(ix),
      })
    : message;
}

async function measure(
  context: BenchmarkContext,
  metadata: {
    metadataName: string;
    metadataSymbol: string;
    metadataUri: string;
  },
  options: { simulateLaunchAlt?: boolean } = {},
) {
  const message = await buildMessage(context, metadata, options);
  const size = getTransactionMessageSize(message);
  return {
    size,
    fits: isTransactionMessageWithinSizeLimit(message),
    remaining: TX_SIZE_LIMIT - size,
    metadataBytes: metadataBytes(metadata),
  };
}

async function buildPredictionMessage(metadata: {
  metadataName: string;
  metadataSymbol: string;
  metadataUri: string;
}) {
  const payer = await generateKeyPairSigner();
  const baseMint = await generateKeyPairSigner();
  const baseVault = await generateKeyPairSigner();
  const quoteVault = await generateKeyPairSigner();
  const oracleNonce = 1n;
  const [oracleStateAddress] = await trustedOracle.getOracleStateAddress(
    payer.address,
    oracleNonce,
  );
  const namespace = oracleStateAddress;
  const entryId = new Uint8Array(32);
  entryId.set(new TextEncoder().encode('YES'));
  const launchId = entryId;
  const [config] = await initializer.getConfigAddress();
  const [launch] = await initializer.getLaunchAddress(namespace, launchId);
  const [launchAuthority] = await initializer.getLaunchAuthorityAddress(launch);
  const metadataAccount = await initializer.getTokenMetadataAddress(
    baseMint.address,
  );

  const [market] = await predictionMigrator.getPredictionMarketAddress(
    oracleStateAddress,
    WSOL_MINT,
  );
  const [potVault] =
    await predictionMigrator.getPredictionPotVaultAddress(market);
  const [marketAuthority] =
    await predictionMigrator.getPredictionMarketAuthorityAddress(market);
  const [entryAddress] = await predictionMigrator.getPredictionEntryAddress(
    market,
    entryId,
  );
  const [entryByMint] =
    await predictionMigrator.getPredictionEntryByMintAddress(
      market,
      baseMint.address,
    );

  const migratorAccounts = [
    oracleStateAddress,
    market,
    potVault,
    marketAuthority,
    entryAddress,
    entryByMint,
  ];

  const baseDecimals = 6;
  const baseTotalSupply = 1_000_000_000n * 10n ** BigInt(baseDecimals);
  const ix = await initializer.createInitializeLaunchInstruction(
    {
      config,
      launch,
      launchAuthority,
      baseMint,
      quoteMint: WSOL_MINT,
      baseVault,
      quoteVault,
      payer,
      authority: payer,
      migratorProgram: predictionMigrator.PREDICTION_MIGRATOR_PROGRAM_ADDRESS,
      baseTokenProgram: TOKEN_PROGRAM_ADDRESS,
      quoteTokenProgram: TOKEN_PROGRAM_ADDRESS,
      systemProgram: SYSTEM_PROGRAM_ADDRESS,
      rent: SYSVAR_RENT_ADDRESS,
      metadataAccount,
    },
    {
      namespace,
      launchId,
      baseDecimals,
      baseTotalSupply,
      baseForDistribution: 0n,
      baseForLiquidity: 0n,
      curveVirtualBase: baseTotalSupply,
      curveVirtualQuote: 500_000_000n,
      curveFeeBps: 100,
      curveKind: initializer.CURVE_KIND_XYK,
      curveParams: new Uint8Array([initializer.CURVE_PARAMS_FORMAT_XYK_V0]),
      allowBuy: true,
      allowSell: true,
      hookFlags: initializer.HF_BEFORE_SWAP,
      hookPayload: new Uint8Array(),
      migratorInitPayload: predictionMigrator
        .getRegisterEntryInstructionDataEncoder()
        .encode({ entryId }),
      migratorMigratePayload: predictionMigrator
        .getMigrateEntryInstructionDataEncoder()
        .encode({ entryId }),
      hookRemainingAccountsHash: initializer.computeRemainingAccountsHash([
        oracleStateAddress,
      ]),
      migratorInitRemainingAccountsHash:
        initializer.computeRemainingAccountsHash(migratorAccounts),
      migratorRemainingAccountsHash:
        initializer.computeRemainingAccountsHash(migratorAccounts),
      ...metadata,
    },
  );

  return pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayerSigner(payer, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(DUMMY_BLOCKHASH, tx),
    (tx) => appendTransactionMessageInstructions([ix], tx),
  );
}

async function measurePrediction(metadata: {
  metadataName: string;
  metadataSymbol: string;
  metadataUri: string;
}) {
  const message = await buildPredictionMessage(metadata);
  const size = getTransactionMessageSize(message);
  return {
    size,
    fits: isTransactionMessageWithinSizeLimit(message),
    remaining: TX_SIZE_LIMIT - size,
    metadataBytes: metadataBytes(metadata),
  };
}

async function findMaxUriBytes(
  context: BenchmarkContext,
  options: { simulateLaunchAlt?: boolean } = {},
): Promise<number> {
  let low = 0;
  let high = 512;

  while (
    (
      await measure(context, {
        metadataName: METADATA_NAME,
        metadataSymbol: METADATA_SYMBOL,
        metadataUri: 'u'.repeat(high),
      }, options)
    ).fits
  ) {
    low = high;
    high *= 2;
  }

  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const result = await measure(context, {
      metadataName: METADATA_NAME,
      metadataSymbol: METADATA_SYMBOL,
      metadataUri: 'u'.repeat(mid),
    }, options);
    if (result.fits) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  return low;
}

async function findMaxPredictionUriBytes(): Promise<number> {
  let low = 0;
  let high = 512;

  while (
    (
      await measurePrediction({
        metadataName: METADATA_NAME,
        metadataSymbol: METADATA_SYMBOL,
        metadataUri: 'u'.repeat(high),
      })
    ).fits
  ) {
    low = high;
    high *= 2;
  }

  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const result = await measurePrediction({
      metadataName: METADATA_NAME,
      metadataSymbol: METADATA_SYMBOL,
      metadataUri: 'u'.repeat(mid),
    });
    if (result.fits) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  return low;
}

async function benchmark(
  shape: Shape,
  options: { migratedPoolHookConfig?: boolean } = {},
) {
  const context = await setupContext(shape, options);
  const empty = await measure(context, {
    metadataName: '',
    metadataSymbol: '',
    metadataUri: '',
  });
  const fixedNoUri = await measure(context, {
    metadataName: METADATA_NAME,
    metadataSymbol: METADATA_SYMBOL,
    metadataUri: '',
  });
  const maxUriBytes = await findMaxUriBytes(context);
  const max = await measure(context, {
    metadataName: METADATA_NAME,
    metadataSymbol: METADATA_SYMBOL,
    metadataUri: 'u'.repeat(maxUriBytes),
  });
  const sample = await measure(context, SAMPLE_METADATA);
  const requested = await measure(context, REQUESTED_METADATA);
  const launchAltMaxUriBytes = await findMaxUriBytes(context, {
    simulateLaunchAlt: true,
  });
  const launchAltMax = await measure(context, {
    metadataName: METADATA_NAME,
    metadataSymbol: METADATA_SYMBOL,
    metadataUri: 'u'.repeat(launchAltMaxUriBytes),
  }, {
    simulateLaunchAlt: true,
  });
  const launchAltSample = await measure(context, SAMPLE_METADATA, {
    simulateLaunchAlt: true,
  });
  const launchAltRequested = await measure(context, REQUESTED_METADATA, {
    simulateLaunchAlt: true,
  });

  return {
    shape: context.migratedPoolHookConfig ? `${shape}+hook` : shape,
    emptySize: empty.size,
    fixedNameSymbolSize: fixedNoUri.size,
    nameBytes: METADATA_NAME.length,
    symbolBytes: METADATA_SYMBOL.length,
    maxUriBytes,
    maxMetadataBytes: max.metadataBytes,
    maxSize: max.size,
    maxRemainingBytes: max.remaining,
    sampleMetadataBytes: sample.metadataBytes,
    sampleSize: sample.size,
    sampleRemainingBytes: sample.remaining,
    requestedMetadataBytes: requested.metadataBytes,
    requestedSize: requested.size,
    requestedFits: requested.fits,
    requestedRemainingBytes: requested.remaining,
    requestedOverflowBytes: Math.max(0, -requested.remaining),
    requestedExtraMetadataBytes: max.metadataBytes - requested.metadataBytes,
    launchAltMaxUriBytes,
    launchAltMaxMetadataBytes: launchAltMax.metadataBytes,
    launchAltSampleSize: launchAltSample.size,
    launchAltSampleRemainingBytes: launchAltSample.remaining,
    launchAltRequestedSize: launchAltRequested.size,
    launchAltRequestedFits: launchAltRequested.fits,
    launchAltRequestedRemainingBytes: launchAltRequested.remaining,
    launchAltRequestedOverflowBytes: Math.max(
      0,
      -launchAltRequested.remaining,
    ),
    launchAltRequestedExtraMetadataBytes:
      launchAltMax.metadataBytes - launchAltRequested.metadataBytes,
  };
}

async function benchmarkPrediction() {
  const empty = await measurePrediction({
    metadataName: '',
    metadataSymbol: '',
    metadataUri: '',
  });
  const fixedNoUri = await measurePrediction({
    metadataName: METADATA_NAME,
    metadataSymbol: METADATA_SYMBOL,
    metadataUri: '',
  });
  const maxUriBytes = await findMaxPredictionUriBytes();
  const max = await measurePrediction({
    metadataName: METADATA_NAME,
    metadataSymbol: METADATA_SYMBOL,
    metadataUri: 'u'.repeat(maxUriBytes),
  });
  const sample = await measurePrediction(SAMPLE_METADATA);
  const requested = await measurePrediction(REQUESTED_METADATA);

  return {
    shape: 'prediction',
    emptySize: empty.size,
    fixedNameSymbolSize: fixedNoUri.size,
    nameBytes: METADATA_NAME.length,
    symbolBytes: METADATA_SYMBOL.length,
    maxUriBytes,
    maxMetadataBytes: max.metadataBytes,
    maxSize: max.size,
    maxRemainingBytes: max.remaining,
    sampleMetadataBytes: sample.metadataBytes,
    sampleSize: sample.size,
    sampleRemainingBytes: sample.remaining,
    requestedMetadataBytes: requested.metadataBytes,
    requestedSize: requested.size,
    requestedFits: requested.fits,
    requestedRemainingBytes: requested.remaining,
    requestedOverflowBytes: Math.max(0, -requested.remaining),
    requestedExtraMetadataBytes: max.metadataBytes - requested.metadataBytes,
  };
}

const results = await Promise.all([
  benchmark('simple'),
  benchmark('simple', { migratedPoolHookConfig: true }),
  benchmark('advanced'),
  benchmark('advanced', { migratedPoolHookConfig: true }),
  benchmarkPrediction(),
]);

console.table(results);
console.log(
  `Assumptions: ASCII name=${METADATA_NAME.length} bytes, symbol=${METADATA_SYMBOL.length} bytes, sample=${JSON.stringify(SAMPLE_METADATA)}, requested=${JSON.stringify(REQUESTED_METADATA)}, variable URI, launch-specific ALT simulation enabled.`,
);
