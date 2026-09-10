/** Read-only deployment probe: no keys loaded and no transactions broadcast. */
import {
  address,
  appendTransactionMessageInstructions,
  compileTransaction,
  createNoopSigner,
  createSolanaRpc,
  createTransactionMessage,
  getAddressDecoder,
  getBase64EncodedWireTransaction,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  type Address,
} from '@solana/kit';
import { TOKEN_PROGRAM_ADDRESS } from '@solana-program/token';
import * as predictionMigrator from '../src/solana/migrators/predictionMigrator/index.js';
import * as trustedOracle from '../src/solana/trustedOracle/index.js';
import * as initializer from '../src/solana/initializer/index.js';

const rpc = createSolanaRpc(
  process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com',
);
const programs = {
  oracle: trustedOracle.TRUSTED_ORACLE_PROGRAM_ADDRESS,
  migrator: predictionMigrator.PREDICTION_MIGRATOR_PROGRAM_ADDRESS,
  hook: initializer.PREDICTION_HOOK_PROGRAM_ID,
  initializer: initializer.INITIALIZER_PROGRAM_ID,
};
const loader = 'BPFLoaderUpgradeab1e11111111111111111111111';
const addressDecoder = getAddressDecoder();

async function inspectProgram(program: Address) {
  const { value } = await rpc
    .getAccountInfo(program, { encoding: 'base64' })
    .send();
  if (!value?.executable || value.owner !== loader) {
    throw new Error(
      `Program ${program} is missing or is not upgradeable/executable`,
    );
  }
  const programData = addressDecoder.decode(
    Buffer.from(value.data[0], 'base64').subarray(4),
  );
  const data = await rpc
    .getAccountInfo(programData, {
      encoding: 'base64',
      dataSlice: { offset: 0, length: 45 },
    })
    .send();
  if (!data.value) throw new Error(`Missing ProgramData ${programData}`);
  const bytes = Buffer.from(data.value.data[0], 'base64');
  return {
    program,
    programData,
    deploySlot: bytes.readBigUInt64LE(4),
    upgradeAuthority:
      bytes[12] === 1 ? addressDecoder.decode(bytes.subarray(13, 45)) : null,
  };
}

async function main() {
  const deployment = Object.fromEntries(
    await Promise.all(
      Object.entries(programs).map(async ([name, program]) => [
        name,
        await inspectProgram(program),
      ]),
    ),
  );
  console.log(
    JSON.stringify(
      { deployment },
      (_, v) => (typeof v === 'bigint' ? v.toString() : v),
      2,
    ),
  );
  // A real funded public address is needed as the simulated fee payer. No signing
  // authority is requested or used: signature verification is explicitly disabled.
  const payerAddress = process.env.SOLANA_PROBE_PAYER
    ? address(process.env.SOLANA_PROBE_PAYER)
    : deployment.oracle.upgradeAuthority;
  if (!payerAddress)
    throw new Error(
      'Set SOLANA_PROBE_PAYER to a funded public address for simulation',
    );
  const payer = createNoopSigner(payerAddress);
  const nonce = BigInt(Date.now());
  const outcomeIds = [1, 2].map((n) => {
    const bytes = new Uint8Array(32);
    bytes[0] = n;
    return bytes;
  });
  const [oracle] = await trustedOracle.getOracleStateAddress(
    payerAddress,
    nonce,
  );
  const quoteMint = address('So11111111111111111111111111111111111111112');
  const [market] = await predictionMigrator.getPredictionMarketAddress(
    oracle,
    quoteMint,
    payerAddress,
  );
  const [potVault] =
    await predictionMigrator.getPredictionPotVaultAddress(market);
  const [marketAuthority] =
    await predictionMigrator.getPredictionMarketAuthorityAddress(market);
  const instructions = [
    trustedOracle.getInitializeOracleInstruction({
      oracleAuthority: payer,
      oracleState: oracle,
      nonce,
      outcomeIds,
    }),
    predictionMigrator.getCreateMarketInstruction({
      creator: payer,
      oracle,
      quoteMint,
      market,
      potVault,
      marketAuthority,
      quoteTokenProgram: TOKEN_PROGRAM_ADDRESS,
    }),
  ];
  const { value: blockhash } = await rpc.getLatestBlockhash().send();
  const transaction = compileTransaction(
    pipe(
      createTransactionMessage({ version: 0 }),
      (tx) => setTransactionMessageFeePayer(payerAddress, tx),
      (tx) => setTransactionMessageLifetimeUsingBlockhash(blockhash, tx),
      (tx) => appendTransactionMessageInstructions(instructions, tx),
    ),
  );
  const { value } = await rpc
    .simulateTransaction(getBase64EncodedWireTransaction(transaction), {
      encoding: 'base64',
      sigVerify: false,
      commitment: 'confirmed',
      accounts: { encoding: 'base64', addresses: [oracle, market] },
    })
    .send();
  console.log(
    JSON.stringify(
      { simulationError: value.err, logs: value.logs },
      (_, v) => (typeof v === 'bigint' ? v.toString() : v),
      2,
    ),
  );
  if (value.err)
    throw new Error(
      'Prediction ABI probe failed. Do not run the new examples against this deployment.',
    );
  const [oracleAccount, marketAccount] = value.accounts ?? [];
  if (!oracleAccount || !marketAccount)
    throw new Error('Simulation did not return created accounts');
  const oracleBytes = Buffer.from(oracleAccount.data[0], 'base64');
  const marketBytes = Buffer.from(marketAccount.data[0], 'base64');
  if (
    oracleBytes.length !== trustedOracle.getOracleStateSize() ||
    marketBytes.length !== predictionMigrator.getMarketSize()
  ) {
    throw new Error('Deployment account sizes differ from the SDK ABI');
  }
  const oracleState = trustedOracle.getOracleStateDecoder().decode(oracleBytes);
  const marketState = predictionMigrator.getMarketDecoder().decode(marketBytes);
  if (
    oracleState.outcomeCount !== 2 ||
    marketState.creator !== payerAddress ||
    marketState.oracle !== oracle
  ) {
    throw new Error('Deployment account data differs from the SDK ABI');
  }
  console.log(
    'Oracle/market creation ABI probe passed (simulation only). Hook policy, allowlists, trading, settlement and payouts still require the full lifecycle suite.',
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
