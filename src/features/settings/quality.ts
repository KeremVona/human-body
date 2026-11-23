export type QualitySetting = 'auto' | 'high' | 'low';
export type ResolvedQuality = 'high' | 'low';

export type QualityEnv = {
  coarsePointer: boolean;
  width: number;
  cores: number;
};

const STORAGE_KEY = 'atlas.quality';

function readEnv(): QualityEnv {
  const coarsePointer =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(pointer: coarse)').matches
      : false;
  const width =
    typeof window !== 'undefined' && typeof window.innerWidth === 'number'
      ? window.innerWidth
      : 1280;
  const cores =
    typeof navigator !== 'undefined' &&
    typeof navigator.hardwareConcurrency === 'number'
      ? navigator.hardwareConcurrency
      : 4;
  return { coarsePointer, width, cores };
}

/** Resolves `'auto'` quality to `'high'` or `'low'` from device capabilities and viewport width. */
export function resolveQuality(
  setting: QualitySetting,
  env: QualityEnv = readEnv(),
): ResolvedQuality {
  if (setting === 'high' || setting === 'low') return setting;
  if (env.coarsePointer || env.width < 768 || env.cores < 4) {
    return 'low';
  }
  return 'high';
}

/** Loads persisted quality preference from `localStorage['atlas.quality']`, defaulting to `'auto'`. */
export function loadQualitySetting(): QualitySetting {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'auto' || raw === 'high' || raw === 'low') return raw;
  } catch {
    // Ignore storage errors (private mode / SSR / disabled storage).
  }
  return 'auto';
}

/** Persists the quality preference to `localStorage['atlas.quality']` inside a try/catch guard. */
export function saveQualitySetting(setting: QualitySetting): void {
  try {
    localStorage.setItem(STORAGE_KEY, setting);
  } catch {
    // Ignore storage quota or security errors.
  }
}
