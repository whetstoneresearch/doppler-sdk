import { describe, expect, it } from 'vitest';
import {
  AccountRole,
  address,
  generateKeyPairSigner,
  createTransactionMessage,
  appendTransactionMessageInstructions,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  type Address,
  type Blockhash,
  type Instruction,
} from '@solana/kit';
import {
  createLaunch,
  initializer,
  feeRehypothecation,
  vesting,
  predictionMarkets,
} from '@/solana/index.js';
import { getInitializeLaunchInstructionDataDecoder } from '@/solana/generated/initializer/index.js';

async function fixture(
  programId: Address = initializer.INITIALIZER_PROGRAM_ID,
) {
  const [payer, baseMint, baseVault, quoteVault] = await Promise.all(
    Array.from({ length: 4 }, () => generateKeyPairSigner()),
  );
  const input = {
    programId,
    namespace: payer.address,
    launchId: initializer.launchIdFromU64(42n),
    launchAccounts: {
      baseMint,
      baseVault,
      quoteVault,
      quoteMint: address('So11111111111111111111111111111111111111112'),
    },
    payer,
    authority: payer,
    migration: false,
    supply: {
      baseDecimals: 6,
      baseTotalSupply: 1_000_000n,
      baseForDistribution: 0n,
      baseForLiquidity: 0n,
    },
    curve: {
      curveVirtualBase: 1_000_000n,
      curveVirtualQuote: 10_000n,
      swapFeeBps: 200,
    },
    metadata: null,
  };
  const legacy = await createLaunch({ ...input, vaultMode: 'legacy' });
  const decoded = getInitializeLaunchInstructionDataDecoder().decode(
    legacy.instruction.data!,
  );
  const args = { ...decoded, allowBuy: true, allowSell: true };
  const accounts = {
    ...legacy.addresses,
    baseVault: undefined,
    quoteVault: undefined,
    hookProgram: legacy.instruction.accounts![10].address,
    baseMint,
    quoteMint: input.launchAccounts.quoteMint,
    payer,
    authority: payer,
    rent: address('SysvarRent111111111111111111111111111111111'),
  };
  return { input, legacy, args, accounts };
}

