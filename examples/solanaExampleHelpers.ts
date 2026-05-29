import { readFileSync } from 'node:fs';

import {
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  appendTransactionMessageInstructions,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  getTransactionMessageSize,
  getMinimumBalanceForRentExemption,
  getSignatureFromTransaction,
  isTransactionMessageWithinSizeLimit,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  address,
  generateKeyPairSigner,
  type Address,
  type Instruction,
  type TransactionMessage,
  type TransactionMessageWithFeePayer,
  type TransactionSigner,
} from '@solana/kit';

import {
  DOPPLER_SOLANA_DEVNET_PROGRAM_ADDRESSES,
  cosignerHook,
  deriveSolanaCpmmDeployment,
  initializer,
  type SolanaCpmmDeployment,
  type SolanaCpmmProgramAddresses,
} from '../src/solana/index.js';

export const SOLANA_NETWORK_ENDPOINTS = {
  devnet: {
    rpcUrl: 'https://api.devnet.solana.com',
    wsUrl: 'wss://api.devnet.solana.com',
  },
} as const;
export type SolanaExampleNetwork =
  | keyof typeof SOLANA_NETWORK_ENDPOINTS
  | 'custom';
export const DEFAULT_SOLANA_EXAMPLE_NETWORK: SolanaExampleNetwork = 'devnet';
export const TOKEN_ACCOUNT_SPACE = 165n;
export const SOLANA_TRANSACTION_SIZE_LIMIT = 1232;
export const WSOL_MINT = address('So11111111111111111111111111111111111111112');
export const DEVNET_USDC_MINT = address(
  '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
);
export const DEFAULT_TEST_METADATA = {
  metadataName: 'TEST',
  metadataSymbol: 'TEST',
  metadataUri: 'https://example.com/metadata/test-token.json',
} as const;
export const DEFAULT_SWAP_FEE_BPS = 200;
export const DEFAULT_CPMM_FEE_SPLIT_BPS = 10_000;

const COMPUTE_BUDGET_PROGRAM_ID = address(
  'ComputeBudget111111111111111111111111111111',
);

export function createSolanaClientsFromEnv() {
  const network = parseSolanaNetwork(
    process.env.SOLANA_NETWORK ?? DEFAULT_SOLANA_EXAMPLE_NETWORK,
  );
  const defaultEndpoints =
    network === 'custom' ? undefined : SOLANA_NETWORK_ENDPOINTS[network];
  const rpcUrl = process.env.SOLANA_RPC_URL ?? defaultEndpoints?.rpcUrl;
  const wsUrl = process.env.SOLANA_WS_URL ?? defaultEndpoints?.wsUrl;

  if (!rpcUrl || !wsUrl) {
    throw new Error(
      'SOLANA_RPC_URL and SOLANA_WS_URL must be set when SOLANA_NETWORK=custom',
    );
  }

  return {
    rpc: createSolanaRpc(rpcUrl),
    rpcSubscriptions: createSolanaRpcSubscriptions(wsUrl),
    network,
    rpcUrl,
    wsUrl,
  };
}

export function assertSolanaExampleNetwork(
  network: SolanaExampleNetwork,
  supportedNetworks: readonly SolanaExampleNetwork[] = ['devnet'],
): void {
  if (supportedNetworks.includes(network)) {
    return;
  }

  throw new Error(
    `This example supports SOLANA_NETWORK=${supportedNetworks.join(
      ' or ',
    )}. Current SOLANA_NETWORK=${network}. Use matching program/config addresses before running on another Solana network.`,
  );
}

function parseSolanaNetwork(value: string): SolanaExampleNetwork {
  if (value === 'devnet' || value === 'custom') {
    return value;
  }

  throw new Error(`Unsupported SOLANA_NETWORK=${value}. Use devnet or custom.`);
}

