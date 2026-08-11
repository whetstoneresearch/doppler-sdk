import {
  fetchEncodedAccount,
  type Address,
  type GetAccountInfoApi,
  type Instruction,
  type Rpc,
  type TransactionSigner,
} from '@solana/kit';

import {
  fetchRehypeState,
  getClaimFeesInstructionAsync,
} from '../dopplerRehypeRouterV1/index.js';
import {
  DOPPLER_SOLANA_DEVNET_FEE_REHYPOTHECATION_PROGRAM_ADDRESSES,
  deriveSolanaFeeRehypothecationDeployment,
  type SolanaFeeRehypothecationDeployment,
} from '../deployment.js';
import { calculateBeneficiaryEntitlement } from './math.js';
import { deriveFeeRehypothecationAddresses } from './pda.js';

export type PrepareFeeRehypothecationClaimInput = {
  rpc: Rpc<GetAccountInfoApi>;
  baseMint: Address;
  beneficiary: Address;
  payer: TransactionSigner;
  deployment?: SolanaFeeRehypothecationDeployment;
};

export type PrepareFeeRehypothecationClaimResult = {
  instruction: Instruction;
  beneficiaryIndex: number;
  pendingBaseFees: bigint;
  pendingQuoteFees: bigint;
};

async function getMintProgram(
  rpc: Rpc<GetAccountInfoApi>,
  mint: Address,
): Promise<Address> {
  const account = await fetchEncodedAccount(rpc, mint, {
    commitment: 'confirmed',
  });
  if (!account.exists) {
    throw new Error(`mint ${mint} does not exist`);
  }
  return account.programAddress;
}

export async function prepareClaim(
  input: PrepareFeeRehypothecationClaimInput,
): Promise<PrepareFeeRehypothecationClaimResult> {
  const deployment =
    input.deployment ??
    (await deriveSolanaFeeRehypothecationDeployment(
      DOPPLER_SOLANA_DEVNET_FEE_REHYPOTHECATION_PROGRAM_ADDRESSES,
    ));
  const addresses = await deriveFeeRehypothecationAddresses(
    input.baseMint,
    deployment.dopplerRehypeRouterV1Program,
  );
  const stateAccount = await fetchRehypeState(input.rpc, addresses.state, {
    commitment: 'confirmed',
  });
  const state = stateAccount.data;
  if (
    state.baseMint !== input.baseMint ||
    state.hookProgram !== deployment.dopplerLaunchHookV2Program
  ) {
    throw new Error('fee rehypothecation state does not match the deployment');
  }

  const beneficiaries = state.beneficiaries.slice(0, state.beneficiaryCount);
  const beneficiaryIndex = beneficiaries.findIndex(
    ({ wallet }) => wallet === input.beneficiary,
  );
  if (beneficiaryIndex < 0) {
    throw new Error(`${input.beneficiary} is not a fee beneficiary`);
  }
  const shares = beneficiaries.map(({ shareBps }) => shareBps);
  const pendingBaseFees =
    calculateBeneficiaryEntitlement({
      cumulativeFees: state.cumulativeBeneficiaryBase,
      beneficiarySharesBps: shares,
      beneficiaryIndex,
    }) - state.distributedBaseByBeneficiary[beneficiaryIndex]!;
  const pendingQuoteFees =
    calculateBeneficiaryEntitlement({
      cumulativeFees: state.cumulativeBeneficiaryQuote,
      beneficiarySharesBps: shares,
      beneficiaryIndex,
    }) - state.distributedQuoteByBeneficiary[beneficiaryIndex]!;
  if (pendingBaseFees < 0n || pendingQuoteFees < 0n) {
    throw new Error('distributed fees exceed the beneficiary entitlement');
  }
  if (pendingBaseFees === 0n && pendingQuoteFees === 0n) {
    throw new Error('no fees are available to claim');
  }

  const [baseTokenProgram, quoteTokenProgram] = await Promise.all([
    getMintProgram(input.rpc, state.baseMint),
    getMintProgram(input.rpc, state.quoteMint),
  ]);
  const instruction = await getClaimFeesInstructionAsync(
    {
      payer: input.payer,
      beneficiary: input.beneficiary,
      rehypeState: addresses.state,
      rehypeAuthority: addresses.authority,
      baseMint: state.baseMint,
      quoteMint: state.quoteMint,
      baseTokenProgram,
      quoteTokenProgram,
      beneficiaryIndex,
    },
    { programAddress: deployment.dopplerRehypeRouterV1Program },
  );

  return {
    instruction,
    beneficiaryIndex,
    pendingBaseFees,
    pendingQuoteFees,
  };
}
