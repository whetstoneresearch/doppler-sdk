import { readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { address, type Address } from '@solana/kit';

export type Scenario =
  | 'binary'
  | 'multi'
  | 'eight'
  | 'shared'
  | 'incremental'
  | 'void';
export type Action =
  | 'all'
  | 'setup'
  | 'buy'
  | 'resolve'
  | 'settle'
  | 'claim'
  | 'inspect';
export type PublicOutcome = {
  label: string;
  outcomeId: number[];
  launch: Address;
  baseMint: Address;
  entry: Address;
};
export type PublicMarket = {
  quoteMint: Address;
  creator: Address;
  market: Address;
  outcomes: PublicOutcome[];
};
export type Manifest = {
  version: 1;
  scenario: Scenario;
  network: string;
  genesisHash: string;
  programs: {
    initializerProgram: Address;
    predictionMigratorProgram: Address;
    predictionHookProgram: Address;
    trustedOracleProgram: Address;
  };
  authority: Address;
  nonce: string;
  oracle: Address;
  quoteMint: Address;
  markets: PublicMarket[];
  signatures: { action: string; signature: string; confirmedAt: string }[];
};

export function options(argv = process.argv.slice(2)) {
  const value = (flag: string, fallback: string) => {
    const index = argv.indexOf(flag);
    if (index < 0) return fallback;
    if (!argv[index + 1] || argv[index + 1].startsWith('--'))
      throw new Error(`${flag} requires a value`);
    return argv[index + 1];
  };
  const scenario = value('--scenario', 'binary') as Scenario;
  const action = value('--action', 'all') as Action;
  if (
    !['binary', 'multi', 'eight', 'shared', 'incremental', 'void'].includes(
      scenario,
    )
  )
    throw new Error('Unknown scenario');
  if (
    !['all', 'setup', 'buy', 'resolve', 'settle', 'claim', 'inspect'].includes(
      action,
    )
  )
    throw new Error('Unknown action');
  return {
    scenario,
    action,
    path: resolve(value('--manifest', `prediction-${scenario}.json`)),
  };
}

export async function readManifest(
  path: string,
): Promise<Manifest | undefined> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
  const m = JSON.parse(raw) as Manifest;
  if (
    m.version !== 1 ||
    !Array.isArray(m.markets) ||
    !Array.isArray(m.signatures)
  )
    throw new Error('Unsupported prediction manifest');
  address(m.oracle);
  address(m.authority);
  address(m.quoteMint);
  for (const p of Object.values(m.programs)) address(p);
  for (const market of m.markets) {
    market.quoteMint ??= m.quoteMint;
    address(market.quoteMint);
    address(market.market);
    address(market.creator);
    for (const o of market.outcomes) {
      address(o.launch);
      address(o.baseMint);
      address(o.entry);
      if (
        o.outcomeId.length !== 32 ||
        o.outcomeId.some((v) => !Number.isInteger(v) || v < 0 || v > 255)
      )
        throw new Error('Invalid outcome ID in manifest');
    }
  }
  return m;
}

/** Public addresses and confirmed receipts only. Never serialize TransactionSigner objects. */
export async function saveManifest(path: string, manifest: Manifest) {
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(manifest, null, 2) + '\n', {
    mode: 0o600,
  });
  await rename(temporary, path);
}
