/**
 * Runs the Solana examples against a disposable local fork of devnet or
 * mainnet. Usage:
 *   tsx scripts/solana-examples-fork.ts --network devnet|mainnet [--only <glob>] [--keep]
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
  appendFileSync,
  createWriteStream,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import {
  createKeyPairSignerFromPrivateKeyBytes,
  createSolanaRpc,
  getAddressEncoder,
} from '@solana/kit';

import {
  FORK_CASES,
  caseId,
  readJson,
  type CaseContext,
  type ForkCase,
} from './solana-fork/manifest.js';
import {
  NETWORK_CONFIGS,
  NETWORKS,
  type Network,
} from './solana-fork/networks.js';
import { snapshotNetwork } from './solana-fork/snapshot.js';

const ROOT = join(import.meta.dirname, '..');
const { values: options } = parseArgs({
  options: {
    network: { type: 'string' },
    only: { type: 'string' },
    keep: { type: 'boolean', default: false },
  },
});
const network = options.network as Network;
if (!NETWORKS.includes(network)) {
  throw new Error(`--network must be one of: ${NETWORKS.join(', ')}`);
}
const config = NETWORK_CONFIGS[network];
const runDir = mkdtempSync(join(tmpdir(), `doppler-${network}-fork-`));
const validatorLog = join(runDir, 'validator.log');
let validator: ChildProcess | undefined;
let finished = false;

function finish(failed: boolean): void {
  if (finished) return;
  finished = true;
  if (validator?.pid) {
    try {
      process.kill(-validator.pid, 'SIGKILL');
    } catch {
      // Already exited.
    }
  }
  if (failed) {
    try {
      const lines = readFileSync(validatorLog, 'utf8').trimEnd().split('\n');
      console.error(`Validator log tail:\n${lines.slice(-100).join('\n')}`);
    } catch {
      // The validator never started.
    }
  }
  if (options.keep) console.log(`Fork artifacts retained at ${runDir}`);
  else rmSync(runDir, { recursive: true, force: true });
}
for (const [signal, code] of [
  ['SIGINT', 130],
  ['SIGTERM', 143],
] as const) {
  process.on(signal, () => {
    finish(true);
    process.exit(code);
  });
}

function globToRegExp(glob: string): RegExp {
  const escaped = glob
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`^${escaped.join('.*')}$`);
}

async function writeKeypair(name: string) {
  const seed = randomBytes(32);
  const signer = await createKeyPairSignerFromPrivateKeyBytes(seed);
  const path = join(runDir, `${name}.json`);
  const publicKey = getAddressEncoder().encode(signer.address);
  writeFileSync(path, JSON.stringify([...seed, ...publicKey]));
  return { path, address: signer.address };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function startValidator(payer: string, accountDir: string) {
  const port = config.rpcPort;
  const rpcUrl = `http://127.0.0.1:${port}`;
  const rpc = createSolanaRpc(rpcUrl);
  if (
    await rpc
      .getSlot()
      .send()
      .then(
        () => true,
        () => false,
      )
  ) {
    throw new Error(`Refusing occupied local RPC port ${port}`);
  }
  validator = spawn(
    'solana-test-validator',
    [
      '--ledger',
      join(runDir, 'ledger'),
      '--reset',
      '--quiet',
      '--url',
      config.rpcUrl,
      '--clone-feature-set',
      '--mint',
      payer,
      '--account-dir',
      accountDir,
      '--rpc-port',
      String(port),
      '--faucet-port',
      String(port + 2),
      '--gossip-port',
      String(port + 3),
      '--dynamic-port-range',
      `${port + 4}-${port + 40}`,
      '--log-messages-bytes-limit',
      '100000000',
    ],
    { detached: true, stdio: ['ignore', openSync(validatorLog, 'w'), 'pipe'] },
  );
  validator.stderr?.pipe(createWriteStream(validatorLog, { flags: 'a' }));
  for (let attempt = 0; attempt < 180; attempt++) {
    if (validator.exitCode !== null) throw new Error('Validator exited early');
    const slot = await rpc
      .getSlot()
      .send()
      .catch(() => 0n);
    if (slot >= 5n) return rpcUrl;
    await sleep(1000);
  }
  throw new Error('Validator failed to produce slots');
}

function runCase(forkCase: ForkCase, env: NodeJS.ProcessEnv): Promise<boolean> {
  const id = caseId(forkCase);
  const log = createWriteStream(
    join(runDir, `${id.replaceAll(/[^\w.-]+/g, '_')}.log`),
  );
  const child = spawn(
    join(ROOT, 'node_modules/.bin/tsx'),
    [forkCase.script, ...(forkCase.action ? [forkCase.action] : [])],
    { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  for (const stream of [child.stdout, child.stderr]) {
    stream.on('data', (chunk: Buffer) => {
      process.stdout.write(chunk);
      log.write(chunk);
    });
  }
  return new Promise((resolve) =>
    child.on('close', (code) => {
      log.end();
      resolve(code === 0);
    }),
  );
}

async function main(): Promise<boolean> {
  const only = options.only ? globToRegExp(options.only) : undefined;
  const payer = await writeKeypair('payer');
  const cosigner = await writeKeypair('cosigner');
  const accountDir = join(runDir, 'accounts');
  mkdirSync(accountDir);
  const snapshot = await snapshotNetwork(config, {
    payer: payer.address,
    cosigner: cosigner.address,
    accountDir,
  });
  console.log(`Snapshotted ${network} at slot ${snapshot.slot}`);
  const rpcUrl = await startValidator(payer.address, accountDir);
  console.log(`Disposable ${network} fork running at ${rpcUrl}`);

  const programs = config.programs;
  const baseEnv: NodeJS.ProcessEnv = {
    ...process.env,
    SOLANA_NETWORK: 'custom',
    SOLANA_RPC_URL: rpcUrl,
    SOLANA_WS_URL: `ws://127.0.0.1:${config.rpcPort + 1}`,
    SOLANA_KEYPAIR_PATH: payer.path,
    SOLANA_KEYPAIR: '',
    COSIGNER_KEYPAIR_PATH: '',
    COSIGNER_KEYPAIR: '',
    SOLANA_CPMM_PROGRAM_ID: programs.cpmm,
    SOLANA_INITIALIZER_PROGRAM_ID: programs.initializer,
    SOLANA_CPMM_MIGRATOR_PROGRAM_ID: programs.cpmmMigrator,
    SOLANA_DOPPLER_LAUNCH_HOOK_V1_PROGRAM_ID: programs.launchHookV1,
    SOLANA_DOPPLER_LAUNCH_HOOK_V2_PROGRAM_ID: programs.launchHookV2,
    SOLANA_DOPPLER_REHYPE_ROUTER_V1_PROGRAM_ID: programs.rehypeRouter,
    SOLANA_VESTING_PROGRAM_ID: programs.vesting,
    SOLANA_USDC_MINT: config.usdcMint,
    SOL_PRICE_USD: '150',
  };
  const context: CaseContext = {
    runDir,
    payer: payer.address,
    cosigner: cosigner.address,
    cosignerPath: cosigner.path,
    state: (name) => readJson(join(runDir, name)),
  };

  const rows: string[][] = [];
  let failed = false;
  for (const forkCase of FORK_CASES) {
    const id = caseId(forkCase);
    const support = forkCase.support[network];
    if (only && !only.test(id)) continue;
    if (support !== 'run') {
      rows.push([id, support.status, support.reason]);
      continue;
    }
    if (failed) {
      rows.push([id, 'not run', 'An earlier case failed']);
      continue;
    }
    console.log(`\n=== ${id}`);
    const started = Date.now();
    const passed = await runCase(forkCase, {
      ...baseEnv,
      ...(forkCase.quote && {
        SOLANA_QUOTE: forkCase.quote,
        SOLANA_BASE_TOKEN_PROGRAM: forkCase.token,
      }),
      ...forkCase.env?.(context),
    });
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    rows.push([id, passed ? 'passed' : 'FAILED', `${seconds}s`]);
    failed ||= !passed;
  }

  const table = [
    `### Solana ${network} fork examples`,
    '',
    '| Case | Result | Detail |',
    '| --- | --- | --- |',
    ...rows.map((row) => `| ${row.join(' | ')} |`),
    '',
  ].join('\n');
  console.log(`\n${table}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, table);
  }
  return !failed;
}

main().then(
  (passed) => {
    finish(!passed);
    process.exitCode = passed ? 0 : 1;
  },
  (error: unknown) => {
    console.error(error);
    finish(true);
    process.exitCode = 1;
  },
);
