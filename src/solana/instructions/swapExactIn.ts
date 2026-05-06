import type { Address, Instruction } from '@solana/kit';
import { AccountRole, createNoopSigner } from '@solana/kit';
import { CPMM_PROGRAM_ADDRESS } from '../generated/cpmm/programs/index.js';
import { getSwapExactInInstruction } from '../generated/cpmm/instructions/index.js';
import { TOKEN_PROGRAM_ADDRESS } from '../core/constants.js';
import type { SwapDirection } from '../core/types.js';

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
  user: Address;
  amountIn: bigint;
  minAmountOut: bigint;
  direction: SwapDirection;
  oracle?: Address;
  remainingAccounts?: Address[];
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
    direction,
    oracle,
    remainingAccounts = [],
    updateOracle = false,
    token0Program,
    token1Program,
    tokenProgram,
    programId = CPMM_PROGRAM_ADDRESS,
  } = params;

  // Determine vaults and user accounts based on direction
  const [vaultIn, vaultOut] =
    direction === 0 ? [vault0, vault1] : [vault1, vault0];
  const [userIn, userOut] =
    direction === 0 ? [userToken0, userToken1] : [userToken1, userToken0];

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
      trader: createNoopSigner(user),
      token0Program: token0Program ?? tokenProgram ?? TOKEN_PROGRAM_ADDRESS,
      token1Program: token1Program ?? tokenProgram ?? TOKEN_PROGRAM_ADDRESS,
      oracle,
      amountIn,
      minAmountOut,
      direction,
      updateOracle,
    },
    { programAddress: programId },
  );

  return {
    ...instruction,
    accounts: [
      ...(instruction.accounts ?? []),
      ...remainingAccounts.map((address) => ({
        address,
        role: AccountRole.READONLY,
      })),
    ],
  };
}

export const MAX_FEE_AMOUNT = BigInt('18446744073709551615');
