import { useState, type JSX } from 'react';
import { useT } from '../../i18n/t';

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
  const tr = useT();
  const [dismissed, setDismissed] = useState(isAlreadyDismissed);

  if (dismissed) {
    return null;
  }

  const copy = isCoarsePointer()
    ? tr('onboarding.touch')
    : tr('onboarding.mouse');

  return (
    <div className="pointer-events-auto flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-full border border-white/10 bg-slate-900/75 px-4 py-1.5 text-xs text-slate-200 shadow-lg backdrop-blur-md">
      <span className="truncate">{copy}</span>
      <button
        type="button"
        onClick={() => {
          saveDismissed();
          setDismissed(true);
        }}
        className="shrink-0 rounded-full bg-white/15 px-2.5 py-0.5 font-medium text-white hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
      >
        {tr('onboarding.gotIt')}
      </button>
    </div>
  );
}
