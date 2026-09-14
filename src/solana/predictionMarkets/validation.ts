import type { ReadonlyUint8Array } from '@solana/kit';
export function assertU64(value: bigint, name: string) {
  if (value < 0n || value > (1n << 64n) - 1n)
    throw new Error(`${name} must fit in a u64`);
}
export function assertOutcomeId(id: ReadonlyUint8Array) {
  if (id.length !== 32 || !id.some((v) => v !== 0))
    throw new Error('Outcome ID must contain 32 bytes and be nonzero');
}
export function assertOutcomeIds(ids: readonly ReadonlyUint8Array[]) {
  if (ids.length < 2 || ids.length > 8)
    throw new Error('Oracle requires 2–8 outcomes');
  const seen = new Set<string>();
  for (const id of ids) {
    assertOutcomeId(id);
    const key = Array.from(id).join(',');
    if (seen.has(key)) throw new Error('Outcome IDs must be unique');
    seen.add(key);
  }
}
/** Deterministic human-readable IDs for examples; rejects truncation rather than silently colliding. */
export function outcomeIdFromLabel(label: string): Uint8Array {
  const bytes = new TextEncoder().encode(label);
  if (bytes.length === 0 || bytes.length > 32)
    throw new Error('Outcome label must encode to 1–32 bytes');
  const id = new Uint8Array(32);
  id.set(bytes);
  assertOutcomeId(id);
  return id;
}