const CUSTOM_CPMM_PROGRAM_ENV = {
  cpmmProgram: 'SOLANA_CPMM_PROGRAM_ID',
  initializerProgram: 'SOLANA_INITIALIZER_PROGRAM_ID',
  cpmmMigratorProgram: 'SOLANA_CPMM_MIGRATOR_PROGRAM_ID',
  cpmmHookProgram: 'SOLANA_CPMM_HOOK_PROGRAM_ID',
  cosignerHookProgram: 'SOLANA_COSIGNER_HOOK_PROGRAM_ID',
} as const satisfies Record<keyof SolanaCpmmProgramAddresses, string>;

function requiredAddressFromEnv(name: string): Address {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required when SOLANA_NETWORK=custom`);
  }
  return address(value);
}

export function getSolanaCpmmProgramAddressesFromEnv(): SolanaCpmmProgramAddresses {
  return {
    cpmmProgram: requiredAddressFromEnv(CUSTOM_CPMM_PROGRAM_ENV.cpmmProgram),
    initializerProgram: requiredAddressFromEnv(
      CUSTOM_CPMM_PROGRAM_ENV.initializerProgram,
    ),
    cpmmMigratorProgram: requiredAddressFromEnv(
      CUSTOM_CPMM_PROGRAM_ENV.cpmmMigratorProgram,
    ),
    cpmmHookProgram: requiredAddressFromEnv(
      CUSTOM_CPMM_PROGRAM_ENV.cpmmHookProgram,
    ),
    cosignerHookProgram: requiredAddressFromEnv(
      CUSTOM_CPMM_PROGRAM_ENV.cosignerHookProgram,
    ),
  };
}

export async function getSolanaCpmmDeploymentFromEnv(
  network: SolanaExampleNetwork = parseSolanaNetwork(
    process.env.SOLANA_NETWORK ?? DEFAULT_SOLANA_EXAMPLE_NETWORK,
  ),
): Promise<SolanaCpmmDeployment> {
  const programs =
    network === 'custom'
      ? getSolanaCpmmProgramAddressesFromEnv()
      : DOPPLER_SOLANA_DEVNET_PROGRAM_ADDRESSES;
  return deriveSolanaCpmmDeployment(programs);
}

export async function loadKeypairSignerFromEnv({
  pathEnv = 'SOLANA_KEYPAIR_PATH',
  jsonEnv = 'SOLANA_KEYPAIR',
  label = 'SOLANA_KEYPAIR',
}: {
  pathEnv?: string;
  jsonEnv?: string;
  label?: string;
} = {}): Promise<TransactionSigner> {
  const keypairJson = process.env[pathEnv]
    ? readFileSync(process.env[pathEnv]!, 'utf8')
    : process.env[jsonEnv];

  if (!keypairJson) {
    throw new Error(
      `${label} must be set as ${pathEnv}=path/to/keypair.json or ${jsonEnv}='[64 byte JSON array]'`,
    );
  }

  return createKeyPairSignerFromBytes(
    new Uint8Array(JSON.parse(keypairJson) as number[]),
  );
}

export function createSetComputeUnitLimitInstruction(
  units: number,
): Instruction {
  const data = new Uint8Array(5);
  data[0] = 2;
  new DataView(data.buffer).setUint32(1, units, true);
  return {
    programAddress: COMPUTE_BUDGET_PROGRAM_ID,
    accounts: [],
    data,
  };
}

export function getTokenAccountRentLamports(): bigint {
  return getMinimumBalanceForRentExemption(TOKEN_ACCOUNT_SPACE);
}

export function getMetadataByteLength(params: {
  metadataName?: string;
  metadataSymbol?: string;
  metadataUri?: string;
}): number {
  const encoder = new TextEncoder();
  return (
    encoder.encode(params.metadataName ?? '').length +
    encoder.encode(params.metadataSymbol ?? '').length +
    encoder.encode(params.metadataUri ?? '').length
  );
}

export function assertTransactionFits(
  transactionMessage: TransactionMessage & TransactionMessageWithFeePayer,
  {
    label = 'Transaction',
    metadataBytes,
  }: {
    label?: string;
    metadataBytes?: number;
  } = {},
): void {
  if (isTransactionMessageWithinSizeLimit(transactionMessage)) {
    return;
  }

  const size = getTransactionMessageSize(transactionMessage);
  const overBy = size - SOLANA_TRANSACTION_SIZE_LIMIT;
  const metadataHint =
    metadataBytes && metadataBytes > 0
      ? ` Metadata contributes ${metadataBytes} instruction-data bytes; address lookup tables do not compress metadata strings.`
      : '';

  throw new Error(
    `${label} is ${size} bytes, exceeding Solana's ${SOLANA_TRANSACTION_SIZE_LIMIT}-byte transaction limit by ${overBy} bytes.${metadataHint}`,
  );
}

