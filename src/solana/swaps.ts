import {
  address,
  type AccountMeta,
  type AccountSignerMeta,
  type Address,
  type GetAccountInfoApi,
  type Instruction,
  type Rpc,
  type TransactionSigner,
} from '@solana/kit';
import {
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstruction,
  getSyncNativeInstruction,
} from '@solana-program/token';
import { getTransferSolInstruction } from '@solana-program/system';

import { type TradeDirection, type SwapQuote } from './core/index.js';
import { TOKEN_PROGRAM_ADDRESS } from './core/constants.js';
import { getSwapQuote } from './core/math.js';
import { getPoolByMints, type PoolWithAddress } from './client/index.js';
import { createSwapInstruction } from './instructions/index.js';
import type { SolanaCpmmDeployment } from './deployment.js';
import { CPMM_HOOK_PROGRAM_ID } from './cpmmHook/index.js';
import {
  INITIALIZER_PROGRAM_ID,
  TRADE_DIRECTION_BUY,
  type CurveSwapExactInAccounts,
  createCurveSwapExactInInstruction,
} from './initializer/index.js';

export type SolanaRemainingAccount =
  | Address
  | AccountMeta
  | AccountSignerMeta
  | TransactionSigner;

type AddressOrSigner = Address | TransactionSigner;

export type CurveSwapExactInInput = {
  deployment?: Pick<SolanaCpmmDeployment, 'initializerProgram'> &
    Partial<Pick<SolanaCpmmDeployment, 'cpmmHookProgram'>>;
  programId?: Address;
  launch: Address;
  launchAuthority: Address;
  baseVault: Address;
  quoteVault: Address;
  launchFeeState: Address;
  baseMint: Address;
  quoteMint: Address;
  payer: TransactionSigner;
  user?: AddressOrSigner;
  amountIn: bigint;
  minAmountOut: bigint;
  tradeDirection: 0 | 1;
  remainingAccounts?: ReadonlyArray<SolanaRemainingAccount>;
  baseTokenProgram?: Address;
  quoteTokenProgram?: Address;
  wrapSol?: boolean;
};

export type CurveSwapExactInResult = {
  userBaseAccount: Address;
  userQuoteAccount: Address;
  userIn: Address;
  userOut: Address;
  setupInstructions: Instruction[];
  swapInstruction: Instruction;
  instructions: Instruction[];
};

type SwapExactInBaseInput = {
  deployment?: Pick<SolanaCpmmDeployment, 'cpmmProgram' | 'cpmmConfig'>;
  programId?: Address;
  config?: Address;
  payer: TransactionSigner;
  user?: AddressOrSigner;
  amountIn: bigint;
  tradeDirection: TradeDirection;
  minAmountOut?: bigint;
  slippageBps?: number | bigint;
  token0Program?: Address;
  token1Program?: Address;
  tokenProgram?: Address;
  oracle?: Address;
  remainingAccounts?: ReadonlyArray<SolanaRemainingAccount>;
  updateOracle?: boolean;
};

export type SwapExactInInput =
  | (SwapExactInBaseInput & {
      pool: PoolWithAddress;
      rpc?: never;
      mintA?: never;
      mintB?: never;
    })
  | (SwapExactInBaseInput & {
      rpc: Rpc<GetAccountInfoApi>;
      mintA: Address;
      mintB: Address;
      pool?: never;
    });

export type SwapExactInResult = {
  pool: PoolWithAddress;
  quote: SwapQuote;
  minAmountOut: bigint;
  userToken0: Address;
  userToken1: Address;
  userIn: Address;
  userOut: Address;
  setupInstructions: Instruction[];
  swapInstruction: Instruction;
  instructions: Instruction[];
};

const WRAPPED_SOL_MINT = address('So11111111111111111111111111111111111111112');
const BPS_DENOMINATOR = 10_000n;

