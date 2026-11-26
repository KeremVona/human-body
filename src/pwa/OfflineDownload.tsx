import type { JSX } from 'react';
import { useAppSelector } from '../app/hooks';
import { useT } from '../i18n/t';
import {
  downloadForOffline,
  isOfflineReady,
  offlineSizeMB,
  startOfflineDownload,
  useOfflineDownloadState,
} from './offline';

/** Settings control allowing full offline download when a Service Worker controls the page. */
export function OfflineDownload({
  hasController,
  download = downloadForOffline,
}: {
  hasController?: boolean;
  download?: typeof downloadForOffline;
}): JSX.Element | null {
  const tr = useT();
  const manifest = useAppSelector((s) => s.assets.manifest);
  const { completedGeneratedAt, progress, errorKind } =
    useOfflineDownloadState();

  const controlled =
    hasController ??
    (typeof navigator !== 'undefined' &&
      'serviceWorker' in navigator &&
      Boolean(navigator.serviceWorker.controller));

  if (!controlled || !manifest) {
    return null;
  }

  const ready =
    completedGeneratedAt === manifest.generatedAt ||
    isOfflineReady(manifest.generatedAt);
  const sizeMB = offlineSizeMB(manifest);

  return (
    <>
      <div className="my-3 border-t border-white/10" />
      <p className="mb-2 text-xs font-semibold tracking-wide text-slate-300 uppercase">
        {tr('offline.heading')}
      </p>
      {ready ? (
        <p className="flex items-center gap-2 text-xs font-medium text-emerald-300">
          <span
            aria-hidden="true"
            className="inline-block h-2 w-2 rounded-full bg-emerald-400"
          />
          <span>{tr('offline.ready')}</span>
        </p>
      ) : progress ? (
        <p
          role="status"
          aria-live="polite"
          className="text-xs text-slate-300"
        >
          {tr('offline.progress', {
            done: String(progress.done),
            total: String(progress.total),
          })}
        </p>
      ) : (
        <button
          type="button"
          onClick={() => {
            void startOfflineDownload(
              manifest,
              import.meta.env.BASE_URL,
              download,
            );
          }}
          className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-left text-xs font-medium text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
        >
          {tr('offline.download', { sizeMB: String(sizeMB) })}
        </button>
      )}
      {errorKind ? (
        <p role="alert" className="mt-2 text-xs text-red-300">
          {errorKind === 'quota'
            ? tr('offline.quota')
            : tr('offline.failed')}
        </p>
      ) : null}
    </>
  );
}
