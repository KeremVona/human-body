import { useSyncExternalStore } from 'react';
import type { Manifest } from '../data/schema';
import type { Locale } from '../i18n/locale';

const OFFLINE_READY_KEY = 'atlas.offline.generatedAt';

const OFFLINE_STRUCTURE_SYSTEMS = [
  'skeletal',
  'muscular',
  'cardiovascular',
  'lymphatic',
  'nervous',
  'respiratory',
  'digestive',
  'urinary',
] as const;

export type DownloadProgress = {
  done: number;
  total: number;
};

export type OfflineErrorKind = 'quota' | 'failed' | null;

export type OfflineDownloadSnapshot = {
  completedGeneratedAt: string | null;
  progress: DownloadProgress | null;
  errorKind: OfflineErrorKind;
};

let snapshot: OfflineDownloadSnapshot = {
  completedGeneratedAt: null,
  progress: null,
  errorKind: null,
};
const listeners = new Set<() => void>();
let inFlightPromise: Promise<void> | null = null;

function setSnapshot(patch: Partial<OfflineDownloadSnapshot>): void {
  snapshot = { ...snapshot, ...patch };
  for (const listener of listeners) {
    listener();
  }
}

export function __resetOfflineStoreForTests(): void {
  inFlightPromise = null;
  snapshot = {
    completedGeneratedAt: null,
    progress: null,
    errorKind: null,
  };
}

/** Subscribes a React component to persistent offline-download progress and errors. */
export function useOfflineDownloadState(): OfflineDownloadSnapshot {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => snapshot,
  );
}

/** Returns all model, preview, manifest, and content JSON URLs needed for full offline use. */
export function offlineUrls(
  manifest: Manifest,
  baseUrl: string,
  locales: readonly Locale[] = ['en', 'tr'],
  systems: readonly string[] = OFFLINE_STRUCTURE_SYSTEMS,
): string[] {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const urls: string[] = [`${base}models/manifest.json`];

  if (manifest.preview) {
    urls.push(`${base}models/${manifest.preview.file}`);
  }
  for (const bundle of manifest.bundles) {
    urls.push(`${base}models/${bundle.file}`);
  }

  urls.push(`${base}content/taxonomy.json`);
  urls.push(`${base}content/motions.json`);
  urls.push(`${base}content/tours.json`);
  for (const locale of locales) {
    urls.push(`${base}content/${locale}/index.json`);
    urls.push(`${base}content/${locale}/tours.json`);
    for (const system of systems) {
      urls.push(`${base}content/${locale}/structures/${system}.json`);
    }
  }

  return urls;
}

/** Computes total bundle and preview size in raw bytes. */
export function offlineTotalBytes(manifest: Manifest): number {
  return (
    manifest.bundles.reduce((sum, bundle) => sum + bundle.bytes, 0) +
    (manifest.preview?.bytes ?? 0)
  );
}

/** Computes total bundle and preview size in rounded whole megabytes. */
export function offlineSizeMB(manifest: Manifest): number {
  return Math.max(1, Math.round(offlineTotalBytes(manifest) / (1024 * 1024)));
}

/** Records that offline assets matching `manifest.generatedAt` have been cached. */
export function markOfflineReady(generatedAt: string): void {
  try {
    window.localStorage.setItem(OFFLINE_READY_KEY, generatedAt);
  } catch {
    // Ignore storage unavailability in private browsing or restricted frames.
  }
}

/** Checks whether offline assets for `manifest.generatedAt` are already cached. */
export function isOfflineReady(generatedAt: string): boolean {
  try {
    return window.localStorage.getItem(OFFLINE_READY_KEY) === generatedAt;
  } catch {
    return false;
  }
}

/** Fetches all offline URLs sequentially through the active Service Worker cache with quota protection. */
export async function downloadForOffline(opts: {
  urls: readonly string[];
  requiredBytes: number;
  fetchFn?: (url: string) => Promise<Response>;
  estimateStorage?: () => Promise<{ quota?: number; usage?: number } | undefined>;
  onProgress?: (progress: DownloadProgress) => void;
}): Promise<void> {
  const estimate =
    opts.estimateStorage ??
    (async () =>
      typeof navigator !== 'undefined' && navigator.storage?.estimate
        ? navigator.storage.estimate()
        : undefined);

  const storage = await estimate().catch(() => undefined);
  if (
    storage &&
    typeof storage.quota === 'number' &&
    typeof storage.usage === 'number'
  ) {
    const remaining = storage.quota - storage.usage;
    if (remaining < opts.requiredBytes) {
      throw new Error('quota');
    }
  }

  const doFetch = opts.fetchFn ?? ((url: string) => fetch(url));
  const total = opts.urls.length;
  opts.onProgress?.({ done: 0, total });

  for (let i = 0; i < total; i += 1) {
    let response: Response;
    try {
      response = await doFetch(opts.urls[i]);
      if (!response.ok) {
        throw new Error('failed');
      }
      await response.arrayBuffer();
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message === 'quota' || err.name === 'QuotaExceededError')
      ) {
        throw new Error('quota', { cause: err });
      }
      throw new Error('failed', { cause: err });
    }
    opts.onProgress?.({ done: i + 1, total });
  }
}

/** Single-flight offline download manager surviving SettingsMenu unmount/remount cycles. */
export function startOfflineDownload(
  manifest: Manifest,
  baseUrl: string,
  download: typeof downloadForOffline = downloadForOffline,
): Promise<void> {
  if (inFlightPromise) {
    return inFlightPromise;
  }

  const urls = offlineUrls(manifest, baseUrl);
  const requiredBytes = offlineTotalBytes(manifest);
  setSnapshot({
    errorKind: null,
    progress: { done: 0, total: urls.length },
  });

  inFlightPromise = download({
    urls,
    requiredBytes,
    onProgress: (progress) => setSnapshot({ progress }),
  })
    .then(() => {
      markOfflineReady(manifest.generatedAt);
      setSnapshot({
        completedGeneratedAt: manifest.generatedAt,
        progress: null,
        errorKind: null,
      });
    })
    .catch((err: unknown) => {
      setSnapshot({
        progress: null,
        errorKind:
          err instanceof Error && err.message === 'quota' ? 'quota' : 'failed',
      });
    })
    .finally(() => {
      inFlightPromise = null;
    });

  return inFlightPromise;
}