function isTransactionSigner(
  value: AddressOrSigner,
): value is TransactionSigner {
  return (
    typeof value === 'object' &&
    value !== null &&
    'address' in value &&
    'signTransactions' in value
  );
}

function getAddress(value: AddressOrSigner): Address {
  return isTransactionSigner(value) ? value.address : value;
}

async function getAssociatedTokenAddress({
  owner,
  mint,
  tokenProgram,
}: {
  owner: Address;
  mint: Address;
  tokenProgram: Address;
}): Promise<Address> {
  const [ata] = await findAssociatedTokenPda({
    owner,
    mint,
    tokenProgram,
  });
  return ata;
}

function resolveSlippageBps(slippageBps: number | bigint | undefined): bigint {
  const resolved = slippageBps === undefined ? 50n : BigInt(slippageBps);
  if (resolved < 0n || resolved > BPS_DENOMINATOR) {
    throw new Error('slippageBps must be between 0 and 10000');
  }
  return resolved;
}

function getMinAmountOut({
  quotedAmountOut,
  minAmountOut,
  slippageBps,
}: {
  quotedAmountOut: bigint;
  minAmountOut?: bigint;
  slippageBps?: number | bigint;
}): bigint {
  if (minAmountOut !== undefined) {
    return minAmountOut;
  }
  const slippage = resolveSlippageBps(slippageBps);
  return (quotedAmountOut * (BPS_DENOMINATOR - slippage)) / BPS_DENOMINATOR;
}

export async function curveSwapExactIn(
  input: CurveSwapExactInInput,
): Promise<CurveSwapExactInResult> {
  const programId =
    input.programId ??
    input.deployment?.initializerProgram ??
    INITIALIZER_PROGRAM_ID;
  const user = input.user ?? input.payer;
  const userAddress = getAddress(user);
  const baseTokenProgram = input.baseTokenProgram ?? TOKEN_PROGRAM_ADDRESS;
  const quoteTokenProgram = input.quoteTokenProgram ?? TOKEN_PROGRAM_ADDRESS;
  const userBaseAccount = await getAssociatedTokenAddress({
    owner: userAddress,
    mint: input.baseMint,
    tokenProgram: baseTokenProgram,
  });
  const userQuoteAccount = await getAssociatedTokenAddress({
    owner: userAddress,
    mint: input.quoteMint,
    tokenProgram: quoteTokenProgram,
  });

  const setupInstructions: Instruction[] = [
    getCreateAssociatedTokenIdempotentInstruction({
      payer: input.payer,
      ata: userBaseAccount,
      owner: userAddress,
      mint: input.baseMint,
      tokenProgram: baseTokenProgram,
    }),
    getCreateAssociatedTokenIdempotentInstruction({
      payer: input.payer,
      ata: userQuoteAccount,
      owner: userAddress,
      mint: input.quoteMint,
      tokenProgram: quoteTokenProgram,
    }),
  ];
  const shouldWrapSol =
    input.wrapSol ??
    (input.quoteMint === WRAPPED_SOL_MINT &&
      input.tradeDirection === TRADE_DIRECTION_BUY);

  if (shouldWrapSol) {
    setupInstructions.push(
      getTransferSolInstruction({
        source: input.payer,
        destination: userQuoteAccount,
        amount: input.amountIn,
      }),
      getSyncNativeInstruction({ account: userQuoteAccount }),
    );
  }

  const swapAccounts: CurveSwapExactInAccounts = {
    launch: input.launch,
    launchAuthority: input.launchAuthority,
    baseVault: input.baseVault,
    quoteVault: input.quoteVault,
    launchFeeState: input.launchFeeState,
    userBaseAccount,
    userQuoteAccount,
    baseMint: input.baseMint,
    quoteMint: input.quoteMint,
    user,
    hookProgram: input.deployment?.cpmmHookProgram ?? CPMM_HOOK_PROGRAM_ID,
    baseTokenProgram,
    quoteTokenProgram,
    remainingAccounts: input.remainingAccounts
      ? [...input.remainingAccounts]
      : undefined,
  };
  const swapInstruction = createCurveSwapExactInInstruction(
    swapAccounts,
    {
      amountIn: input.amountIn,
      minAmountOut: input.minAmountOut,
      tradeDirection: input.tradeDirection,
    },
    programId,
  );
  const userIn =
    input.tradeDirection === TRADE_DIRECTION_BUY
      ? userQuoteAccount
      : userBaseAccount;
  const userOut =
    input.tradeDirection === TRADE_DIRECTION_BUY
      ? userBaseAccount
      : userQuoteAccount;

  return {
    userBaseAccount,
    userQuoteAccount,
    userIn,
    userOut,
    setupInstructions,
    swapInstruction,
    instructions: [...setupInstructions, swapInstruction],
  };
}

