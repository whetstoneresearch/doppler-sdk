/** Read the fork source once, at one slot, and write genesis account files. */
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  createSolanaRpc,
  getAddressEncoder,
  getProgramDerivedAddress,
  type Address,
} from '@solana/kit';

import {
  deriveSolanaCpmmDeployment,
  deriveSolanaFeeRehypothecationDeployment,
  dopplerLaunchHookV1,
  initializer,
} from '../../src/solana/index.js';
import { createAccountFixture, createPayerUsdcFixture } from './fixtures.js';
import type { NetworkConfig, ProgramName } from './networks.js';

const LOADER = initializer.BPF_LOADER_UPGRADEABLE_PROGRAM_ID;
const PROGRAMDATA_HEADER = 45;

export type ProgramSnapshot = { present: boolean; sha256?: string };
export type Snapshot = {
  slot: bigint;
  programs: Record<ProgramName, ProgramSnapshot>;
  usdcAccount: Address;
};

/** Public RPCs rate-limit large reads; retry a few times before failing. */
async function withRetries<T>(read: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await read();
    } catch (error) {
      if (attempt === 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 5_000));
    }
  }
}

function sha256OfElf(programData: Buffer): string {
  let end = programData.length;
  while (end > PROGRAMDATA_HEADER && programData[end - 1] === 0) end--;
  return createHash('sha256')
    .update(programData.subarray(PROGRAMDATA_HEADER, end))
    .digest('hex');
}

/**
 * Copies programs, protocol configs and the USDC mint from one slot. A
 * throwaway cosigner replaces the first hook v1 cosigner and the payer gets
 * synthetic USDC; nothing else is modified.
 */
export async function snapshotNetwork(
  network: NetworkConfig,
  {
    payer,
    cosigner,
    accountDir,
  }: {
    payer: Address;
    cosigner: Address;
    accountDir: string;
  },
): Promise<Snapshot> {
  const p = network.programs;
  const [cpmm, fees, [hookConfig, hookBump]] = await Promise.all([
    deriveSolanaCpmmDeployment({
      cpmmProgram: p.cpmm,
      initializerProgram: p.initializer,
      cpmmMigratorProgram: p.cpmmMigrator,
      dopplerLaunchHookV1Program: p.launchHookV1,
    }),
    deriveSolanaFeeRehypothecationDeployment({
      initializerProgram: p.initializer,
      dopplerLaunchHookV2Program: p.launchHookV2,
      dopplerRehypeRouterV1Program: p.rehypeRouter,
    }),
    dopplerLaunchHookV1.getDopplerLaunchHookV1ConfigAddress(p.launchHookV1),
  ]);
  const names = Object.keys(p) as ProgramName[];
  const programDataAddresses = await Promise.all(
    names.map(
      async (name) =>
        (
          await getProgramDerivedAddress({
            programAddress: LOADER,
            seeds: [getAddressEncoder().encode(p[name])],
          })
        )[0],
    ),
  );
  const configs: [Address, Address][] = [
    [cpmm.cpmmConfig, p.cpmm],
    [cpmm.initializerConfig, p.initializer],
    [fees.dopplerLaunchHookV2Config, p.launchHookV2],
    [hookConfig, p.launchHookV1],
  ];
  const addresses = [
    ...names.map((name) => p[name]),
    ...programDataAddresses,
    ...configs.map(([config]) => config),
    network.usdcMint,
  ];
  const rpc = createSolanaRpc(network.rpcUrl);
  const { context, value } = await withRetries(() =>
    rpc
      .getMultipleAccounts(addresses, {
        encoding: 'base64',
        commitment: 'confirmed',
      })
      .send(),
  );
  const write = (
    pubkey: Address,
    account: NonNullable<(typeof value)[number]>,
    data = Buffer.from(account.data[0], 'base64'),
  ) =>
    writeFileSync(
      join(accountDir, `${pubkey}.json`),
      JSON.stringify(
        createAccountFixture({
          pubkey,
          lamports: Number(account.lamports),
          data,
          owner: account.owner,
          executable: account.executable,
        }),
      ),
    );

  const programs = {} as Record<ProgramName, ProgramSnapshot>;
  names.forEach((name, i) => {
    const program = value[i];
    const programData = value[names.length + i];
    if (
      !program ||
      !programData ||
      program.owner !== LOADER ||
      programData.owner !== LOADER
    ) {
      programs[name] = { present: false };
      return;
    }
    const raw = Buffer.from(programData.data[0], 'base64');
    programs[name] = { present: true, sha256: sha256OfElf(raw) };
    // A fresh ledger has no ancestry for the upstream deployment slot.
    raw.writeBigUInt64LE(0n, 4);
    write(p[name], program);
    write(programDataAddresses[i], programData, raw);
  });

  const configOffset = names.length * 2;
  configs.forEach(([config, owner], i) => {
    const account = value[configOffset + i];
    if (!account || account.owner !== owner) {
      throw new Error(`${config} is missing or not owned by ${owner}`);
    }
    if (config !== hookConfig) write(config, account);
  });

  const hookAccount = value[configOffset + configs.length - 1]!;
  const current = dopplerLaunchHookV1
    .getCosignerConfigDecoder()
    .decode(Buffer.from(hookAccount.data[0], 'base64'));
  if (current.bump !== hookBump || current.version !== 1) {
    throw new Error(`Unexpected hook v1 config ${hookConfig}`);
  }
  write(
    hookConfig,
    hookAccount,
    Buffer.from(
      dopplerLaunchHookV1.getCosignerConfigEncoder().encode({
        ...current,
        cosignerCount: 1,
        cosigners: [cosigner, ...current.cosigners.slice(1)],
      }),
    ),
  );

  const usdcMint = value[addresses.length - 1];
  if (!usdcMint) throw new Error(`USDC mint ${network.usdcMint} is missing`);
  write(network.usdcMint, usdcMint);
  const usdcAccount = await createPayerUsdcFixture(payer, network.usdcMint);
  writeFileSync(
    join(accountDir, `${usdcAccount.pubkey}.json`),
    JSON.stringify(usdcAccount),
  );

  return { slot: context.slot, programs, usdcAccount: usdcAccount.pubkey };
}
