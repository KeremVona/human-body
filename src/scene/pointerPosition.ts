export type PointerCoords = {
  x: number;
  y: number;
};

const listeners = new Set<() => void>();
let current: PointerCoords = { x: 0, y: 0 };

/** External pointer-coordinate store read via useSyncExternalStore outside Redux. */
export const pointerPosition = {
  set(x: number, y: number): void {
    if (x === current.x && y === current.y) return;
    current = { x, y };
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
  get(): PointerCoords {
    return current;
  },
};
