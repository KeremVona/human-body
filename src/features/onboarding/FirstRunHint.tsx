import { useState, type JSX } from 'react';

const HINT_KEY = 'atlas.hintDismissed';

function isAlreadyDismissed(): boolean {
  try {
    return window.localStorage.getItem(HINT_KEY) === '1';
  } catch {
    return false;
  }
}

function saveDismissed(): void {
  try {
    window.localStorage.setItem(HINT_KEY, '1');
  } catch {
    // Ignore storage unavailability (private browsing / sandboxed contexts).
  }
}

function isCoarsePointer(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches
  );
}

/** Dismissible first-run interaction hint persisted in localStorage. */
export function FirstRunHint(): JSX.Element | null {
  const [dismissed, setDismissed] = useState(isAlreadyDismissed);

  if (dismissed) {
    return null;
  }

  const copy = isCoarsePointer()
    ? 'Drag · Pinch · Tap'
    : 'Drag to rotate · Scroll to zoom · Click any part';

  return (
    <div className="fixed bottom-16 left-1/2 z-10 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-full border border-white/10 bg-slate-900/75 px-4 py-1.5 text-xs text-slate-200 shadow-lg backdrop-blur-md">
      <span className="truncate">{copy}</span>
      <button
        type="button"
        onClick={() => {
          saveDismissed();
          setDismissed(true);
        }}
        className="shrink-0 rounded-full bg-white/15 px-2.5 py-0.5 font-medium text-white hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
      >
        Got it
      </button>
    </div>
  );
}
