import type { Rpc, GetProgramAccountsApi } from '@solana/kit';

// Extract the filter element type from the kit's GetProgramAccountsApi.
// Using the last (most general) overload via Parameters<>.
type ProgramAccountsFilter = NonNullable<
  NonNullable<
    Parameters<Rpc<GetProgramAccountsApi>['getProgramAccounts']>[1]
  >['filters']
>[number];

/**
 * A minimal RPC interface for getProgramAccounts that is compatible with both
 * @solana/kit@5 and @solana/kit@6.
 *
 * The only breaking difference between the two versions is that kit@6 uses
 * `readonly` arrays for the `filters` parameter while kit@5 uses mutable arrays.
 * Declaring `filters` as a mutable array here satisfies both kit versions via
 * TypeScript's function parameter contravariance: a function that accepts
 * `readonly` inputs (kit@6) is a subtype of one that accepts mutable inputs.
 *
 * Remove this file once the frontend ecosystem (e.g. @solana/client,
 * @solana/react-hooks) publishes kit@6-compatible releases.
 */
export type GetProgramAccountsRpc = {
  getProgramAccounts(
    program: Parameters<Rpc<GetProgramAccountsApi>['getProgramAccounts']>[0],
    config?: Omit<
      NonNullable<
        Parameters<Rpc<GetProgramAccountsApi>['getProgramAccounts']>[1]
      >,
      'filters'
    > & { filters?: ProgramAccountsFilter[] },
  ): { send(): Promise<unknown> };
};
