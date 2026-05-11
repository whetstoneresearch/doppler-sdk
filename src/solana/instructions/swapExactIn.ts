import type {
  AccountMeta,
  AccountSignerMeta,
  Address,
  Instruction,
  TransactionSigner,
} from '@solana/kit';
import { AccountRole, createNoopSigner } from '@solana/kit';
import { CPMM_PROGRAM_ADDRESS } from '../generated/cpmm/programs/index.js';
import { getSwapExactInInstruction } from '../generated/cpmm/instructions/index.js';
import { TOKEN_PROGRAM_ADDRESS } from '../core/constants.js';
import type { TradeDirection } from '../core/types.js';

type RemainingAccount =
  | Address
  | AccountMeta
  | AccountSignerMeta
  | TransactionSigner;

function isTransactionSigner(
  value: RemainingAccount,
): value is TransactionSigner {
  return (
    typeof value === 'object' &&
    value !== null &&
    'address' in value &&
    'signTransactions' in value
  );
}

function toRemainingAccountMeta(
  account: RemainingAccount,
): AccountMeta | AccountSignerMeta {
  if (typeof account === 'string') {
    return { address: account, role: AccountRole.READONLY };
  }
  if (isTransactionSigner(account)) {
    return {
      address: account.address,
      role: AccountRole.READONLY_SIGNER,
      signer: account,
    };
  }
  return account;
}

/**
 * Helper to create swap instruction with simplified parameters
 */
export function createSwapInstruction(params: {
  config: Address;
  pool: Address;
  authority: Address;
  vault0: Address;
  vault1: Address;
  token0Mint: Address;
  token1Mint: Address;
  userToken0: Address;
  userToken1: Address;
  user: Address | TransactionSigner;
  amountIn: bigint;
  minAmountOut: bigint;
  tradeDirection: TradeDirection;
  oracle?: Address;
  remainingAccounts?: RemainingAccount[];
  updateOracle?: boolean;
  token0Program?: Address;
  token1Program?: Address;
  tokenProgram?: Address;
  programId?: Address;
}): Instruction {
  const {
    config,
    pool,
    authority,
    vault0,
    vault1,
    token0Mint,
    token1Mint,
    userToken0,
    userToken1,
    user,
    amountIn,
    minAmountOut,
    tradeDirection,
    oracle,
    remainingAccounts = [],
    updateOracle = false,
    token0Program,
    token1Program,
    tokenProgram,
    programId = CPMM_PROGRAM_ADDRESS,
  } = params;
  const trader = typeof user === 'string' ? createNoopSigner(user) : user;

  // Determine vaults and user accounts based on trade direction
  const [vaultIn, vaultOut] =
    tradeDirection === 0 ? [vault0, vault1] : [vault1, vault0];
  const [userIn, userOut] =
    tradeDirection === 0 ? [userToken0, userToken1] : [userToken1, userToken0];

  const instruction = getSwapExactInInstruction(
    {
      config,
      pool,
      authority,
      vaultIn,
      vaultOut,
      token0Mint,
      token1Mint,
      userIn,
      userOut,
      trader,
      token0Program: token0Program ?? tokenProgram ?? TOKEN_PROGRAM_ADDRESS,
      token1Program: token1Program ?? tokenProgram ?? TOKEN_PROGRAM_ADDRESS,
      oracle,
      amountIn,
      minAmountOut,
      tradeDirection,
      updateOracle,
    },
    { programAddress: programId },
  );

  return {
    ...instruction,
    accounts: [
      ...(instruction.accounts ?? []),
      ...remainingAccounts.map(toRemainingAccountMeta),
    ],
  };
}

export const MAX_FEE_AMOUNT = BigInt('18446744073709551615');
