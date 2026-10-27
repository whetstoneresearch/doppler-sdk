/** Market-cap pricing, metadata, vesting, dynamic fees, and optional cosigning. */
import './env.js';

import { writeFileSync } from 'node:fs';
import { SYSTEM_PROGRAM_ADDRESS } from '@solana-program/system';
import {
  TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
} from '@solana-program/token';
import { address, generateKeyPairSigner } from '@solana/kit';

import {
  cpmm,
  curveSwapExactIn,
  dopplerLaunchHookV1,
  initializer,
  vesting,
} from '../src/solana/index.js';
import {
  DEFAULT_TEST_METADATA,
  WSOL_MINT,
  assertSimulationRejected,
  assertSolanaExampleNetwork,
  assertTokenBalance,
  createSolanaClientsFromEnv,
  getSolPriceUsd,
  getSolanaCpmmDeploymentFromEnv,
  getSolanaUsdcMintFromEnv,
  loadCosigner,
  loadKeypairSignerFromEnv,
  requiredEnv,
  sendInitializeLaunchWithLookupTable,
  sendInstructions,
  simulateInstructions,
} from './solanaExampleHelpers.js';

const BASE_DECIMALS = 6;
const BASE_TOTAL_SUPPLY = 1_000_000_000n * 10n ** BigInt(BASE_DECIMALS);
const VESTED_SUPPLY = BASE_TOTAL_SUPPLY / 5n;

function nonnegativeBigIntEnv(name: string, defaultValue: bigint): bigint {
  const value = BigInt(process.env[name]?.trim() || defaultValue);
  if (value < 0n) throw new Error(`${name} must not be negative`);
  return value;
}

