let currentProgress = 0;
const listeners = new Set<() => void>();

/** External reactive store for per-frame journey progress (`[0, 1]`) outside Redux. */
export const journeyClock = {
  get(): number {
    return currentProgress;
  },
  set(next: number): void {
    const clamped = Number.isFinite(next) ? Math.min(1, Math.max(0, next)) : 0;
    if (Object.is(currentProgress, clamped)) return;
    currentProgress = clamped;
    for (const listener of listeners) {
      listener();
    }
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
