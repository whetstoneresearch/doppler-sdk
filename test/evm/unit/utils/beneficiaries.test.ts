import { describe, it, expect } from 'vitest';
import { parseEther, type Address } from 'viem';
import { sortBeneficiaries } from '../../../../src/evm/utils/beneficiaries';

const addr = (hex: string): Address => hex as Address;

describe('sortBeneficiaries', () => {
  it('sorts beneficiaries by address ascending', () => {
    const result = sortBeneficiaries([
      { beneficiary: addr('0x0000000000000000000000000000000000000003'), shares: parseEther('0.3') },
      { beneficiary: addr('0x0000000000000000000000000000000000000001'), shares: parseEther('0.4') },
      { beneficiary: addr('0x0000000000000000000000000000000000000002'), shares: parseEther('0.3') },
    ]);

    expect(result.map((b) => b.beneficiary)).toEqual([
      '0x0000000000000000000000000000000000000001',
      '0x0000000000000000000000000000000000000002',
      '0x0000000000000000000000000000000000000003',
    ]);
  });

  it('does not mutate the input array', () => {
    const input = [
      { beneficiary: addr('0x0000000000000000000000000000000000000002'), shares: 1n },
      { beneficiary: addr('0x0000000000000000000000000000000000000001'), shares: 1n },
    ];
    const snapshot = input.map((b) => b.beneficiary);

    sortBeneficiaries(input);

    expect(input.map((b) => b.beneficiary)).toEqual(snapshot);
  });

  it('throws on duplicate addresses', () => {
    const duplicate = addr('0x0000000000000000000000000000000000000001');
    expect(() =>
      sortBeneficiaries([
        { beneficiary: duplicate, shares: parseEther('0.5') },
        { beneficiary: duplicate, shares: parseEther('0.5') },
      ]),
    ).toThrow(/Duplicate beneficiary address/);
  });

  it('treats addresses as case-insensitive when detecting duplicates', () => {
    expect(() =>
      sortBeneficiaries([
        { beneficiary: addr('0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa'), shares: 1n },
        { beneficiary: addr('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'), shares: 1n },
      ]),
    ).toThrow(/Duplicate beneficiary address/);
  });

  it('passes through empty and single-element lists', () => {
    expect(sortBeneficiaries([])).toEqual([]);

    const single = [
      { beneficiary: addr('0x0000000000000000000000000000000000000001'), shares: 1n },
    ];
    expect(sortBeneficiaries(single)).toEqual(single);
  });
});
