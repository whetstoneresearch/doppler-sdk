import {
  type Address,
  type ProgramDerivedAddress,
  type ReadonlyUint8Array,
  getAddressCodec,
  getProgramDerivedAddress,
} from '@solana/kit';
import { PREDICTION_MIGRATOR_PROGRAM_ADDRESS } from '../../generated/predictionMigrator/programs/predictionMigrator.js';

const addressCodec = getAddressCodec();
const textEncoder = new TextEncoder();

export async function getPredictionMarketAddress(
  oracleState: Address,
  quoteMint: Address,
  programId: Address = PREDICTION_MIGRATOR_PROGRAM_ADDRESS,
): Promise<ProgramDerivedAddress> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [
      textEncoder.encode('market'),
      addressCodec.encode(oracleState),
      addressCodec.encode(quoteMint),
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
  entryId: ReadonlyUint8Array | Uint8Array,
  programId: Address = PREDICTION_MIGRATOR_PROGRAM_ADDRESS,
): Promise<ProgramDerivedAddress> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [textEncoder.encode('entry'), addressCodec.encode(market), entryId],
  });
}

export async function getPredictionEntryByMintAddress(
  market: Address,
  mint: Address,
  programId: Address = PREDICTION_MIGRATOR_PROGRAM_ADDRESS,
): Promise<ProgramDerivedAddress> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [
      textEncoder.encode('entry_by_mint'),
      addressCodec.encode(market),
      addressCodec.encode(mint),
    ],
  });
}