type SolanaClients = ReturnType<typeof createSolanaClientsFromEnv>;

export async function signInstructions({
  rpc,
  payer,
  instructions,
}: {
  rpc: SolanaClients['rpc'];
  payer: TransactionSigner;
  instructions: Instruction[];
}) {
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

  const transactionMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayerSigner(payer, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) => appendTransactionMessageInstructions(instructions, tx),
  );

  return signTransactionMessageWithSigners(transactionMessage);
}

export async function sendInstructions({
  rpc,
  rpcSubscriptions,
  payer,
  instructions,
}: {
  rpc: SolanaClients['rpc'];
  rpcSubscriptions: SolanaClients['rpcSubscriptions'];
  payer: TransactionSigner;
  instructions: Instruction[];
}): Promise<string> {
  const signedTransaction = await signInstructions({
    rpc,
    payer,
    instructions,
  });
  const sendAndConfirmTransaction = sendAndConfirmTransactionFactory({
    rpc,
    rpcSubscriptions,
  });

  await sendAndConfirmTransaction(
    signedTransaction as Parameters<typeof sendAndConfirmTransaction>[0],
    {
      commitment: 'confirmed',
    },
  );

  return getSignatureFromTransaction(signedTransaction);
}

export async function simulateInstructions({
  rpc,
  payer,
  instructions,
}: {
  rpc: SolanaClients['rpc'];
  payer: TransactionSigner;
  instructions: Instruction[];
}) {
  const signedTransaction = await signInstructions({
    rpc,
    payer,
    instructions,
  });

  const { value } = await rpc
    .simulateTransaction(getBase64EncodedWireTransaction(signedTransaction), {
      encoding: 'base64',
      replaceRecentBlockhash: true,
    })
    .send();

  return value;
}

