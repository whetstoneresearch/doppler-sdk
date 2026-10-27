import {
  AccountState,
  TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
  getTokenEncoder,
} from '@solana-program/token';
import {
  getMinimumBalanceForRentExemption,
  type Address,
  type ReadonlyUint8Array,
} from '@solana/kit';

export function createAccountFixture({
  pubkey,
  lamports,
  data,
  owner,
  executable = false,
}: {
  pubkey: Address;
  lamports: number;
  data: ReadonlyUint8Array;
  owner: Address;
  executable?: boolean;
}) {
  return {
    pubkey,
    account: {
      lamports,
      data: [Buffer.from(data).toString('base64'), 'base64'],
      owner,
      executable,
      rentEpoch: 0,
      space: data.length,
    },
  };
}

/** Synthetic USDC that exists only in the disposable local validator's genesis. */
export async function createPayerUsdcFixture(payer: Address, mint: Address) {
  const [pubkey] = await findAssociatedTokenPda({
    owner: payer,
    mint,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  const data = getTokenEncoder().encode({
    mint,
    owner: payer,
    amount: 1_000_000_000n,
    delegate: null,
    state: AccountState.Initialized,
    isNative: null,
    delegatedAmount: 0n,
    closeAuthority: null,
  });
  return createAccountFixture({
    pubkey,
    lamports: Number(getMinimumBalanceForRentExemption(BigInt(data.length))),
    data,
    owner: TOKEN_PROGRAM_ADDRESS,
  });
}
