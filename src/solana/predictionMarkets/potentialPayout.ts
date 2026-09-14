import type {
  Address,
  Rpc,
  GetAccountInfoApi,
  GetMultipleAccountsApi,
  GetProgramAccountsApi,
} from '@solana/kit';
import {
  fetchMint,
  fetchToken,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import * as init from '../generated/initializer/index.js';
import { INITIALIZER_PROGRAM_ID } from '../initializer/constants.js';
import {
  fetchPredictionMarket,
  fetchPredictionMarketWithLaunches,
} from './reads.js';
import type { OracleState } from '../trustedOracle/index.js';
import type { Market } from '../migrators/predictionMigrator/index.js';
import { assertU64 } from './validation.js';

/** Pure hypothetical arithmetic for a caller-supplied snapshot. This function has no oracle state and cannot establish that a candidate can win. Use fetchPotentialPayoutIfWinner for verified on-chain inputs and finalized-winner checks. */
export function calculatePotentialPayoutIfWinner(input: {
  isVoid: boolean;
  totalPot: bigint;
  totalClaimed: bigint;
  tokenAmount: bigint;
  candidateMintSupply: bigint;
  candidateUnsoldBase: bigint;
  fixedWinnerSupply?: bigint;
  unsettledQuoteVaults: readonly { amount: bigint; pendingFees: bigint }[];
}) {
  if (input.isVoid)
    throw new Error('Potential payout is unavailable for a void market');
  for (const [key, value] of Object.entries(input))
    if (typeof value === 'bigint') assertU64(value, key);
  if (input.totalClaimed > input.totalPot)
    throw new Error('Claimed quote exceeds realized pot');
  const realizedRemainingPot = input.totalPot - input.totalClaimed;
  let unsettledContributions = 0n;
  for (const vault of input.unsettledQuoteVaults) {
    assertU64(vault.amount, 'quote vault amount');
    assertU64(vault.pendingFees, 'pending quote fees');
    if (vault.pendingFees > vault.amount)
      throw new Error('Pending fees exceed quote reserve');
    unsettledContributions += vault.amount - vault.pendingFees;
  }
  const supply = input.fixedWinnerSupply ?? input.candidateMintSupply;
  if (input.candidateUnsoldBase >= supply)
    throw new Error('Candidate has zero circulating claimable supply');
  const claimableSupplyUsed = supply - input.candidateUnsoldBase;
  if (input.tokenAmount > claimableSupplyUsed)
    throw new Error('Token amount exceeds claimable supply');
  const potUsed = realizedRemainingPot + unsettledContributions;
  assertU64(potUsed, 'estimated pot');
  return {
    kind: 'hypothetical-remaining-pot' as const,
    realizedRemainingPot,
    unsettledContributions,
    potUsed,
    claimableSupplyUsed,
    payoutQuoteForTokenAmount:
      (potUsed * input.tokenAmount) / claimableSupplyUsed,
    isEstimate: true as const,
  };
}

/** Rejects outcomes that can no longer win once the oracle has finalized. */
export function assertPotentialPayoutCandidate(
  oracle: Pick<
    OracleState,
    'isFinalized' | 'outcomeIds' | 'outcomeCount' | 'winningOutcomeId'
  >,
  market: Pick<Market, 'outcomeMints'>,
  candidateMint: Address,
) {
  if (!oracle.isFinalized) return;
  const winnerIndex = oracle.outcomeIds
    .slice(0, oracle.outcomeCount)
    .findIndex(
      (id) =>
        id.length === oracle.winningOutcomeId.length &&
        id.every((value, index) => value === oracle.winningOutcomeId[index]),
    );
  if (winnerIndex < 0)
    throw new Error('Finalized oracle has an invalid winning outcome');
  if (market.outcomeMints[winnerIndex] !== candidateMint)
    throw new Error('Candidate is a losing outcome of the finalized oracle');
}

/**
 * Estimates a proportional share if this registered outcome wins using current reserves.
 * Follows the program preview's remaining-pot/supply arithmetic, but excludes reserved
 * launch fees and derives unique vaults itself. Future buys and receipt reward debt are
 * excluded. For actual winnings/late harvests use previewClaim with a current receipt.
 */
export async function fetchPotentialPayoutIfWinner(
  rpc: Rpc<GetAccountInfoApi & GetMultipleAccountsApi & GetProgramAccountsApi>,
  input: { market: Address; candidateMint: Address; tokenAmount: bigint },
) {
  const view = await fetchPredictionMarketWithLaunches(rpc, input.market);
  if (view.market.data.isVoid)
    throw new Error('Potential payout is unavailable for a void market');
  if (view.status.missingOutcomeIndexes.length)
    throw new Error(
      'All outcomes must be registered before estimating payouts',
    );
  const candidate = view.outcomes.find(
    (o) => o.entry.data.baseMint === input.candidateMint,
  );
  if (!candidate)
    throw new Error('Candidate mint is not registered in this market');
  assertPotentialPayoutCandidate(
    view.oracle.data,
    view.market.data,
    input.candidateMint,
  );
  const [mint, quoteMint] = await Promise.all([
    fetchMint(rpc, input.candidateMint, { commitment: 'confirmed' }),
    fetchMint(rpc, view.market.data.quoteMint, { commitment: 'confirmed' }),
  ]);
  if (
    mint.programAddress !== TOKEN_PROGRAM_ADDRESS ||
    quoteMint.programAddress !== TOKEN_PROGRAM_ADDRESS
  )
    throw new Error('Potential payout supports SPL Token only');
  const usedVaults = new Set<Address>();
  let candidateUnsoldBase = 0n;
  const contributions = await Promise.all(
    view.outcomes
      .filter((o) => !o.entry.data.isMigrated)
      .map(async (outcome) => {
        const vaultAddress = outcome.launch.account.quoteVault;
        if (usedVaults.has(vaultAddress))
          throw new Error('Duplicate quote vault in prediction market');
        usedVaults.add(vaultAddress);
        const [vault, fees] = await Promise.all([
          fetchToken(rpc, vaultAddress, { commitment: 'confirmed' }),
          init.fetchLaunchFeeState(rpc, outcome.launchFeeState, {
            commitment: 'confirmed',
          }),
        ]);
        if (
          vault.programAddress !== TOKEN_PROGRAM_ADDRESS ||
          vault.data.mint !== view.market.data.quoteMint ||
          vault.data.owner !== outcome.launchAuthority ||
          fees.programAddress !== INITIALIZER_PROGRAM_ID ||
          fees.data.launch !== outcome.launch.address ||
          !fees.data.discriminator.every(
            (v, i) => v === init.LAUNCH_FEE_STATE_DISCRIMINATOR[i],
          )
        )
          throw new Error('Invalid prediction quote vault or fee state');
        const fee = fees.data;
        if (
          fee.beneficiaryLen > fee.beneficiaries.length ||
          fee.swapFeeBps !== outcome.launch.account.swapFeeBps
        )
          throw new Error('Invalid prediction fee configuration');
        const pendingFees =
          fee.cumulatedQuoteFees -
          fee.distributedProtocolQuoteFees -
          fee.distributedQuoteByBeneficiary
            .slice(0, fee.beneficiaryLen)
            .reduce((a, b) => a + b, 0n);
        if (outcome.entry.data.baseMint === input.candidateMint) {
          const base = await fetchToken(rpc, outcome.launch.account.baseVault, {
            commitment: 'confirmed',
          });
          if (
            base.programAddress !== TOKEN_PROGRAM_ADDRESS ||
            base.data.mint !== input.candidateMint ||
            base.data.owner !== outcome.launchAuthority
          )
            throw new Error('Invalid candidate base vault');
          const pendingBaseFees =
            fee.cumulatedBaseFees -
            fee.distributedProtocolBaseFees -
            fee.distributedBaseByBeneficiary
              .slice(0, fee.beneficiaryLen)
              .reduce((a, b) => a + b, 0n);
          if (pendingBaseFees < 0n || pendingBaseFees > base.data.amount)
            throw new Error('Inconsistent candidate base fees; refresh state');
          // Settlement leaves beneficiary/protocol fees in the vault. Only the
          // remaining base tokens are burned and removed from claimable supply.
          candidateUnsoldBase = base.data.amount - pendingBaseFees;
        }
        return { amount: vault.data.amount, pendingFees };
      }),
  );
  // Settlement or claims during these reads could otherwise double-count moved reserves.
  const refreshed = await fetchPredictionMarket(rpc, input.market);
  if (
    refreshed.market.data.totalPot !== view.market.data.totalPot ||
    refreshed.market.data.totalClaimed !== view.market.data.totalClaimed ||
    refreshed.market.data.isResolved !== view.market.data.isResolved ||
    refreshed.market.data.isVoid !== view.market.data.isVoid ||
    refreshed.entries.some(
      (entry) =>
        entry.data.isMigrated !==
        view.entries.find((old) => old.address === entry.address)?.data
          .isMigrated,
    )
  )
    throw new Error(
      'Market changed while estimating payout; refresh and retry',
    );
  assertPotentialPayoutCandidate(
    refreshed.oracle.data,
    refreshed.market.data,
    input.candidateMint,
  );
  const market = view.market.data;
  return {
    ...calculatePotentialPayoutIfWinner({
      isVoid: market.isVoid,
      totalPot: market.totalPot,
      totalClaimed: market.totalClaimed,
      tokenAmount: input.tokenAmount,
      candidateMintSupply: mint.data.supply,
      candidateUnsoldBase,
      fixedWinnerSupply:
        market.isResolved &&
        market.winnerMint === input.candidateMint &&
        market.claimableSupply > 0n
          ? market.claimableSupply
          : undefined,
      unsettledQuoteVaults: contributions,
    }),
    market: input.market,
    candidateMint: input.candidateMint,
  };
}
