/** What each Solana example can prove on each forked network, and why not. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Network, ProgramName } from './networks.js';

export type Skip = {
  status:
    | 'skip-until-mainnet'
    | 'skip-until-devnet'
    | 'delegated'
    | 'needs-example-change';
  reason: string;
  /** Programs whose deployment or upgrade may let this entry run. */
  until?: readonly ProgramName[];
};
export type Support = 'run' | Skip;

export type CaseContext = {
  runDir: string;
  payer: string;
  cosigner: string;
  cosignerPath: string;
  /** Reads a JSON state file written by an earlier case. */
  state: (name: string) => Record<string, string>;
};

export type ForkCase = {
  script: string;
  action?: string;
  quote?: 'sol' | 'usdc';
  token?: 'spl' | 'token2022';
  label?: string;
  support: Record<Network, Support>;
  env?: (context: CaseContext) => Record<string, string>;
};

const both = (support: Support): Record<Network, Support> => ({
  devnet: support,
  mainnet: support,
});
const combos = [
  ['sol', 'spl'],
  ['sol', 'token2022'],
  ['usdc', 'spl'],
  ['usdc', 'token2022'],
] as const;

export function caseId({ script, action, quote, token, label }: ForkCase) {
  const name = script.replace(/^.*\/(solana-)?/, '').replace(/\.ts$/, '');
  return [name, action, quote && `${quote}/${token}`, label]
    .filter(Boolean)
    .join(' ');
}

const advancedState = (quote: string, token: string) =>
  `advanced-${quote}-${token}.json`;

export const FORK_CASES: readonly ForkCase[] = [
  { script: 'examples/solana-minimal-launch.ts', support: both('run') },
  ...combos.flatMap(([quote, token]): ForkCase[] => [
    {
      script: 'examples/solana-advanced-launch.ts',
      action: 'create',
      quote,
      token,
      support: both('run'),
      env: ({ runDir }) => ({
        SOLANA_VESTING_CLIFF_SECONDS: '0',
        SOLANA_VESTING_DURATION_SECONDS: '0',
        SOLANA_VESTING_STATE_OUTPUT: join(runDir, advancedState(quote, token)),
      }),
    },
    {
      script: 'examples/solana-advanced-launch.ts',
      action: 'claim',
      quote,
      token,
      support: both('run'),
      env: ({ state }) => {
        const { launch, baseMint } = state(advancedState(quote, token));
        return {
          SOLANA_VESTING_LAUNCH: launch,
          SOLANA_VESTING_BASE_MINT: baseMint,
        };
      },
    },
  ]),
  {
    script: 'examples/solana-advanced-launch.ts',
    action: 'create',
    quote: 'sol',
    token: 'spl',
    label: 'cosigned',
    support: both('run'),
    env: ({ cosignerPath }) => ({ COSIGNER_KEYPAIR_PATH: cosignerPath }),
  },
  {
    script: 'test/solana/integration/launch-timing.ts',
    support: both('run'),
    env: ({ cosignerPath }) => ({ COSIGNER_KEYPAIR_PATH: cosignerPath }),
  },
  {
    script: 'examples/solana-spot-pool.ts',
    quote: 'sol',
    token: 'spl',
    support: {
      devnet: 'run',
      mainnet: {
        status: 'skip-until-mainnet',
        reason:
          'The mainnet CPMM migrator predates create_spot_pool (InstructionFallbackNotFound)',
        until: ['cpmmMigrator'],
      },
    },
    env: ({ state }) => ({
      SPOT_POOL_BASE_MINT: state(advancedState('sol', 'spl')).baseMint,
      SPOT_POOL_BASE_AMOUNT: '1000000',
      SPOT_POOL_QUOTE_AMOUNT_LAMPORTS: '10000000',
    }),
  },
  ...combos.map(
    ([quote, token]): ForkCase => ({
      script: 'test/solana/integration/legacy-migration.ts',
      quote,
      token,
      support: both('run'),
      env: ({ payer, cosigner, cosignerPath }) => ({
        COSIGNER_KEYPAIR_PATH: cosignerPath,
        SOLANA_COSIGNER_BUY_AMOUNT_SOL: '0.2',
        SOLANA_COSIGNER_BUY_AMOUNT_USDC: '0.2',
        SOLANA_FEE_BENEFICIARY_1_WALLET: payer,
        SOLANA_FEE_BENEFICIARY_1_BASE_AMOUNT: '140000000',
        SOLANA_FEE_BENEFICIARY_1_SHARE_BPS: '7000',
        SOLANA_FEE_BENEFICIARY_2_WALLET: cosigner,
        SOLANA_FEE_BENEFICIARY_2_BASE_AMOUNT: '60000000',
        SOLANA_FEE_BENEFICIARY_2_SHARE_BPS: '3000',
      }),
    }),
  ),
  {
    script: 'examples/solana-fee-routing.ts',
    action: 'create',
    support: both('run'),
    env: ({ runDir }) => ({
      SOLANA_FEE_REHYPOTHECATION_SETTLE_AND_CLAIM: 'false',
      SOLANA_FEE_REHYPOTHECATION_STATE_OUTPUT: join(runDir, 'fee-routing.json'),
    }),
  },
  {
    script: 'examples/solana-fee-routing.ts',
    action: 'settle',
    support: both('run'),
    env: ({ state }) => {
      const { launch, baseMint } = state('fee-routing.json');
      return { SOLANA_LAUNCH: launch, SOLANA_BASE_MINT: baseMint };
    },
  },
  ...['create', 'buy', 'resolve', 'claim'].map(
    (action): ForkCase => ({
      script: 'examples/solana-prediction-market.ts',
      action,
      support: {
        devnet: {
          status: 'delegated',
          reason:
            'Runs in the prediction devnet fork job with the prediction programs and policy',
        },
        mainnet: {
          status: 'skip-until-mainnet',
          reason: 'Prediction programs are not deployed on mainnet',
        },
      },
    }),
  ),
];

export function readJson(path: string): Record<string, string> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, string>;
}
