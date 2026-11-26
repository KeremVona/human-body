import { useState, type JSX } from 'react';
import { useT } from '../i18n/t';

/** Prompt-only toast shown when a new Service Worker version is waiting to activate. */
export function UpdateToast({
  onReload,
}: {
  onReload: (() => Promise<void>) | null;
}): JSX.Element | null {
  const tr = useT();
  const [reloading, setReloading] = useState(false);

  if (!onReload) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto flex items-center gap-3 rounded-full border border-sky-400/30 bg-slate-900/95 px-4 py-1.5 text-xs text-slate-100 shadow-xl backdrop-blur-md"
      >
        <span>{tr('pwa.updateAvailable')}</span>
        <button
          type="button"
          disabled={reloading}
          onClick={() => {
            setReloading(true);
            void onReload();
          }}
          className="rounded-full bg-sky-500 px-3 py-0.5 font-medium text-slate-950 transition-colors hover:bg-sky-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 disabled:opacity-60"
        >
          {tr('pwa.reload')}
        </button>
      </div>
    </div>
  );
}
