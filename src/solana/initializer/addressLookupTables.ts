import {
  getCreateLookupTableInstruction,
  getExtendLookupTableInstruction,
  findAddressLookupTablePda,
} from '@solana-program/address-lookup-table';
import {
  AccountRole,
  compressTransactionMessageUsingAddressLookupTables,
  type Address,
  type Instruction,
  type TransactionMessage,
  type TransactionSigner,
} from '@solana/kit';

export const DEFAULT_LOOKUP_TABLE_ADDRESSES_PER_EXTEND = 20;

export function getInstructionLookupTableAddresses(
  instructions: Instruction | readonly Instruction[],
): Address[] {
  const seen = new Set<Address>();
  const addresses: Address[] = [];

  for (const instruction of Array.isArray(instructions)
    ? instructions
    : [instructions]) {
    for (const account of instruction.accounts ?? []) {
      if (
        'signer' in account ||
        account.role === AccountRole.READONLY_SIGNER ||
        account.role === AccountRole.WRITABLE_SIGNER
      ) {
        continue;
      }

      if (!seen.has(account.address)) {
        seen.add(account.address);
        addresses.push(account.address);
      }
    }
  }

  return addresses;
}

export interface BuildAddressLookupTableSetupInstructionsInput {
  authority: TransactionSigner;
  payer: TransactionSigner;
  recentSlot: number | bigint;
  addresses: readonly Address[];
  addressesPerExtendInstruction?: number;
}

export interface BuildAddressLookupTableSetupInstructionsResult {
  lookupTableAddress: Address;
  createInstruction: Instruction;
  extendInstructions: Instruction[];
  addresses: Address[];
}

export async function buildAddressLookupTableSetupInstructions({
  authority,
  payer,
  recentSlot,
  addresses,
  addressesPerExtendInstruction = DEFAULT_LOOKUP_TABLE_ADDRESSES_PER_EXTEND,
}: BuildAddressLookupTableSetupInstructionsInput): Promise<BuildAddressLookupTableSetupInstructionsResult> {
  if (addressesPerExtendInstruction <= 0) {
    throw new Error('addressesPerExtendInstruction must be greater than zero');
  }

  const dedupedAddresses = [...new Set(addresses)];
  const lookupTablePda = await findAddressLookupTablePda({
    authority: authority.address,
    recentSlot,
  });
  const [lookupTableAddress] = lookupTablePda;
  const createInstruction = getCreateLookupTableInstruction({
    address: lookupTablePda,
    authority: authority.address,
    payer,
    recentSlot,
  });

  const extendInstructions = [];
  for (
    let start = 0;
    start < dedupedAddresses.length;
    start += addressesPerExtendInstruction
  ) {
    extendInstructions.push(
      getExtendLookupTableInstruction({
        address: lookupTableAddress,
        authority,
        payer,
        addresses: dedupedAddresses.slice(
          start,
          start + addressesPerExtendInstruction,
        ),
      }),
    );
  }

  return {
    lookupTableAddress,
    createInstruction,
    extendInstructions,
    addresses: dedupedAddresses,
  };
}

export function compressTransactionMessageWithLookupTable<
  TTransactionMessage extends Exclude<
    TransactionMessage,
    { version: 'legacy' }
  >,
>(
  transactionMessage: TTransactionMessage,
  {
    lookupTableAddress,
    addresses,
  }: {
    lookupTableAddress: Address;
    addresses: readonly Address[];
  },
) {
  return compressTransactionMessageUsingAddressLookupTables(
    transactionMessage,
    {
      [lookupTableAddress]: [...addresses],
    },
  );
}
