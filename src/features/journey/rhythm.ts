import type { JourneyStage } from './schema';

export type RhythmTransition =
  | 'keep'
  | 'start-play'
  | 'start-scrub'
  | 'stop'
  | 'none';

/** Plans how a stage boundary transitions any journey-owned motion. */
export function rhythmPlan(
  prevStage: JourneyStage | undefined,
  nextStage: JourneyStage,
): RhythmTransition {
  const prev = prevStage?.rhythm;
  const next = nextStage.rhythm;

  if (!next) {
    return prev ? 'stop' : 'none';
  }
  if (prev && prev.motion === next.motion && prev.mode === next.mode) {
    return 'keep';
  }
  return next.mode === 'play' ? 'start-play' : 'start-scrub';
}

/** Computes the target phase `[from, to]` for a scrub rhythm at `local` progress in `[0, 1]`. */
export function rhythmPhase(stage: JourneyStage, local: number): number {
  if (stage.rhythm?.mode !== 'scrub') return 0;
  const t = Number.isFinite(local) ? Math.min(1, Math.max(0, local)) : 0;
  const { from, to } = stage.rhythm;
  return from + (to - from) * t;
}
