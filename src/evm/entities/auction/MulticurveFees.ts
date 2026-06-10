import type { Address, WalletClient } from 'viem';
import type { SupportedPublicClient } from '../../types';
import type { MulticurveTokenPendingFees } from './multicurve/multicurvePendingFees';
import { getPendingFeesForMulticurveTokens } from './multicurve/multicurvePendingFeeReader';

export interface MulticurveFeesOptions {
  readonly tokenBatchSize?: number;
}

export class MulticurveFees {
  private readonly client: SupportedPublicClient;
  private readonly tokenAddresses: readonly Address[];
  private readonly options: MulticurveFeesOptions;

  constructor(
    client: SupportedPublicClient,
    _walletClient: WalletClient | undefined,
    tokenAddresses: readonly Address[],
    options: MulticurveFeesOptions = {},
  ) {
    this.client = client;
    this.tokenAddresses = [...tokenAddresses];
    this.options = { ...options };
  }

  getPendingFees(
    beneficiary: Address,
  ): Promise<readonly MulticurveTokenPendingFees[]>;
  getPendingFees(
    beneficiary: Address,
    options: MulticurveFeesOptions,
  ): Promise<readonly MulticurveTokenPendingFees[]>;
  getPendingFees(
    beneficiary: Address,
    tokenAddresses: readonly Address[],
  ): Promise<readonly MulticurveTokenPendingFees[]>;
  getPendingFees(
    beneficiary: Address,
    tokenAddresses: readonly Address[],
    options: MulticurveFeesOptions,
  ): Promise<readonly MulticurveTokenPendingFees[]>;
  async getPendingFees(
    beneficiary: Address,
    tokenAddressesOrOptions?: readonly Address[] | MulticurveFeesOptions,
    options?: MulticurveFeesOptions,
  ): Promise<readonly MulticurveTokenPendingFees[]> {
    const hasTokenAddressOverride = isTokenAddressList(tokenAddressesOrOptions);
    const tokenAddresses = hasTokenAddressOverride
      ? tokenAddressesOrOptions
      : this.tokenAddresses;
    const callOptions = hasTokenAddressOverride
      ? options
      : tokenAddressesOrOptions;
    const tokenBatchSize = getTokenBatchSize(
      callOptions?.tokenBatchSize ?? this.options.tokenBatchSize,
    );

    if (!tokenBatchSize || tokenAddresses.length <= tokenBatchSize) {
      return getPendingFeesForMulticurveTokens({
        client: this.client,
        beneficiary,
        tokenAddresses,
      });
    }

    let pendingFees: readonly MulticurveTokenPendingFees[] = [];
    for (
      let index = 0;
      index < tokenAddresses.length;
      index += tokenBatchSize
    ) {
      const batchPendingFees = await getPendingFeesForMulticurveTokens({
        client: this.client,
        beneficiary,
        tokenAddresses: tokenAddresses.slice(index, index + tokenBatchSize),
      });
      pendingFees = [...pendingFees, ...batchPendingFees];
    }

    return pendingFees;
  }
}

function isTokenAddressList(
  value: readonly Address[] | MulticurveFeesOptions | undefined,
): value is readonly Address[] {
  return Array.isArray(value);
}

function getTokenBatchSize(tokenBatchSize: number | undefined) {
  if (tokenBatchSize === undefined) {
    return undefined;
  }

  if (!Number.isInteger(tokenBatchSize) || tokenBatchSize < 1) {
    throw new Error('tokenBatchSize must be a positive integer');
  }

  return tokenBatchSize;
}

export type {
  MulticurveTokenPendingFees,
  MulticurveFeesOptions as MulticurvePendingFeesOptions,
};
