import { readFileSync } from 'node:fs';

import {
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  appendTransactionMessageInstructions,
  createTransactionMessage,
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
  type Instruction,
  type TransactionMessage,
  type TransactionMessageWithFeePayer,
  type TransactionSigner,
} from '@solana/kit';

import { initializer } from '../src/solana/index.js';

export const SOLANA_NETWORK_ENDPOINTS = {
  devnet: {
    rpcUrl: 'https://api.devnet.solana.com',
    wsUrl: 'wss://api.devnet.solana.com',
  },
  'mainnet-beta': {
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    wsUrl: 'wss://api.mainnet-beta.solana.com',
  },
} as const;
export type SolanaExampleNetwork =
  | keyof typeof SOLANA_NETWORK_ENDPOINTS
  | 'custom';
export const DEFAULT_SOLANA_EXAMPLE_NETWORK: SolanaExampleNetwork = 'devnet';
export const TOKEN_ACCOUNT_SPACE = 165n;
export const SOLANA_TRANSACTION_SIZE_LIMIT = 1232;

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
  if (value === 'devnet' || value === 'mainnet-beta' || value === 'custom') {
    return value;
  }

  throw new Error(
    `Unsupported SOLANA_NETWORK=${value}. Use devnet, mainnet-beta, or custom.`,
  );
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
