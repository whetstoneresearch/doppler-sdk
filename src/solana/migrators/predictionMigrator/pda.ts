import {
  type Address,
  type ProgramDerivedAddress,
  getAddressCodec,
  getProgramDerivedAddress,
} from '@solana/kit';
import { PREDICTION_MIGRATOR_PROGRAM_ADDRESS } from '../../generated/predictionMigrator/programs/predictionMigrator.js';

const addressCodec = getAddressCodec();
const textEncoder = new TextEncoder();

export async function getPredictionMarketAddress(
  oracleState: Address,
  quoteMint: Address,
  creator: Address,
  programId: Address = PREDICTION_MIGRATOR_PROGRAM_ADDRESS,
): Promise<ProgramDerivedAddress> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [
      textEncoder.encode('market'),
      addressCodec.encode(oracleState),
      addressCodec.encode(quoteMint),
      addressCodec.encode(creator),
    ],
  });
}

export async function getPredictionMarketAuthorityAddress(
  market: Address,
  programId: Address = PREDICTION_MIGRATOR_PROGRAM_ADDRESS,
): Promise<ProgramDerivedAddress> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [
      textEncoder.encode('market_authority'),
      addressCodec.encode(market),
    ],
  });
}

export async function getPredictionPotVaultAddress(
  market: Address,
  programId: Address = PREDICTION_MIGRATOR_PROGRAM_ADDRESS,
): Promise<ProgramDerivedAddress> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [textEncoder.encode('pot_vault'), addressCodec.encode(market)],
  });
}

export async function getPredictionEntryAddress(
  market: Address,
  baseMint: Address,
  programId: Address = PREDICTION_MIGRATOR_PROGRAM_ADDRESS,
): Promise<ProgramDerivedAddress> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [
      textEncoder.encode('entry'),
      addressCodec.encode(market),
      addressCodec.encode(baseMint),
    ],
  });
}

export async function getPredictionClaimReceiptAddress(
  market: Address,
  claimer: Address,
  programId: Address = PREDICTION_MIGRATOR_PROGRAM_ADDRESS,
): Promise<ProgramDerivedAddress> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [
      textEncoder.encode('receipt'),
      addressCodec.encode(market),
      addressCodec.encode(claimer),
    ],
  });
}