export async function swapExactIn(
  input: SwapExactInInput,
): Promise<SwapExactInResult> {
  const programId =
    input.programId ?? input.deployment?.cpmmProgram ?? undefined;
  const pool =
    'pool' in input
      ? input.pool
      : await getPoolByMints(input.rpc, input.mintA, input.mintB, {
          programId,
        });
  if (!pool) {
    throw new Error(`No pool found for ${input.mintA} / ${input.mintB}`);
  }

  const user = input.user ?? input.payer;
  const userAddress = getAddress(user);
  const token0Program =
    input.token0Program ?? input.tokenProgram ?? TOKEN_PROGRAM_ADDRESS;
  const token1Program =
    input.token1Program ?? input.tokenProgram ?? TOKEN_PROGRAM_ADDRESS;
  const quote = getSwapQuote(
    pool.account,
    input.amountIn,
    input.tradeDirection,
  );
  const minAmountOut = getMinAmountOut({
    quotedAmountOut: quote.amountOut,
    minAmountOut: input.minAmountOut,
    slippageBps: input.slippageBps,
  });
  const userToken0 = await getAssociatedTokenAddress({
    owner: userAddress,
    mint: pool.account.token0Mint,
    tokenProgram: token0Program,
  });
  const userToken1 = await getAssociatedTokenAddress({
    owner: userAddress,
    mint: pool.account.token1Mint,
    tokenProgram: token1Program,
  });
  const setupInstructions: Instruction[] = [
    getCreateAssociatedTokenIdempotentInstruction({
      payer: input.payer,
      ata: userToken0,
      owner: userAddress,
      mint: pool.account.token0Mint,
      tokenProgram: token0Program,
    }),
    getCreateAssociatedTokenIdempotentInstruction({
      payer: input.payer,
      ata: userToken1,
      owner: userAddress,
      mint: pool.account.token1Mint,
      tokenProgram: token1Program,
    }),
  ];
  const swapInstruction = createSwapInstruction({
    config: input.config ?? input.deployment?.cpmmConfig ?? pool.account.config,
    pool: pool.address,
    authority: pool.account.authority,
    vault0: pool.account.vault0,
    vault1: pool.account.vault1,
    token0Mint: pool.account.token0Mint,
    token1Mint: pool.account.token1Mint,
    userToken0,
    userToken1,
    user,
    amountIn: input.amountIn,
    minAmountOut,
    tradeDirection: input.tradeDirection,
    oracle: input.oracle,
    remainingAccounts: input.remainingAccounts
      ? [...input.remainingAccounts]
      : undefined,
    updateOracle: input.updateOracle,
    token0Program,
    token1Program,
    programId: programId ?? input.deployment?.cpmmProgram,
  });
  const userIn = input.tradeDirection === 0 ? userToken0 : userToken1;
  const userOut = input.tradeDirection === 0 ? userToken1 : userToken0;

  return {
    pool,
    quote,
    minAmountOut,
    userToken0,
    userToken1,
    userIn,
    userOut,
    setupInstructions,
    swapInstruction,
    instructions: [...setupInstructions, swapInstruction],
  };
}