async function main(): Promise<void> {
  const action = process.argv[2] ?? 'create';
  if (action !== 'create' && action !== 'claim') {
    throw new Error('Usage: solana-advanced-launch.ts [create|claim]');
  }
  const payer = await loadKeypairSignerFromEnv();
  const clients = createSolanaClientsFromEnv();
  assertSolanaExampleNetwork(clients.network, ['devnet', 'custom']);
  const deployment = await getSolanaCpmmDeploymentFromEnv(clients.network);
  const tokenKind = process.env.SOLANA_BASE_TOKEN_PROGRAM ?? 'spl';
  if (tokenKind !== 'spl' && tokenKind !== 'token2022') {
    throw new Error('SOLANA_BASE_TOKEN_PROGRAM must be spl or token2022');
  }
  const tokenPrograms =
    tokenKind === 'token2022'
      ? initializer.launchTokenPrograms.token2022Base()
      : initializer.launchTokenPrograms.splToken();
  const vestingProgramText = process.env.SOLANA_VESTING_PROGRAM_ID?.trim();
  const vestingProgram = vestingProgramText
    ? address(vestingProgramText)
    : undefined;

  // Claim later with the same token program and the launch/mint printed at creation.
  if (action === 'claim') {
    const claim = await vesting.prepareClaim({
      payer,
      beneficiary: process.env.SOLANA_VESTING_BENEFICIARY
        ? address(process.env.SOLANA_VESTING_BENEFICIARY)
        : payer.address,
      launch: address(requiredEnv('SOLANA_VESTING_LAUNCH')),
      baseMint: address(requiredEnv('SOLANA_VESTING_BASE_MINT')),
      baseTokenProgram: tokenPrograms.baseTokenProgram,
      vestingProgram,
    });
    console.log(
      'Vesting claim:',
      await sendInstructions({
        ...clients,
        payer,
        instructions: [claim.instruction],
      }),
    );
    return;
  }

  const quote = process.env.SOLANA_QUOTE ?? 'sol';
  if (quote !== 'sol' && quote !== 'usdc') {
    throw new Error('SOLANA_QUOTE must be sol or usdc');
  }
  const quoteMint =
    quote === 'sol' ? WSOL_MINT : getSolanaUsdcMintFromEnv(clients.network);
  const quoteDecimals = quote === 'sol' ? 9 : 6;
  const buyAmount = quote === 'sol' ? 10_000_000n : 1_000_000n;
  if (quote === 'usdc') {
    const [tokenAccount] = await findAssociatedTokenPda({
      owner: payer.address,
      mint: quoteMint,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });
    await assertTokenBalance({
      rpc: clients.rpc,
      owner: payer.address,
      mint: quoteMint,
      tokenAccount,
      amount: buyAmount,
      label: 'USDC',
    });
  }

  // Supplying a cosigner key opts in; it must match the hook's managed signer.
  const cosigner =
    process.env.COSIGNER_KEYPAIR_PATH || process.env.COSIGNER_KEYPAIR
      ? await loadCosigner()
      : undefined;
  const gate = cosigner
    ? await dopplerLaunchHookV1.resolveManagedCosignerGate(clients.rpc, {
        programId: deployment.dopplerLaunchHookV1Program,
      })
    : undefined;
  if (gate && cosigner?.address !== gate.cosigner) {
    throw new Error(
      'The supplied cosigner does not match the hook configuration',
    );
  }
  const namespace = gate?.config ?? SYSTEM_PROGRAM_ADDRESS;
  const { signedHookRemainingAccounts, unsignedHookRemainingAccounts } =
    dopplerLaunchHookV1.getDopplerLaunchHookV1RemainingAccounts({
      namespace,
      config: gate?.config,
      cosigner,
    });

  const { start } = cpmm.marketCapToCurveParams({
    startMarketCapUSD: 100_000,
    endMarketCapUSD: 10_000_000,
    baseTotalSupply: BASE_TOTAL_SUPPLY,
    baseForCurve: BASE_TOTAL_SUPPLY - VESTED_SUPPLY,
    baseDecimals: BASE_DECIMALS,
    quoteDecimals,
    numerairePriceUSD: quote === 'sol' ? await getSolPriceUsd() : 1,
  });
  const baseMint = await generateKeyPairSigner();
  const prepared = await vesting.prepareLaunch({
    deployment,
    namespace,
    payer,
    authority: payer,
    launchAccounts: { baseMint, quoteMint },
    supply: {
      baseDecimals: BASE_DECIMALS,
      baseTotalSupply: BASE_TOTAL_SUPPLY,
      baseForLiquidity: 0n,
    },
    curve: {
      curveVirtualBase: start.curveVirtualBase,
      curveVirtualQuote: start.curveVirtualQuote,
      swapFeeBps: 200,
    },
    dynamicFee: {
      startingTime: 0n,
      startFeeBps: 1_000,
      endFeeBps: 200,
      durationSeconds: nonnegativeBigIntEnv(
        'SOLANA_DYNAMIC_FEE_DURATION_SECONDS',
        600n,
      ),
    },
    cosignerGate: gate,
    tokenPrograms,
    migration: false,
    metadata: DEFAULT_TEST_METADATA,
    feeBeneficiaries: [{ wallet: payer.address, shareBps: 10_000 }],
    vesting: {
      schedules: [
        {
          cliffSeconds: nonnegativeBigIntEnv(
            'SOLANA_VESTING_CLIFF_SECONDS',
            7n * 86_400n,
          ),
          durationSeconds: nonnegativeBigIntEnv(
            'SOLANA_VESTING_DURATION_SECONDS',
            30n * 86_400n,
          ),
        },
      ],
      allocations: [
        { beneficiary: payer.address, scheduleId: 0, amount: VESTED_SUPPLY },
      ],
    },
    vestingProgram,
  });

  // Reserve the immutable vesting plan before creating the launch, then fund it.
  console.log(
    'Vesting config:',
    await sendInstructions({
      ...clients,
      payer,
      instructions: [prepared.initializeVestingInstruction],
    }),
  );
  console.log(
    'Launch:',
    await sendInitializeLaunchWithLookupTable({
      ...clients,
      payer,
      instruction: prepared.initializeLaunchInstruction,
      metadata: DEFAULT_TEST_METADATA,
    }),
  );
  console.log(
    'Fund vesting:',
    await sendInstructions({
      ...clients,
      payer,
      instructions: [prepared.fundVestingInstruction],
    }),
  );
  console.log('Launch address:', prepared.launchAddresses.launch);
  console.log('Base mint:', baseMint.address);
  const outputPath = process.env.SOLANA_VESTING_STATE_OUTPUT?.trim();
  if (outputPath) {
    writeFileSync(
      outputPath,
      `${JSON.stringify({ launch: prepared.launchAddresses.launch, baseMint: baseMint.address }, null, 2)}\n`,
    );
  }

  const launch = await initializer.fetchLaunch(
    clients.rpc,
    prepared.launchAddresses.launch,
    { commitment: 'confirmed', programId: deployment.initializerProgram },
  );
  if (
    !launch ||
    launch.migratorProgram !== SYSTEM_PROGRAM_ADDRESS ||
    !dopplerLaunchHookV1.isDynamicFeeSchedulePayload(
      launch.hookPayload.bytes.slice(0, launch.hookPayload.len),
    )
  ) {
    throw new Error(
      'Expected a permanent launch with a stored dynamic fee schedule',
    );
  }
  const buyInput = {
    deployment,
    ...prepared.launchAddresses,
    baseMint: baseMint.address,
    quoteMint,
    payer,
    amountIn: buyAmount,
    // Demonstration buy on a fresh curve; applications should use a quoted minimum.
    minAmountOut: 1n,
    tradeDirection: initializer.TRADE_DIRECTION_BUY,
    ...tokenPrograms,
  } satisfies Parameters<typeof curveSwapExactIn>[0];
  if (cosigner) {
    const unsignedBuy = await curveSwapExactIn({
      ...buyInput,
      remainingAccounts: unsignedHookRemainingAccounts,
    });
    const result = await simulateInstructions({
      rpc: clients.rpc,
      payer,
      instructions: unsignedBuy.instructions,
    });
    assertSimulationRejected('Unsigned bonding curve buy', result.err);
  }
  const buy = await curveSwapExactIn({
    ...buyInput,
    remainingAccounts: signedHookRemainingAccounts,
  });
  console.log(
    'Buy:',
    await sendInstructions({
      ...clients,
      payer,
      instructions: buy.instructions,
    }),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