describe('deterministic launch vaults', () => {
  it('defaults the existing public helpers to V2 without vault inputs', async () => {
    const { input, args, accounts } = await fixture();
    const prepared = await createLaunch({
      ...input,
      launchAccounts: {
        baseMint: input.launchAccounts.baseMint,
        quoteMint: input.launchAccounts.quoteMint,
      },
    });
    const instruction = await initializer.createInitializeLaunchInstruction(
      accounts,
      args,
    );
    const [[baseVault], [quoteVault]] = await Promise.all([
      initializer.getBaseVaultAddress(accounts.launch),
      initializer.getQuoteVaultAddress(accounts.launch),
    ]);
    expect(prepared.addresses).toMatchObject({ baseVault, quoteVault });
    for (const candidate of [prepared.instruction, instruction]) {
      expect([...candidate.data!.slice(0, 8)]).toEqual([
        176, 21, 196, 90, 68, 112, 226, 143,
      ]);
      expect(candidate.accounts?.slice(5, 7)).toEqual([
        { address: baseVault, role: AccountRole.WRITABLE },
        { address: quoteVault, role: AccountRole.WRITABLE },
      ]);
    }
  });

  it('uses the same PDA for creation and vesting funding in both vesting helpers', async () => {
    const { input } = await fixture();
    const launchInput = {
      ...input,
      launchAccounts: {
        baseMint: input.launchAccounts.baseMint,
        quoteMint: input.launchAccounts.quoteMint,
      },
      vesting: {
        schedules: [{ cliffSeconds: 0n, durationSeconds: 0n }],
        allocations: [
          { beneficiary: input.payer.address, scheduleId: 0, amount: 200_000n },
        ],
      },
    };
    const vested = await vesting.prepareLaunch(launchInput);
    const rehype = await feeRehypothecation.prepareLaunch({
      ...launchInput,
      buybackDestination: input.payer.address,
      beneficiaries: [{ wallet: input.payer.address, shareBps: 10_000 }],
      strategy: feeRehypothecation.allFeesToBeneficiariesInNumeraire(),
    });
    expect(rehype.vesting).toBeDefined();
    for (const prepared of [
      {
        addresses: vested.launchAddresses,
        create: vested.initializeLaunchInstruction,
        fund: vested.fundVestingInstruction,
      },
      {
        addresses: rehype.launchAddresses,
        create: rehype.initializeLaunchInstruction,
        fund: rehype.vesting!.fundInstruction,
      },
    ]) {
      const [baseVault] = await initializer.getBaseVaultAddress(
        prepared.addresses.launch,
      );
      expect(prepared.addresses.baseVault).toBe(baseVault);
      expect(prepared.create.accounts?.[5]).toEqual({
        address: baseVault,
        role: AccountRole.WRITABLE,
      });
      expect(prepared.fund.accounts).toContainEqual({
        address: baseVault,
        role: AccountRole.WRITABLE,
      });
      expect([...prepared.create.data!.slice(0, 8)]).toEqual([
        176, 21, 196, 90, 68, 112, 226, 143,
      ]);
    }
  });

  it('defaults prediction outcome launches to V2 while preserving registration accounts', async () => {
    const { input } = await fixture();
    const prepared = await predictionMarkets.prepareOutcomeLaunch({
      oracle: input.payer.address,
      creator: input.payer,
      outcomeId: new Uint8Array(32).fill(1),
      launch: {
        ...input,
        launchAccounts: {
          baseMint: input.launchAccounts.baseMint,
          quoteMint: input.launchAccounts.quoteMint,
        },
      },
    });
    expect([...prepared.instruction.data!.slice(0, 8)]).toEqual([
      176, 21, 196, 90, 68, 112, 226, 143,
    ]);
    expect(prepared.instruction.accounts?.[5]).toEqual({
      address: prepared.addresses.baseVault,
      role: AccountRole.WRITABLE,
    });
    expect(
      prepared.instruction.accounts?.some(
        ({ address }) => address === prepared.entry,
      ),
    ).toBe(true);
  });

  it('rejects old keypair vault inputs unless legacy mode is explicitly requested', async () => {
    const { input, accounts, args, legacy } = await fixture();
    await expect(createLaunch(input)).rejects.toThrow(
      'canonical launch vault PDAs',
    );
    await expect(
      initializer.createInitializeLaunchInstruction(
        {
          ...accounts,
          baseVault: input.launchAccounts.baseVault,
        },
        args,
      ),
    ).rejects.toThrow('canonical launch vault PDAs');
    await expect(
      initializer.createInitializeLaunchLegacyInstruction(accounts, args),
    ).rejects.toThrow('Legacy launches require');
    const explicitLegacy =
      await initializer.createInitializeLaunchLegacyInstruction(
        {
          ...accounts,
          baseVault: input.launchAccounts.baseVault,
          quoteVault: input.launchAccounts.quoteVault,
        },
        args,
      );
    expect(explicitLegacy.data).toEqual(legacy.instruction.data);
    expect(explicitLegacy.accounts).toEqual(legacy.instruction.accounts);
    expect(legacy.addresses.baseVault).toBe(
      input.launchAccounts.baseVault.address,
    );
    expect(legacy.addresses.quoteVault).toBe(
      input.launchAccounts.quoteVault.address,
    );
  });
  it('adds V2 without changing legacy arguments or signer requirements', async () => {
    const { input, legacy, args, accounts } = await fixture();
    const v2 = await initializer.createInitializeLaunchV2Instruction(
      accounts,
      args,
    );
    const [[baseVault], [quoteVault]] = await Promise.all([
      initializer.getBaseVaultAddress(accounts.launch),
      initializer.getQuoteVaultAddress(accounts.launch),
    ]);
    expect([...v2.data!.slice(0, 8)]).toEqual([
      176, 21, 196, 90, 68, 112, 226, 143,
    ]);
    expect([...legacy.instruction.data!.slice(0, 8)]).toEqual([
      90, 201, 220, 142, 112, 253, 100, 13,
    ]);
    expect(v2.data!.slice(8)).toEqual(legacy.instruction.data!.slice(8));
    expect(v2.accounts?.slice(5, 7)).toEqual([
      { address: baseVault, role: AccountRole.WRITABLE },
      { address: quoteVault, role: AccountRole.WRITABLE },
    ]);
    expect(legacy.instruction.accounts?.[5]).toMatchObject({
      address: input.launchAccounts.baseVault.address,
      role: AccountRole.WRITABLE_SIGNER,
    });
    expect(legacy.instruction.accounts?.[6]).toMatchObject({
      address: input.launchAccounts.quoteVault.address,
      role: AccountRole.WRITABLE_SIGNER,
    });
    expect(v2.accounts?.slice(7)).toEqual(
      legacy.instruction.accounts?.slice(7),
    );
  });

  it('rejects supplied vaults that belong to another launch', async () => {
    const { accounts, args } = await fixture();
    const [wrongVault] = await initializer.getBaseVaultAddress(
      accounts.payer.address,
    );
    await expect(
      initializer.createInitializeLaunchV2Instruction(
        { ...accounts, baseVault: wrongVault },
        args,
      ),
    ).rejects.toThrow('canonical launch vault PDAs');
    await expect(
      initializer.createInitializeLaunchV2Instruction(
        { ...accounts, quoteVault: wrongVault },
        args,
      ),
    ).rejects.toThrow('canonical launch vault PDAs');
  });

  it('derives under custom program IDs and always includes the vesting placeholder', async () => {
    const program = (await generateKeyPairSigner()).address;
    const { accounts, args } = await fixture(program);
    const instruction = await initializer.createInitializeLaunchV2Instruction(
      accounts,
      args,
      program,
    );
    const [baseVault] = await initializer.getBaseVaultAddress(
      accounts.launch,
      program,
    );
    const [defaultVault] = await initializer.getBaseVaultAddress(
      accounts.launch,
    );
    expect(baseVault).not.toBe(defaultVault);
    expect(instruction.accounts?.[5].address).toBe(baseVault);
    expect(instruction.accounts?.[18]).toEqual({
      address: program,
      role: AccountRole.READONLY,
    });
  });

  it('supports deterministic high-level and Rehype launch preparation', async () => {
    const { input, accounts } = await fixture();
    const [[baseVault], [quoteVault]] = await Promise.all([
      initializer.getBaseVaultAddress(accounts.launch),
      initializer.getQuoteVaultAddress(accounts.launch),
    ]);
    const launchAccounts = { ...input.launchAccounts, baseVault, quoteVault };
    const prepared = await createLaunch({
      ...input,
      launchAccounts,
      vaultMode: 'deterministic',
    });
    const rehype = await feeRehypothecation.prepareLaunch({
      ...input,
      launchAccounts,
      vaultMode: 'deterministic',
      buybackDestination: input.payer.address,
      beneficiaries: [{ wallet: input.payer.address, shareBps: 10_000 }],
      strategy: feeRehypothecation.allFeesToBeneficiariesInNumeraire(),
    });
    for (const instruction of [
      prepared.instruction,
      rehype.initializeLaunchInstruction,
    ]) {
      expect([...instruction.data!.slice(0, 8)]).toEqual([
        176, 21, 196, 90, 68, 112, 226, 143,
      ]);
      expect(instruction.accounts?.[5]).toEqual({
        address: baseVault,
        role: AccountRole.WRITABLE,
      });
      expect(instruction.accounts?.[6]).toEqual({
        address: quoteVault,
        role: AccountRole.WRITABLE,
      });
    }
  });

  it('removes two signatures from serialized launch transactions', async () => {
    const { input, legacy, accounts, args } = await fixture();
    const v2 = await initializer.createInitializeLaunchV2Instruction(
      accounts,
      args,
    );
    const message = (instruction: Instruction, version: 0 | 'legacy' = 0) =>
      appendTransactionMessageInstructions(
        [instruction],
        setTransactionMessageLifetimeUsingBlockhash(
          {
            blockhash: '11111111111111111111111111111111' as Blockhash,
            lastValidBlockHeight: 0n,
          },
          setTransactionMessageFeePayerSigner(
            input.payer,
            createTransactionMessage({ version }),
          ),
        ),
      );
    for (const version of [0, 'legacy'] as const) {
      expect(
        initializer.measureTransactionMessageSize(
          message(legacy.instruction, version),
        ).size -
          initializer.measureTransactionMessageSize(message(v2, version)).size,
      ).toBe(128);
    }
    const compressedSize = (instruction: Instruction) =>
      initializer.measureTransactionMessageSize(
        initializer.compressTransactionMessageWithLookupTable(
          appendTransactionMessageInstructions(
            [instruction],
            setTransactionMessageFeePayerSigner(
              input.payer,
              createTransactionMessage({ version: 0 }),
            ),
          ),
          {
            lookupTableAddress: input.launchAccounts.baseMint.address,
            addresses:
              initializer.getInstructionLookupTableAddresses(instruction),
          },
        ),
      ).size;
    expect(compressedSize(legacy.instruction) - compressedSize(v2)).toBe(190);
    const lookupAddresses = initializer.getInstructionLookupTableAddresses(v2);
    expect(lookupAddresses).toContain(v2.accounts?.[5].address);
    expect(lookupAddresses).toContain(v2.accounts?.[6].address);
  });
});
