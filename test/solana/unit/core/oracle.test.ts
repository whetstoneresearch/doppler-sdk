import { describe, expect, it } from 'vitest';
import { address } from '@solana/addresses';
import { consultTwap } from '../../../../src/solana/client/oracle.js';
import { MAX_ORACLE_OBSERVATIONS, Q64_ONE } from '../../../../src/solana/core/constants.js';
import type { OracleState, Observation } from '../../../../src/solana/core/types.js';

function makeOracle(overrides: Partial<OracleState> = {}): OracleState {
  const emptyObs: Observation = {
    timestamp: 0,
    price0Cumulative: 0n,
    price1Cumulative: 0n,
  };
  const observations = Array.from({ length: MAX_ORACLE_OBSERVATIONS }, () => ({ ...emptyObs }));

  return {
    pool: address('11111111111111111111111111111111'),
    initialized: true,
    maxPriceChangeRatioQ64: Q64_ONE,
    lastSlot: 0n,
    truncPrice0Q64: 3n * Q64_ONE,
    truncPrice1Q64: 1n * Q64_ONE,
    deviation0Q64: 0n,
    deviation1Q64: 0n,
    price0Cumulative: 10n * Q64_ONE,
    price1Cumulative: 20n * Q64_ONE,
    lastTimestamp: 100,
    lastObservationTimestamp: 100,
    observationIntervalSec: 60,
    observationIndex: 0,
    observations,
    version: 1,
    reserved: new Uint8Array(7),
    ...overrides,
  };
}

describe('consultTwap', () => {
  it('returns truncated prices when windowSeconds is zero', () => {
    const oracle = makeOracle();
    const result = consultTwap(oracle, 0, 110);
    expect(result).not.toBeNull();
    expect(result?.price0Q64).toBe(oracle.truncPrice0Q64);
    expect(result?.price1Q64).toBe(oracle.truncPrice1Q64);
  });

  it('matches on-chain cumulative math when sampling observations', () => {
    const observations: Observation[] = Array.from({ length: MAX_ORACLE_OBSERVATIONS }, () => ({
      timestamp: 0,
      price0Cumulative: 0n,
      price1Cumulative: 0n,
    }));
    observations[0] = {
      timestamp: 60,
      price0Cumulative: 2n * Q64_ONE,
      price1Cumulative: 4n * Q64_ONE,
    };
    observations[1] = {
      timestamp: 90,
      price0Cumulative: 8n * Q64_ONE,
      price1Cumulative: 16n * Q64_ONE,
    };

    const oracle = makeOracle({ observations });
    const nowTs = 110;
    const windowSeconds = 30;

    const result = consultTwap(oracle, windowSeconds, nowTs);
    expect(result).not.toBeNull();

    const dtSinceLast = nowTs - oracle.lastTimestamp;
    const cum0Now = oracle.price0Cumulative + (oracle.truncPrice0Q64 * BigInt(dtSinceLast));
    const cum1Now = oracle.price1Cumulative + (oracle.truncPrice1Q64 * BigInt(dtSinceLast));
    const sample = observations[0];
    const dt = nowTs - sample.timestamp;
    const expected0 = (cum0Now - sample.price0Cumulative) / BigInt(dt);
    const expected1 = (cum1Now - sample.price1Cumulative) / BigInt(dt);

    expect(result?.price0Q64).toBe(expected0);
    expect(result?.price1Q64).toBe(expected1);
  });

  it('returns null when oracle is uninitialized or missing timestamps', () => {
    const oracle = makeOracle({ initialized: false });
    expect(consultTwap(oracle, 300, 110)).toBeNull();

    const oracleNoTimestamp = makeOracle({ lastTimestamp: 0 });
    expect(consultTwap(oracleNoTimestamp, 300, 110)).toBeNull();
  });
});