function formatSimulationError(err: unknown): string {
  if (typeof err === 'string') {
    return err;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export function assertSimulationRejected(label: string, err: unknown): void {
  if (!err) {
    throw new Error(`${label} unexpectedly simulated successfully`);
  }
  console.log(`  ${label} rejected as expected: ${formatSimulationError(err)}`);
}

async function waitForSlotAfter(
  rpc: SolanaClients['rpc'],
  slot: number | bigint,
): Promise<void> {
  const minSlot = BigInt(slot);
  for (let attempt = 0; attempt < 30; attempt++) {
    const currentSlot = await rpc.getSlot({ commitment: 'confirmed' }).send();
    if (BigInt(currentSlot) > minSlot) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error('Timed out waiting for address lookup table warmup slot');
}

export async function createLookupTableForInstruction({
  rpc,
  rpcSubscriptions,
  payer,
  instruction,
  label = 'address lookup table',
}: {
  rpc: SolanaClients['rpc'];
  rpcSubscriptions: SolanaClients['rpcSubscriptions'];
  payer: TransactionSigner;
  instruction: Instruction;
  label?: string;
}) {
  const recentSlot = await rpc.getSlot({ commitment: 'finalized' }).send();
  const addresses = initializer.getInstructionLookupTableAddresses(instruction);
  const authority = await generateKeyPairSigner();
  const lookupTable =
    await initializer.buildAddressLookupTableSetupInstructions({
      authority,
      payer,
      recentSlot,
      addresses,
    });

  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
  const setupMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayerSigner(payer, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) =>
      appendTransactionMessageInstructions(
        [lookupTable.createInstruction, ...lookupTable.extendInstructions],
        tx,
      ),
  );

  const signedSetup = await signTransactionMessageWithSigners(setupMessage);
  const sendAndConfirmTransaction = sendAndConfirmTransactionFactory({
    rpc,
    rpcSubscriptions,
  });
  await sendAndConfirmTransaction(
    signedSetup as Parameters<typeof sendAndConfirmTransaction>[0],
    {
      commitment: 'confirmed',
    },
  );
  const setupSlot = await rpc.getSlot({ commitment: 'confirmed' }).send();
  await waitForSlotAfter(rpc, setupSlot);

  console.log(
    `${label} created: ${lookupTable.lookupTableAddress} (${lookupTable.addresses.length} addresses, tx=${getSignatureFromTransaction(signedSetup)})`,
  );

  return lookupTable;
}

export type LaunchBeneficiaryConfig = {
  recipients: { wallet: Address; amount: bigint }[];
  feeBeneficiaries: { wallet: Address; shareBps: number }[];
};

export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(name + ' is required');
  }
  return value;
}

export function parseShareBps(name: string): number {
  const value = Number(requiredEnv(name));
  if (!Number.isInteger(value) || value <= 0 || value > 10_000) {
    throw new Error(name + ' must be an integer from 1 to 10000');
  }
  return value;
}

export function parseDecimalTokenAmount(
  name: string,
  decimals: number,
): bigint {
  const raw = requiredEnv(name);
  const [whole, fraction = ''] = raw.split('.');
  if (!whole || !/^\d+$/.test(whole) || !/^\d*$/.test(fraction)) {
    throw new Error(name + ' must be a non-negative decimal amount');
  }
  if (fraction.length > decimals) {
    throw new Error(name + ' supports at most ' + decimals + ' decimal places');
  }

  const paddedFraction = fraction.padEnd(decimals, '0');
  return BigInt(whole + paddedFraction);
}

export function loadLaunchBeneficiaries({
  baseDecimals,
  expectedDistributionAmount,
  count = 2,
}: {
  baseDecimals: number;
  expectedDistributionAmount: bigint;
  count?: number;
}): LaunchBeneficiaryConfig {
  const recipients: LaunchBeneficiaryConfig['recipients'] = [];
  const feeBeneficiaries: LaunchBeneficiaryConfig['feeBeneficiaries'] = [];

  for (let index = 0; index < count; index++) {
    const suffix = index + 1;
    const prefix = 'SOLANA_FEE_BENEFICIARY_' + suffix;
    const wallet = address(requiredEnv(prefix + '_WALLET'));
    const amount = parseDecimalTokenAmount(
      prefix + '_BASE_AMOUNT',
      baseDecimals,
    );
    const shareBps = parseShareBps(prefix + '_SHARE_BPS');

    if (amount === 0n) {
      throw new Error(prefix + '_BASE_AMOUNT must be greater than zero');
    }

    recipients.push({ wallet, amount });
    feeBeneficiaries.push({ wallet, shareBps });
  }

  const distributionTotal = recipients.reduce(
    (total, recipient) => total + recipient.amount,
    0n,
  );
  if (distributionTotal !== expectedDistributionAmount) {
    throw new Error(
      'SOLANA_FEE_BENEFICIARY_*_BASE_AMOUNT values must sum to ' +
        expectedDistributionAmount +
        ' base atoms; got ' +
        distributionTotal,
    );
  }

  const feeShareTotal = feeBeneficiaries.reduce(
    (total, recipient) => total + recipient.shareBps,
    0,
  );
  if (feeShareTotal !== 10_000) {
    throw new Error(
      'SOLANA_FEE_BENEFICIARY_*_SHARE_BPS values must sum to 10000; got ' +
        feeShareTotal,
    );
  }

  return { recipients, feeBeneficiaries };
}

