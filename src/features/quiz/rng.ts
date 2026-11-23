import type { MeshId } from '../../data/ids';

/** Deterministic mulberry32 PRNG returning floats in `[0, 1)`. */
export function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Selects up to `n` distinct MeshIds using partial Fisher–Yates shuffle. */
export function pickQuestions(
  pool: MeshId[],
  n: number,
  rng: () => number,
): MeshId[] {
  const copy = [...pool];
  const count = Math.min(Math.max(0, n), copy.length);
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(rng() * (copy.length - i));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy.slice(0, count);
}
