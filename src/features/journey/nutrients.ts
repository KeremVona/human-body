import type { Journey, Nutrients } from './schema';

const ZERO_NUTRIENTS: Nutrients = {
  carbs: 0,
  protein: 0,
  fat: 0,
  water: 0,
  absorbed: 0,
};

function clamp01(t: number): number {
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.min(1, t));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Linearly interpolates nutrient breakdown and water absorption percentages within a journey stage. */
export function nutrientsAt(
  journey: Journey,
  stageIndex: number,
  stageProgress: number,
): Nutrients {
  if (journey.stages.length === 0) {
    return { ...ZERO_NUTRIENTS };
  }
  const idx = Math.max(
    0,
    Math.min(journey.stages.length - 1, Math.floor(stageIndex)),
  );
  const t = clamp01(stageProgress);
  const prev = idx > 0 ? journey.stages[idx - 1].nutrients : ZERO_NUTRIENTS;
  const cur = journey.stages[idx].nutrients;
  return {
    carbs: lerp(prev.carbs, cur.carbs, t),
    protein: lerp(prev.protein, cur.protein, t),
    fat: lerp(prev.fat, cur.fat, t),
    water: lerp(prev.water, cur.water, t),
    absorbed: lerp(prev.absorbed, cur.absorbed, t),
  };
}
