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
  const legacy = await createLaunch(input);
  const decoded = getInitializeLaunchInstructionDataDecoder().decode(
    legacy.instruction.data!,
  );
  const args = { ...decoded, allowBuy: true, allowSell: true };
  const accounts = {
    ...legacy.addresses,
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
