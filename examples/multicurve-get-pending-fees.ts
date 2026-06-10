import './env';

import { MulticurveFees } from '../src/evm';
import {
  createPublicClient,
  createWalletClient,
  formatUnits,
  getAddress,
  http,
  isAddress,
  isHex,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

function readPrivateKey(): Hex {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY is not set');
  }

  if (!isHex(privateKey)) {
    throw new Error('PRIVATE_KEY must be a 0x-prefixed hex string');
  }

  return privateKey;
}

function readAddressList(name: string): readonly Address[] {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }

  const addresses = value
    .split(',')
    .map((address) => address.trim())
    .filter((address) => address.length > 0);

  if (addresses.length === 0) {
    throw new Error(`${name} must include at least one address`);
  }

  return addresses.map((address) => readAddress(name, address));
}

function readAddress(name: string, value: string): Address {
  if (!isAddress(value)) {
    throw new Error(`${name} contains an invalid address: ${value}`);
  }

  return getAddress(value);
}

function readOptionalAddress(name: string): Address | undefined {
  const value = process.env[name];
  if (!value) {
    return undefined;
  }

  return readAddress(name, value);
}

function readOptionalPositiveInteger(name: string): number | undefined {
  const value = process.env[name];
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}

async function main(): Promise<void> {
  const account = privateKeyToAccount(readPrivateKey());
  const rpcUrl = process.env.RPC_URL ?? baseSepolia.rpcUrls.default.http[0];
  const tokenAddresses = readAddressList('ASSET_ADDRESSES');
  const beneficiary =
    readOptionalAddress('BENEFICIARY_ADDRESS') ?? account.address;
  const tokenBatchSize = readOptionalPositiveInteger(
    'PENDING_FEES_TOKEN_BATCH_SIZE',
  );

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
  });
  const walletClient = createWalletClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
    account,
  });
  const multicurveFees = new MulticurveFees(
    publicClient,
    walletClient,
    tokenAddresses,
    tokenBatchSize === undefined ? {} : { tokenBatchSize },
  );

  console.log('Beneficiary:', beneficiary);
  console.log('Tokens:', tokenAddresses.length);
  console.log(
    'Token batch size:',
    tokenBatchSize === undefined ? 'all tokens' : tokenBatchSize,
  );
  console.log();

  const pendingFeesByToken = await multicurveFees.getPendingFees(beneficiary);

  for (const pendingFees of pendingFeesByToken) {
    console.log('Asset:', pendingFees.tokenAddress);
    console.log('Pending token0 fees:', formatUnits(pendingFees.fees0, 18));
    console.log('Pending token1 fees:', formatUnits(pendingFees.fees1, 18));
    console.log();
  }
}

main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error('Error:', error.message);
  } else {
    console.error('Error:', String(error));
  }

  process.exit(1);
});