export function ceilDiv(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator - 1n) / denominator;
}

export function getSwapFeeAmount(amountIn: bigint, swapFeeBps: number): bigint {
  return ceilDiv(amountIn * BigInt(swapFeeBps), 10_000n);
}

export function assertBigintEqual(
  label: string,
  actual: bigint,
  expected: bigint,
): void {
  if (actual !== expected) {
    throw new Error(label + ': expected ' + expected + ', got ' + actual);
  }
}

export async function loadCosigner(): Promise<TransactionSigner> {
  return loadKeypairSignerFromEnv({
    pathEnv: 'COSIGNER_KEYPAIR_PATH',
    jsonEnv: 'COSIGNER_KEYPAIR',
    label: 'COSIGNER_KEYPAIR',
  });
}

export async function fetchActiveCosigners({
  rpc,
  cosignerHookProgram,
  cosignerConfig,
}: {
  rpc: SolanaClients['rpc'];
  cosignerHookProgram: Address;
  cosignerConfig: Address;
}): Promise<Set<string>> {
  const configAccount = await cosignerHook.fetchMaybeCosignerConfig(
    rpc,
    cosignerConfig,
    { commitment: 'confirmed' },
  );
  if (!configAccount.exists) {
    throw new Error('Cosigner config does not exist: ' + cosignerConfig);
  }
  if (configAccount.programAddress !== cosignerHookProgram) {
    throw new Error(
      'Cosigner config ' +
        cosignerConfig +
        ' is owned by ' +
        configAccount.programAddress +
        ', expected ' +
        cosignerHookProgram,
    );
  }

  return new Set(
    configAccount.data.cosigners
      .slice(0, configAccount.data.cosignerCount)
      .map((authority) => authority.toString()),
  );
}

export async function assertCosignerRegistered({
  rpc,
  cosignerHookProgram,
  cosignerConfig,
  cosigner,
}: {
  rpc: SolanaClients['rpc'];
  cosignerHookProgram: Address;
  cosignerConfig: Address;
  cosigner: TransactionSigner;
}): Promise<void> {
  const activeCosigners = await fetchActiveCosigners({
    rpc,
    cosignerHookProgram,
    cosignerConfig,
  });
  if (!activeCosigners.has(cosigner.address.toString())) {
    throw new Error(
      'Cosigner ' +
        cosigner.address +
        ' is not active in config ' +
        cosignerConfig,
    );
  }
}

export function getCosignerHookRemainingAccounts({
  namespace,
  cosigner,
}: {
  namespace: Address;
  cosigner: TransactionSigner;
}) {
  const unsignedHookRemainingAccounts = [namespace, cosigner.address];

  return {
    signedHookRemainingAccounts: [namespace, cosigner],
    unsignedHookRemainingAccounts,
    hookRemainingAccountsHash: initializer.computeRemainingAccountsHash(
      unsignedHookRemainingAccounts,
    ),
  };
}

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
}): Promise<bigint> {
  const account = await rpc
    .getTokenAccountsByOwner(
      owner,
      { mint },
      { commitment: 'confirmed', encoding: 'jsonParsed' },
    )
    .send();
  const match = account.value.find(({ pubkey }) => pubkey === tokenAccount);
  if (!match) {
    return 0n;
  }

  const amount = match.account.data.parsed.info.tokenAmount.amount;
  return BigInt(amount);
}

