import { describe, expect, it } from 'vitest';
import { getAddress } from 'viem';
import { WAD, ZERO_ADDRESS } from '../../../../src/evm/constants';
import { normalizeBeneficiaries } from '../../../../src/evm/utils/beneficiaries';

const beneficiary = getAddress('0x1111111111111111111111111111111111111111');

describe('normalizeBeneficiaries', () => {
  it('rejects an empty beneficiary list', () => {
    // Given / When / Then
    expect(() => normalizeBeneficiaries([], 'Rehype beneficiary')).toThrow(
      'Rehype beneficiary list must not be empty',
    );
  });

  it('rejects a malformed beneficiary address', () => {
    // Given / When / Then
    expect(() =>
      normalizeBeneficiaries(
        [{ beneficiary: '0x1234', shares: WAD }],
        'Rehype beneficiary',
      ),
    ).toThrow('Rehype beneficiary address is invalid');
  });

  it('rejects the zero beneficiary address', () => {
    // Given / When / Then
    expect(() =>
      normalizeBeneficiaries(
        [{ beneficiary: ZERO_ADDRESS, shares: WAD }],
        'Rehype beneficiary',
      ),
    ).toThrow('Rehype beneficiary address cannot be the zero address');
  });

  it('rejects nonpositive beneficiary shares', () => {
    // Given / When / Then
    expect(() =>
      normalizeBeneficiaries(
        [{ beneficiary, shares: 0n }],
        'Rehype beneficiary',
      ),
    ).toThrow('Rehype beneficiary shares must be positive');
  });

  it('returns a nonempty normalized list when shares total WAD', () => {
    // Given
    const input = [{ beneficiary, shares: WAD }] as const;

    // When
    const result = normalizeBeneficiaries(input, 'Rehype beneficiary');

    // Then
    expect(result).toEqual(input);
  });
});
