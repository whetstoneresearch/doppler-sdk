import { describe, expect, it, vi } from 'vitest';
import { AccountRole, address } from '@solana/kit';
import { generateKeyPairSigner } from '@solana/signers';
import {
  addressToBase58EncodedBytes,
  base64ToBytes,
  bytesToBase64,
  bytesToBase64EncodedBytes,
  createAccountMeta,
  createReadonlyRemainingAccountMeta,
  getAddressFromRemainingAccount,
  normalizeProgramAccountsResponse,
  warnAccountDecodeFailure,
  type EncodedProgramAccount,
} from '@/solana/core/accounts.js';

const TEST_ADDRESS = address('11111111111111111111111111111111');

describe('Solana account boundary helpers', () => {
  it('round-trips bytes through base64 helpers', () => {
    const bytes = new Uint8Array([0, 1, 2, 253, 254, 255]);

    const encoded = bytesToBase64(bytes);

    expect([...base64ToBytes(encoded)]).toEqual([...bytes]);
    expect(bytesToBase64EncodedBytes(bytes)).toBe(encoded);
  });

  it('brands addresses for base58 RPC memcmp filters', () => {
    expect(addressToBase58EncodedBytes(TEST_ADDRESS)).toBe(TEST_ADDRESS);
  });

  it('normalizes raw getProgramAccounts array responses', () => {
    const account = createEncodedProgramAccount();

    expect(normalizeProgramAccountsResponse([account])).toEqual([account]);
  });

  it('normalizes wrapped getProgramAccounts value responses', () => {
    const account = createEncodedProgramAccount();

    expect(normalizeProgramAccountsResponse({ value: [account] })).toEqual([
      account,
    ]);
  });

  it('rejects unexpected getProgramAccounts response shapes', () => {
    expect(() => normalizeProgramAccountsResponse({ value: {} })).toThrow(
      'Unexpected getProgramAccounts response shape',
    );
  });

  it('rejects unexpected getProgramAccounts account shapes', () => {
    expect(() =>
      normalizeProgramAccountsResponse([
        { pubkey: TEST_ADDRESS, account: { data: ['abc', 'base58'] } },
      ]),
    ).toThrow('Unexpected getProgramAccounts account shape');
  });

  it('creates readonly metas for remaining account addresses', () => {
    expect(createReadonlyRemainingAccountMeta(TEST_ADDRESS)).toEqual({
      address: TEST_ADDRESS,
      role: AccountRole.READONLY,
    });
    expect(getAddressFromRemainingAccount(TEST_ADDRESS)).toBe(TEST_ADDRESS);
  });

  it('creates readonly signer metas for remaining account signers', async () => {
    const signer = await generateKeyPairSigner();

    const meta = createReadonlyRemainingAccountMeta(signer);

    expect(meta.address).toBe(signer.address);
    expect(meta.role).toBe(AccountRole.READONLY_SIGNER);
    expect((meta as { signer?: unknown }).signer).toBe(signer);
    expect(getAddressFromRemainingAccount(signer)).toBe(signer.address);
  });

  it('preserves existing account metas', () => {
    const existingMeta = {
      address: TEST_ADDRESS,
      role: AccountRole.WRITABLE,
    };

    expect(createReadonlyRemainingAccountMeta(existingMeta)).toBe(existingMeta);
    expect(getAddressFromRemainingAccount(existingMeta)).toBe(TEST_ADDRESS);
  });

  it('creates signer account metas with caller-provided roles', async () => {
    const signer = await generateKeyPairSigner();

    const meta = createAccountMeta(signer, AccountRole.WRITABLE_SIGNER);

    expect(meta.address).toBe(signer.address);
    expect(meta.role).toBe(AccountRole.WRITABLE_SIGNER);
    expect((meta as { signer?: unknown }).signer).toBe(signer);
  });

  it('logs decode failures with account type and address', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    warnAccountDecodeFailure('pool', TEST_ADDRESS);

    expect(warnSpy).toHaveBeenCalledWith(
      `Failed to decode pool account: ${TEST_ADDRESS}`,
    );
    warnSpy.mockRestore();
  });
});

function createEncodedProgramAccount(): EncodedProgramAccount {
  return {
    pubkey: TEST_ADDRESS,
    account: {
      data: [bytesToBase64(new Uint8Array([1, 2, 3])), 'base64'],
    },
  };
}