export async function assertTokenBalance({
  rpc,
  owner,
  mint,
  tokenAccount,
  amount,
  label = 'token',
}: {
  rpc: SolanaClients['rpc'];
  owner: Address;
  mint: Address;
  tokenAccount: Address;
  amount: bigint;
  label?: string;
}): Promise<void> {
  const balance = await fetchOwnedTokenAmount({
    rpc,
    owner,
    mint,
    tokenAccount,
  });
  if (balance < amount) {
    throw new Error(
      'Payer ' +
        owner +
        ' needs at least ' +
        amount +
        ' ' +
        label +
        ' atoms; found ' +
        balance +
        '. Fund ' +
        tokenAccount +
        ' and retry.',
    );
  }
}

export async function sendInitializeLaunchWithLookupTable({
  rpc,
  rpcSubscriptions,
  payer,
  instruction,
  metadata,
  label = 'initialize_launch',
}: {
  rpc: SolanaClients['rpc'];
  rpcSubscriptions: SolanaClients['rpcSubscriptions'];
  payer: TransactionSigner;
  instruction: Instruction;
  metadata?: {
    metadataName?: string;
    metadataSymbol?: string;
    metadataUri?: string;
  };
  label?: string;
}): Promise<string> {
  const lookupTable = await createLookupTableForInstruction({
    rpc,
    rpcSubscriptions,
    payer,
    instruction,
    label: 'initialize_launch ALT',
  });
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
  const message = initializer.compressTransactionMessageWithLookupTable(
    pipe(
      createTransactionMessage({ version: 0 }),
      (tx) => setTransactionMessageFeePayerSigner(payer, tx),
      (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
      (tx) => appendTransactionMessageInstructions([instruction], tx),
    ),
    lookupTable,
  );

  assertTransactionFits(message, {
    label,
    metadataBytes: metadata ? getMetadataByteLength(metadata) : undefined,
  });

  const signedTransaction = await signTransactionMessageWithSigners(message);
  const sendAndConfirmTransaction = sendAndConfirmTransactionFactory({
    rpc,
    rpcSubscriptions,
  });
  await sendAndConfirmTransaction(
    signedTransaction as Parameters<typeof sendAndConfirmTransaction>[0],
    { commitment: 'confirmed' },
  );

  return getSignatureFromTransaction(signedTransaction);
}

export async function getMigrationQuoteProgress({
  rpc,
  quoteVault,
  pendingQuoteFees,
}: {
  rpc: SolanaClients['rpc'];
  quoteVault: Address;
  pendingQuoteFees: bigint;
}) {
  const vaultBalance = await rpc
    .getTokenAccountBalance(quoteVault, { commitment: 'confirmed' })
    .send();
  const quoteVaultAmount = BigInt(vaultBalance.value.amount);
  const migrationQuoteAmount = quoteVaultAmount - pendingQuoteFees;

  return {
    quoteVaultAmount,
    pendingQuoteFees,
    migrationQuoteAmount,
  };
}

export async function assertMigrationQuoteThreshold({
  rpc,
  quoteVault,
  pendingQuoteFees,
  minRaiseQuote,
}: {
  rpc: SolanaClients['rpc'];
  quoteVault: Address;
  pendingQuoteFees: bigint;
  minRaiseQuote: bigint;
}) {
  const progress = await getMigrationQuoteProgress({
    rpc,
    quoteVault,
    pendingQuoteFees,
  });

  if (progress.migrationQuoteAmount < minRaiseQuote) {
    throw new Error(
      'Quote available for migration ' +
        progress.migrationQuoteAmount +
        ' is below minRaiseQuote ' +
        minRaiseQuote,
    );
  }

  return progress;
}

export async function getSolPriceUsd(): Promise<number> {
  if (process.env.SOL_PRICE_USD) {
    return Number(process.env.SOL_PRICE_USD);
  }

  const response = await fetch(
    'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
  );
  const data = (await response.json()) as { solana?: { usd?: number } };
  if (typeof data.solana?.usd !== 'number') {
    throw new Error(
      'Unable to fetch SOL price. Set SOL_PRICE_USD to run without CoinGecko.',
    );
  }
  return data.solana.usd;
}
