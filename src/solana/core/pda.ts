import {
  type Address,
  type ProgramDerivedAddress,
  getAddressCodec,
  getProgramDerivedAddress,
} from '@solana/kit';
import {
  PROGRAM_ID,
  SEED_CONFIG,
  SEED_POOL,
  SEED_AUTHORITY,
  SEED_POSITION,
  SEED_ORACLE,
  SEED_PROTOCOL_POSITION,
} from './constants.js';

const addressCodec = getAddressCodec();
const textEncoder = new TextEncoder();

// ============================================================================
// Token Sorting
// ============================================================================

/**
 * Sort two mints into canonical order (token0 < token1 by bytes)
 * This is required for Pool PDA derivation and instruction ordering.
 *
 * @param mint0 - First mint address
 * @param mint1 - Second mint address
 * @returns Tuple of [token0, token1] in canonical order
 * @throws Error if mints are equal
 */
export function sortMints(mint0: Address, mint1: Address): [Address, Address] {
  const bytesA = addressCodec.encode(mint0);
  const bytesB = addressCodec.encode(mint1);

  for (let i = 0; i < 32; i++) {
    if (bytesA[i] < bytesB[i]) {
      return [mint0, mint1];
    }
    if (bytesA[i] > bytesB[i]) {
      return [mint1, mint0];
    }
  }

  throw new Error('Mints are equal - cannot create pool with identical tokens');
}

/**
 * Check if mints are in canonical order
 */
export function areMintsOrdered(mint0: Address, mint1: Address): boolean {
  const bytes0 = addressCodec.encode(mint0);
  const bytes1 = addressCodec.encode(mint1);

  for (let i = 0; i < 32; i++) {
    if (bytes0[i] < bytes1[i]) return true;
    if (bytes0[i] > bytes1[i]) return false;
  }
  return false; // equal
}

// ============================================================================
// PDA Derivation Functions
// ============================================================================

/**
 * Derive the AmmConfig PDA address
 * Seeds: ['config']
 */
export async function getConfigAddress(
  programId: Address = PROGRAM_ID,
): Promise<ProgramDerivedAddress> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [textEncoder.encode(SEED_CONFIG)],
  });
}

/**
 * Derive the Pool PDA address for a token pair
 * Seeds: ['pool', token0_mint, token1_mint]
 *
 * Note: Mints will be automatically sorted if not in canonical order.
 */
export async function getPoolAddress(
  mint0: Address,
  mint1: Address,
  programId: Address = PROGRAM_ID,
): Promise<ProgramDerivedAddress> {
  const [token0, token1] = sortMints(mint0, mint1);
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [
      textEncoder.encode(SEED_POOL),
      addressCodec.encode(token0),
      addressCodec.encode(token1),
    ],
  });
}

/**
 * Derive the Pool authority PDA (vault owner)
 * Seeds: ['authority', pool]
 */
export async function getPoolAuthorityAddress(
  pool: Address,
  programId: Address = PROGRAM_ID,
): Promise<ProgramDerivedAddress> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [textEncoder.encode(SEED_AUTHORITY), addressCodec.encode(pool)],
  });
}

/**
 * Derive the Position PDA address
 * Seeds: ['position', pool, owner, position_id_le_bytes]
 */
export async function getPositionAddress(
  pool: Address,
  owner: Address,
  positionId: bigint,
  programId: Address = PROGRAM_ID,
): Promise<ProgramDerivedAddress> {
  const positionIdBytes = new Uint8Array(8);
  const view = new DataView(positionIdBytes.buffer);
  view.setBigUint64(0, positionId, true); // little-endian

  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [
      textEncoder.encode(SEED_POSITION),
      addressCodec.encode(pool),
      addressCodec.encode(owner),
      positionIdBytes,
    ],
  });
}

/**
 * Derive the OracleState PDA address
 * Seeds: ['oracle', pool]
 */
export async function getOracleAddress(
  pool: Address,
  programId: Address = PROGRAM_ID,
): Promise<ProgramDerivedAddress> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [textEncoder.encode(SEED_ORACLE), addressCodec.encode(pool)],
  });
}

/**
 * Derive the Protocol Position PDA address
 * Seeds: ['protocol_position', pool]
 */
export async function getProtocolPositionAddress(
  pool: Address,
  programId: Address = PROGRAM_ID,
): Promise<ProgramDerivedAddress> {
  return getProgramDerivedAddress({
    programAddress: programId,
    seeds: [
      textEncoder.encode(SEED_PROTOCOL_POSITION),
      addressCodec.encode(pool),
    ],
  });
}

// ============================================================================
// Batch PDA Derivation
// ============================================================================

/**
 * Derive all PDAs needed for pool initialization
 */
export async function getPoolInitAddresses(
  mint0: Address,
  mint1: Address,
  programId: Address = PROGRAM_ID,
): Promise<{
  token0: Address;
  token1: Address;
  pool: ProgramDerivedAddress;
  authority: ProgramDerivedAddress;
  config: ProgramDerivedAddress;
  protocolPosition: ProgramDerivedAddress;
}> {
  const [token0, token1] = sortMints(mint0, mint1);
  const [config, pool] = await Promise.all([
    getConfigAddress(programId),
    getPoolAddress(token0, token1, programId),
  ]);
  const [authority, protocolPosition] = await Promise.all([
    getPoolAuthorityAddress(pool[0], programId),
    getProtocolPositionAddress(pool[0], programId),
  ]);

  return {
    token0,
    token1,
    pool,
    authority,
    config,
    protocolPosition,
  };
}

/**
 * Derive all PDAs needed for swap operation
 */
export async function getSwapAddresses(
  pool: Address,
  programId: Address = PROGRAM_ID,
): Promise<{
  config: ProgramDerivedAddress;
  authority: ProgramDerivedAddress;
  oracle: ProgramDerivedAddress;
}> {
  const [config, authority, oracle] = await Promise.all([
    getConfigAddress(programId),
    getPoolAuthorityAddress(pool, programId),
    getOracleAddress(pool, programId),
  ]);

  return { config, authority, oracle };
}

/**
 * Derive all PDAs needed for liquidity operations
 */
export async function getLiquidityAddresses(
  pool: Address,
  owner: Address,
  positionId: bigint,
  programId: Address = PROGRAM_ID,
): Promise<{
  config: ProgramDerivedAddress;
  authority: ProgramDerivedAddress;
  position: ProgramDerivedAddress;
  protocolPosition: ProgramDerivedAddress;
  oracle: ProgramDerivedAddress;
}> {
  const [config, authority, position, protocolPosition, oracle] =
    await Promise.all([
      getConfigAddress(programId),
      getPoolAuthorityAddress(pool, programId),
      getPositionAddress(pool, owner, positionId, programId),
      getProtocolPositionAddress(pool, programId),
      getOracleAddress(pool, programId),
    ]);

  return { config, authority, position, protocolPosition, oracle };
}
