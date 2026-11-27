import type { Journey, MeterId } from './schema';

function clamp01(t: number): number {
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.min(1, t));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Linearly interpolates every journey meter within a stage (clamping progress to `[0, 1]`). */
export function metersAt(
  journey: Journey,
  stageIndex: number,
  stageProgress: number,
): Record<MeterId, number> {
  if (journey.stages.length === 0) {
    return {};
  }
  const idx = Math.max(
    0,
    Math.min(journey.stages.length - 1, Math.floor(stageIndex)),
  );
  const t = clamp01(stageProgress);
  const cur = journey.stages[idx].meters;
  const prev =
    idx > 0
      ? journey.stages[idx - 1].meters
      : (journey.metersStart ?? cur);

  const out: Record<MeterId, number> = {};
  for (const m of journey.meters) {
    const endVal = cur[m.id] ?? 0;
    const startVal = prev[m.id] ?? endVal;
    out[m.id] = lerp(startVal, endVal, t);
  }
  return out;
}
