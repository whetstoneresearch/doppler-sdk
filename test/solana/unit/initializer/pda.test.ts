import { describe, expect, it } from 'vitest';
import {
  address,
  getAddressCodec,
  getProgramDerivedAddress,
} from '@solana/kit';
import {
  INITIALIZER_PROGRAM_ID,
  SEED_LAUNCH,
  SEED_LAUNCH_AUTHORITY,
} from '@/solana/initializer/constants.js';
import {
  getLaunchAddress,
  getLaunchV2Address,
  isLaunchAddress,
  getLaunchAuthorityAddress,
  launchIdFromU64,
} from '@/solana/initializer/pda.js';

const addressCodec = getAddressCodec();
const textEncoder = new TextEncoder();

describe('initializer PDA derivation', () => {
  it('derives launch and launch authority addresses', async () => {
    const admin = address('11111111111111111111111111111111');
    const launchId = 1n;
    const launchIdBytes32 = launchIdFromU64(launchId);
    const expectedLaunch = await getProgramDerivedAddress({
      programAddress: INITIALIZER_PROGRAM_ID,
      seeds: [
        textEncoder.encode(SEED_LAUNCH),
        addressCodec.encode(admin),
        launchIdBytes32,
      ],
    });

    const [launchAddress] = await getLaunchAddress(
      admin,
      launchIdBytes32,
      INITIALIZER_PROGRAM_ID,
    );
    expect(launchAddress).toBe(expectedLaunch[0]);

    const expectedLaunchAuthority = await getProgramDerivedAddress({
      programAddress: INITIALIZER_PROGRAM_ID,
      seeds: [
        textEncoder.encode(SEED_LAUNCH_AUTHORITY),
        addressCodec.encode(launchAddress),
      ],
    });

    const [launchAuthority] = await getLaunchAuthorityAddress(
      launchAddress,
      INITIALIZER_PROGRAM_ID,
    );
    expect(launchAuthority).toBe(expectedLaunchAuthority[0]);
  });
});

it('validates both mint-derived and legacy identities, including a legacy ID equal to mint bytes', async () => {
  const namespace = address('11111111111111111111111111111111');
  const baseMint = address('So11111111111111111111111111111111111111112');
  const launchId = new Uint8Array(addressCodec.encode(baseMint));
  const state = { namespace, baseMint, launchId };
  const [mintLaunch] = await getLaunchV2Address(baseMint);
  const [legacyLaunch] = await getLaunchAddress(namespace, launchId);
  expect(await isLaunchAddress(mintLaunch, state)).toBe(true);
  expect(await isLaunchAddress(legacyLaunch, state)).toBe(true);
  expect(
    await isLaunchAddress(mintLaunch, { ...state, namespace: baseMint }),
  ).toBe(true);
  expect(
    await isLaunchAddress(mintLaunch, { ...state, baseMint: namespace }),
  ).toBe(false);
  expect(await isLaunchAddress(namespace, state)).toBe(false);
});
