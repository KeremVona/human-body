import { useSyncExternalStore } from 'react';

export type PreviewLifecycle = 'loading' | 'shown' | 'fading' | 'gone';

export type PreviewEvent =
  | 'loaded'
  | 'failed'
  | 'skeletal-ready'
  | 'fade-done';

let current: PreviewLifecycle = 'loading';
const listeners = new Set<() => void>();

/** Computes the next preview lifecycle state without side effects. */
export function nextPreviewState(
  state: PreviewLifecycle,
  event: PreviewEvent,
  reducedMotion: boolean,
): PreviewLifecycle {
  if (state === 'gone') return 'gone';
  if (event === 'failed' || event === 'fade-done') return 'gone';

  if (event === 'loaded') {
    return state === 'loading' ? 'shown' : state;
  }

  // event === 'skeletal-ready'
  if (state === 'loading') return 'gone';
  if (state === 'shown') return reducedMotion ? 'gone' : 'fading';
  return state;
}

/** External store tracking skeletal preview visibility and fade-out lifecycle. */
export const previewState = {
  get: (): PreviewLifecycle => current,
  set: (next: PreviewLifecycle): void => {
    if (next === current) return;
    current = next;
    for (const listener of listeners) {
      listener();
    }
  },
  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

/** React hook subscribing cleanly to `previewState`. */
export function usePreviewState(): PreviewLifecycle {
  return useSyncExternalStore(previewState.subscribe, previewState.get);
}
