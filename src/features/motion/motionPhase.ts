let currentPhase = 0;
const listeners = new Set<() => void>();

/** External reactive store for high-frequency live motion phase (`[0, 1]`) outside Redux. */
export const motionPhase = {
  get(): number {
    return currentPhase;
  },
  set(next: number): void {
    if (Object.is(currentPhase, next)) return;
    currentPhase = next;
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
