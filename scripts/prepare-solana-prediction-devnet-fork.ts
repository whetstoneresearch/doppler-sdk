/** Read-only devnet snapshot preparation and local post-run verification. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { address, getAddressDecoder, getAddressEncoder } from '@solana/kit';
import {
  findAssociatedTokenPda,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import {
  parseJsonWithBigInts,
  stringifyJsonWithBigInts,
} from '@solana/rpc-spec-types';
import { initializer } from '../src/solana/index.js';

const runDir = process.env.DOPPLER_PREDICTION_FORK_REPORT_DIR!;
assert(runDir, 'DOPPLER_PREDICTION_FORK_REPORT_DIR required');
const upstream =
  process.env.SOLANA_DEVNET_RPC_URL ?? 'https://api.devnet.solana.com';
const mode = process.env.DOPPLER_PREDICTION_FORK_MODE ?? 'deployed';
assert(
  ['deployed', 'candidate'].includes(mode),
  'Fork mode must be deployed or candidate',
);
const expectedGenesis = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
const config = 'A9DojSvj32PMTTGctEcWZu9GSKuQVEhPkBXxDxmYu34o';
const wsol = 'So11111111111111111111111111111111111111112';
const usdc = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
const featureProgram = 'Feature111111111111111111111111111111111111';
const programs = {
  initializer: '4h3Dqyo5qmteJoMxXt3tdtfXELDB6pdRTPU9mWruiKp1',
  trusted_oracle: 'HhUzN7VvonNUevATyugZUepzxpeEZMXQbV92X2xvsp5m',
  prediction_migrator: 'HYHdyy7QZg8Ucky9Z97xNtSCvrZxVNkeoney8xEPXjiZ',
  prediction_hook: '7QcQDANJVC17Jgc6KjjeagSkm2zAphgHVPK5agJzyihB',
};
const safeMethods = new Set([
  'getGenesisHash',
  'getVersion',
  'getSlot',
  'getMultipleAccounts',
  'getProgramAccounts',
  'getMinimumBalanceForRentExemption',
]);
// Preserve u64 fields such as rentEpoch=18446744073709551615 while retaining
// ordinary JS numbers for safe slot/size fields used by this harness.
function losslessJson(text: string): any {
  function normalize(value: any): any {
    if (typeof value === 'bigint')
      return value <= BigInt(Number.MAX_SAFE_INTEGER) &&
        value >= BigInt(Number.MIN_SAFE_INTEGER)
        ? Number(value)
        : value;
    if (Array.isArray(value)) return value.map(normalize);
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, normalize(item)]),
      );
    return value;
  }
  return normalize(parseJsonWithBigInts(text));
}
async function readRpc(
  endpoint: string,
  method: string,
  params: unknown[] = [],
): Promise<any> {
  assert(
    safeMethods.has(method),
    `Only read-only RPC methods allowed: ${method}`,
  );
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    if (response.status === 429 || response.status >= 500) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      continue;
    }
    assert(response.ok, `${method}: HTTP ${response.status}`);
    const result = losslessJson(await response.text()) as {
      result?: unknown;
      error?: unknown;
    };
    assert(!result.error, `${method}: ${JSON.stringify(result.error)}`);
    return result.result;
  }
  throw new Error(`${method}: upstream RPC retry limit reached`);
}
function save(name: string, value: unknown) {
  writeFileSync(join(runDir, name), stringifyJsonWithBigInts(value, 2) + '\n');
}
function bytes(account: any): Buffer {
  return Buffer.from(account.data[0], 'base64');
}
function hash(value: Uint8Array | string) {
  return createHash('sha256').update(value).digest('hex');
}
function accountSummary(pubkey: string, account: any) {
  return {
    pubkey,
    owner: account.owner,
    lamports: account.lamports,
    executable: account.executable,
    dataBytes: bytes(account).length,
    dataSha256: hash(bytes(account)),
  };
}
function dump(pubkey: string, account: any) {
  save(`genesis-accounts/${pubkey}.json`, { pubkey, account });
}
function activeFeatures(snapshot: any): string[] {
  return snapshot.value
    .filter(
      (row: any) =>
        bytes(row.account)[0] === 1 &&
        bytes(row.account).readBigUInt64LE(1) <= BigInt(snapshot.context.slot),
    )
    .map((row: any) => row.pubkey)
    .sort();
}
async function prepare() {
  mkdirSync(join(runDir, 'genesis-accounts'), { recursive: true });
  assert.equal(
    await readRpc(upstream, 'getGenesisHash'),
    expectedGenesis,
    'Upstream must be devnet',
  );
  const snapshotAddresses = [config, wsol, usdc, ...Object.values(programs)];
  const [accounts, features, version] = await Promise.all([
    readRpc(upstream, 'getMultipleAccounts', [
      snapshotAddresses,
      { encoding: 'base64', commitment: 'confirmed' },
    ]),
    readRpc(upstream, 'getProgramAccounts', [
      featureProgram,
      { encoding: 'base64', commitment: 'confirmed', withContext: true },
    ]),
    readRpc(upstream, 'getVersion'),
  ]);
  save('upstream-accounts.json', { addresses: snapshotAddresses, ...accounts });
  save('upstream-features.json', features);
  assert(accounts.value.every(Boolean), 'Required devnet accounts must exist');
  const configAccount = accounts.value[0];
  assert.equal(configAccount.owner, programs.initializer);
  const policy = initializer
    .getInitConfigDecoder()
    .decode(bytes(configAccount));
  assert(
    policy.migratorAllowlist
      .slice(0, policy.migratorAllowlistLen)
      .includes(address(programs.prediction_migrator)),
    'Prediction migrator absent from live allowlist',
  );
  assert(
    policy.hookAllowlist
      .slice(0, policy.hookAllowlistLen)
      .includes(address(programs.prediction_hook)),
    'Prediction hook absent from live allowlist',
  );
  assert(
    policy.minSwapFeeBps <= 100 && policy.maxSwapFeeBps >= 100,
    'Example 100bps fee is outside live policy',
  );
  for (let i = 0; i < 3; i++) dump(snapshotAddresses[i], accounts.value[i]);
  for (const i of [1, 2]) {
    assert.equal(
      accounts.value[i].owner,
      TOKEN_PROGRAM_ADDRESS,
      'Quote mint must be classic SPL Token',
    );
    assert.equal(
      bytes(accounts.value[i]).length,
      82,
      'Quote mint must have classic mint layout',
    );
    assert.equal(
      bytes(accounts.value[i])[45],
      1,
      'Quote mint must be initialized',
    );
  }
  const programDataAddresses = accounts.value.slice(3).map((account: any) => {
    assert.equal(
      account.owner,
      initializer.BPF_LOADER_UPGRADEABLE_PROGRAM_ID,
      'Expected live upgradeable program',
    );
    assert.equal(account.executable, true);
    assert.equal(bytes(account).readUInt32LE(0), 2);
    return getAddressDecoder().decode(bytes(account).subarray(4, 36));
  });
  const programData = await readRpc(upstream, 'getMultipleAccounts', [
    programDataAddresses,
    {
      encoding: 'base64',
      commitment: 'confirmed',
      minContextSlot: accounts.context.slot,
    },
  ]);
  save('upstream-programdata.json', {
    addresses: programDataAddresses,
    ...programData,
  });

  const deployedPrograms = Object.entries(programs).map(
    ([name, programId], i) => {
      const programAccount = accounts.value[i + 3];
      const dataAccount = programData.value[i];
      assert(dataAccount, `${name}: missing upstream ProgramData`);
      assert.equal(
        dataAccount.owner,
        initializer.BPF_LOADER_UPGRADEABLE_PROGRAM_ID,
      );
      assert.equal(dataAccount.executable, false);
      const raw = bytes(dataAccount);
      assert.equal(raw.readUInt32LE(0), 3);
      assert(
        raw[12] === 0 || raw[12] === 1,
        'Invalid upgrade authority option',
      );
      assert(
        raw.subarray(45, 49).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46])),
        'Missing deployed ELF',
      );
      const localRaw = Buffer.from(raw);
      localRaw.writeBigUInt64LE(0n, 4);
      const localDataAccount = {
        ...dataAccount,
        data: [localRaw.toString('base64'), 'base64'],
      };
      if (mode === 'deployed') {
        // A fresh ledger has no ancestry for the upstream deployment slot.
        // Normalize only that metadata; preserve the ELF, padding and authority.
        dump(programId, programAccount);
        dump(programDataAddresses[i], localDataAccount);
      }
      return {
        name,
        program: accountSummary(programId, programAccount),
        programData: accountSummary(programDataAddresses[i], dataAccount),
        localProgramData:
          mode === 'deployed'
            ? accountSummary(programDataAddresses[i], localDataAccount)
            : undefined,
        deploymentSlot: raw.readBigUInt64LE(4),
        upgradeAuthority:
          raw[12] === 1
            ? getAddressDecoder().decode(raw.subarray(13, 45))
            : null,
        elfAndPaddingSha256: hash(raw.subarray(45)),
      };
    },
  );

  // Explicit synthetic local balance fixture. The real cloned mint and its supply
  // are untouched; these tokens are not claimed to come from a live holder.
  const creator = address(process.env.SOLANA_FORK_CREATOR!);
  assert.notEqual(
    creator,
    policy.admin,
    'Local creator must differ from unchanged protocol admin',
  );
  const [localAta] = await findAssociatedTokenPda({
    owner: creator,
    mint: address(usdc),
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  const tokenData = Buffer.alloc(165);
  tokenData.set(getAddressEncoder().encode(address(usdc)), 0);
  tokenData.set(getAddressEncoder().encode(creator), 32);
  tokenData.writeBigUInt64LE(1_000_000_000n, 64);
  tokenData[108] = 1;
  const quoteFixture = {
    lamports: await readRpc(upstream, 'getMinimumBalanceForRentExemption', [
      165,
      { commitment: 'confirmed' },
    ]),
    owner: TOKEN_PROGRAM_ADDRESS,
    executable: false,
    rentEpoch: 0,
    data: [tokenData.toString('base64'), 'base64'],
  };
  save('local-quote-fixture.json', { pubkey: localAta, account: quoteFixture });
  dump(localAta, quoteFixture);
  const artifactDir = process.env.DOPPLER_PREDICTION_FORK_ARTIFACT_DIR!;
  const artifacts =
    mode === 'candidate'
      ? Object.fromEntries(
          Object.entries(programs).map(([name, programId]) => {
            const artifact = readFileSync(join(artifactDir, `${name}.so`));
            assert.equal(
              artifact.readUInt32LE(48),
              3,
              `${name} must be SBPFv3`,
            );
            return [
              name,
              {
                programId,
                bytes: artifact.length,
                sha256: hash(artifact),
                elfFlags: 3,
              },
            ];
          }),
        )
      : undefined;
  const registryText = readFileSync(
    join(runDir, 'upstream-runtime-feature-registry.json'),
    'utf8',
  );
  const registry = losslessJson(registryText);
  const recognizedIds = registry.features.map((feature: any) => feature.id);
  const unknownActive = activeFeatures(features).filter(
    (id) => !recognizedIds.includes(id),
  );
  save('fork-manifest.json', {
    mode,
    kind:
      mode === 'deployed'
        ? 'deployed devnet ELF fork with local loader deployment-slot normalization'
        : 'devnet account and feature fork with local candidate program overlay',
    sourceCommit:
      mode === 'candidate' ? '8bac0551f6e0f83a861f4822886d30a00095a22e' : null,
    sourceRevisionProof:
      mode === 'deployed'
        ? 'unproven: snapshotted deployed ELF and padding unchanged; only local loader deployment slot normalized, not a source revision claim'
        : 'pinned candidate source build',
    toolchain:
      mode === 'candidate'
        ? 'Agave 4.1.0 / platform-tools v1.54 / arch v3'
        : 'no program build: deployed ELF and padding unchanged',
    upstream: {
      origin: new URL(upstream).origin,
      genesisHash: expectedGenesis,
      version,
      accountSlot: accounts.context.slot,
      featureSlot: features.context.slot,
      programDataSlot: programData.context.slot,
      activeFeatureIds: activeFeatures(features),
      featuresSnapshotSha256: hash(stringifyJsonWithBigInts(features)),
    },
    runtimeFeatureRegistry: {
      knownIds: recognizedIds,
      reportSha256: hash(registryText),
      unrecognizedActiveUpstreamIds: unknownActive,
      source: `https://github.com/anza-xyz/agave/blob/v${version['solana-core']}/test-validator/src/lib.rs`,
      boundary:
        'clone-feature-set iterates the pinned runtime FEATURE_NAMES registry. Unknown or retired upstream feature accounts are not interpreted by this binary. The suite checks exact recognized activation parity, not full upstream runtime equivalence.',
    },
    unchangedAccounts: snapshotAddresses
      .slice(0, 3)
      .map((pubkey, i) => accountSummary(pubkey, accounts.value[i])),
    initializerPolicy: {
      admin: policy.admin,
      protocolFeeBps: policy.protocolFeeBps,
      minSwapFeeBps: policy.minSwapFeeBps,
      maxSwapFeeBps: policy.maxSwapFeeBps,
      migratorAllowlist: policy.migratorAllowlist.slice(
        0,
        policy.migratorAllowlistLen,
      ),
      hookAllowlist: policy.hookAllowlist.slice(0, policy.hookAllowlistLen),
    },
    upstreamPrograms: programDataAddresses.map((pubkey: string, i: number) =>
      accountSummary(pubkey, programData.value[i]),
    ),
    deployedPrograms,
    artifacts,
    localUpgradeAuthority:
      mode === 'candidate'
        ? process.env.SOLANA_FORK_UPGRADE_AUTHORITY
        : undefined,
    localSubstitutions: [
      ...(mode === 'deployed'
        ? [
            {
              kind: 'local loader deployment-slot normalization',
              byteRange: { start: 4, endExclusive: 12 },
              localSlot: 0,
              programs: deployedPrograms.map((program) => ({
                name: program.name,
                programData: program.programData.pubkey,
                upstreamSlot: program.deploymentSlot,
                upstreamDataSha256: program.programData.dataSha256,
                localDataSha256: program.localProgramData!.dataSha256,
              })),
              explanation:
                'A fresh local validator has no ancestor at the upstream deployment slots and cannot cache those raw loader accounts. Only the eight-byte deployment slot is set to zero. Full upstream originals are retained; Program accounts, ELF bytes and trailing padding, authority, owner, lamports and executable flags are unchanged.',
            },
          ]
        : []),
      ...(mode === 'candidate'
        ? [
            {
              kind: 'program overlays',
              programs,
              explanation:
                'Four candidate binaries replace live program code only in local genesis with the explicit ephemeral local genesis signer as upgrade authority; no devnet deployment. Live program state remains recorded, not treated as compatible.',
            },
          ]
        : []),
      {
        kind: 'ephemeral SOL funding',
        explanation:
          'New local genesis and faucet funds for ephemeral creators, oracle authority and participant; no production private keys.',
      },
      {
        kind: 'native mint balance restoration',
        initialLocalLamports: 1_000_000_000,
        restoredLamports: accounts.value[1].lamports,
        explanation:
          'Agave bootstrap resets the native mint balance to 1 SOL; the harness transfers only local genesis SOL to restore its exact upstream snapshot balance before assertions. Transaction signature is retained in native-mint-restoration.log.',
      },
      {
        kind: 'synthetic local quote balance',
        account: accountSummary(localAta, quoteFixture),
        localOwner: creator,
        syntheticBalance: tokenData.readBigUInt64LE(64),
        delegates: 'none',
        closeAuthority: 'none',
        explanation:
          'A new classic SPL Token ATA with 1,000,000,000 synthetic USDC atoms is injected only into local genesis. No real holder is cloned or debited; the upstream mint bytes, authority and supply remain unchanged. This explicit balance fixture is not a supply-conservation claim.',
      },
      {
        kind: 'fresh application state',
        explanation:
          mode === 'deployed'
            ? 'Oracles, markets, launches, token accounts and receipts are created locally by SDK transactions against unchanged snapshotted deployed binaries with only local loader deployment-slot normalization. Transactions execute on a disposable local fork, not devnet.'
            : 'Oracles, markets, launches, token accounts and receipts are created locally by SDK transactions; this is candidate-code compatibility proof against cloned devnet policy, not a live deployed ABI claim.',
      },
    ],
    quoteMint: usdc,
    localQuoteAccount: localAta,
    localCreator: creator,
    noRemoteBroadcasts: true,
  });
  console.log(
    `Snapshotted devnet configuration at slot ${accounts.context.slot}; protocol fee ${policy.protocolFeeBps}bps; quote account ${localAta}`,
  );
}
async function verify() {
  const endpoint = process.env.SOLANA_RPC_URL!;
  assert(
    ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(endpoint).hostname),
    'Verification endpoint must be local',
  );
  const manifest = losslessJson(
    readFileSync(join(runDir, 'fork-manifest.json'), 'utf8'),
  );
  const [accounts, features, genesis, localVersion] = await Promise.all([
    readRpc(endpoint, 'getMultipleAccounts', [
      [config, wsol, usdc],
      { encoding: 'base64', commitment: 'confirmed' },
    ]),
    readRpc(endpoint, 'getProgramAccounts', [
      featureProgram,
      { encoding: 'base64', commitment: 'confirmed', withContext: true },
    ]),
    readRpc(endpoint, 'getGenesisHash'),
    readRpc(endpoint, 'getVersion'),
  ]);
  assert.notEqual(genesis, expectedGenesis, 'Local fork must not be devnet');
  assert.equal(
    localVersion['solana-core'],
    manifest.upstream.version['solana-core'],
    'Local validator release differs from upstream',
  );
  assert.equal(
    localVersion['feature-set'],
    manifest.upstream.version['feature-set'],
    'Local compiled feature registry differs from upstream',
  );
  for (let i = 0; i < 3; i++)
    assert.deepEqual(
      accountSummary([config, wsol, usdc][i], accounts.value[i]),
      manifest.unchangedAccounts[i],
      'Cloned config/quote mint changed',
    );
  const localActive = activeFeatures(features);
  const missing = manifest.upstream.activeFeatureIds.filter(
    (id: string) => !localActive.includes(id),
  );
  const added = localActive.filter(
    (id: string) => !manifest.upstream.activeFeatureIds.includes(id),
  );
  const localPrograms = await readRpc(endpoint, 'getMultipleAccounts', [
    Object.values(programs),
    { encoding: 'base64', commitment: 'confirmed' },
  ]);
  const localProgramDataAddresses = localPrograms.value.map((account: any) => {
    assert.equal(account.owner, initializer.BPF_LOADER_UPGRADEABLE_PROGRAM_ID);
    assert.equal(account.executable, true);
    assert.equal(bytes(account).readUInt32LE(0), 2);
    return getAddressDecoder().decode(bytes(account).subarray(4, 36));
  });
  const localData = await readRpc(endpoint, 'getMultipleAccounts', [
    localProgramDataAddresses,
    { encoding: 'base64', commitment: 'confirmed' },
  ]);
  const loadedPrograms = Object.keys(programs).map((name, i) => {
    const account = localData.value[i];
    assert.equal(account.owner, initializer.BPF_LOADER_UPGRADEABLE_PROGRAM_ID);
    const data = bytes(account);
    assert.equal(data.readUInt32LE(0), 3);
    if (manifest.mode === 'deployed') {
      const expected = manifest.deployedPrograms[i];
      const actualProgram = accountSummary(
        Object.values(programs)[i],
        localPrograms.value[i],
      );
      const actualData = accountSummary(localProgramDataAddresses[i], account);
      assert.deepEqual(
        actualProgram,
        expected.program,
        `${name}: deployed Program account changed`,
      );
      assert.deepEqual(
        actualData,
        expected.localProgramData,
        `${name}: local ProgramData differs beyond approved slot normalization`,
      );
      assert.equal(
        data.readBigUInt64LE(4),
        0n,
        `${name}: local deployment slot must be zero`,
      );
      const authority =
        data[12] === 1
          ? getAddressDecoder().decode(data.subarray(13, 45))
          : null;
      assert.equal(
        authority,
        expected.upgradeAuthority,
        `${name}: upgrade authority changed`,
      );
      assert.equal(
        hash(data.subarray(45)),
        expected.elfAndPaddingSha256,
        `${name}: ELF or padding changed`,
      );
      return {
        name,
        program: actualProgram,
        programData: actualData,
        deploymentSlot: data.readBigUInt64LE(4),
        upgradeAuthority: authority,
        elfAndPaddingSha256: hash(data.subarray(45)),
        upstreamDeploymentSlot: expected.deploymentSlot,
        deployedElfAndAuthorityAssertion:
          'passed (only loader deployment slot normalized)',
      };
    }
    assert.equal(data[12], 1, 'Local overlay must have explicit authority');
    assert.equal(
      getAddressDecoder().decode(data.subarray(13, 45)),
      manifest.localUpgradeAuthority,
      'Unexpected local upgrade authority',
    );
    const artifact = manifest.artifacts[name];
    const deployedHash = hash(data.subarray(45, 45 + artifact.bytes));
    assert.equal(
      deployedHash,
      artifact.sha256,
      `${name}: local loaded ELF differs from candidate artifact`,
    );
    return {
      name,
      programData: localProgramDataAddresses[i],
      bytes: artifact.bytes,
      sha256: deployedHash,
    };
  });
  const expectedRecognized = manifest.upstream.activeFeatureIds
    .filter((id: string) =>
      manifest.runtimeFeatureRegistry.knownIds.includes(id),
    )
    .sort();
  const missingRecognized = expectedRecognized.filter(
    (id: string) => !localActive.includes(id),
  );
  save('local-verification.json', {
    localGenesis: genesis,
    localVersion,
    upstreamRuntimeIdentityAssertion:
      'passed (release and compiled feature-set hash)',
    mode: manifest.mode,
    programCodeAssertion:
      manifest.mode === 'deployed'
        ? 'deployed Program account, ELF, authority and full padding preserved; only eight-byte ProgramData deployment slot normalized to zero'
        : 'candidate ELF hashes matched',
    loadedPrograms,
    slot: accounts.context.slot,
    unchangedAccountAssertions:
      'passed (owner, lamports, executable, data length and SHA256)',
    localActiveFeatureIds: localActive,
    activeFeaturesAbsentLocally: missing,
    missingRecognizedFeatures: missingRecognized,
    expectedRecognizedActiveFeatures: expectedRecognized,
    unrecognizedUpstreamFeatureBoundary:
      manifest.runtimeFeatureRegistry.boundary,
    localOnlyActiveFeatures: added,
    featureSetAssertion:
      missingRecognized.length === 0 && added.length === 0
        ? 'passed for all pinned-runtime recognized features'
        : 'failed',
  });
  assert.deepEqual(
    localActive,
    expectedRecognized,
    'Pinned-runtime recognized feature activation mismatch',
  );
  assert.deepEqual(
    missing,
    manifest.runtimeFeatureRegistry.unrecognizedActiveUpstreamIds,
    'Unclassified upstream feature mismatch',
  );
  assert.deepEqual(
    added,
    [],
    'Local runtime enabled features inactive upstream',
  );
  console.log(
    `Runtime boundary: ${missing.length} active upstream feature IDs are unrecognized by matched Agave ${localVersion['solana-core']}; all are recorded in fork-manifest.json. The validator release and compiled feature-set hash match upstream; raw feature-account IDs absent from its registry are recorded separately.`,
  );
  console.log(
    `Matched ${localActive.length} runtime-recognized active features and all four ${manifest.mode} program assertions. Unchanged cloned config and quote-mint assertions passed at local slot ${accounts.context.slot}`,
  );
}
(process.argv.includes('--verify') ? verify() : prepare()).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
