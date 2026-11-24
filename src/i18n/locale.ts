export const AVAILABLE_LOCALES = ['en', 'tr'] as const;

export type Locale = (typeof AVAILABLE_LOCALES)[number];

const LOCALE_STORAGE_KEY = 'atlas.locale';

function normalizeLocaleTag(tag: string | null | undefined): Locale | null {
  if (!tag) return null;
  const primary = tag.trim().toLowerCase().split(/[-_]/)[0];
  return (AVAILABLE_LOCALES as readonly string[]).includes(primary)
    ? (primary as Locale)
    : null;
}

/** Resolves initial locale priority: `?lang=` -> `atlas.locale` -> `navigator.languages` -> `'en'`. */
export function resolveInitialLocale(input: {
  query: string | null;
  stored: string | null;
  navigatorLanguages: readonly string[];
}): Locale {
  const fromQuery = normalizeLocaleTag(input.query);
  if (fromQuery) return fromQuery;

  const fromStored = normalizeLocaleTag(input.stored);
  if (fromStored) return fromStored;

  for (const lang of input.navigatorLanguages) {
    const matched = normalizeLocaleTag(lang);
    if (matched) return matched;
  }

  return 'en';
}

export function readStoredLocale(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeStoredLocale(locale: Locale): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Ignore storage unavailability
  }
}

export function readQueryLocale(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return new URLSearchParams(window.location.search).get('lang');
  } catch {
    return null;
  }
}

export function detectBootLocale(): Locale {
  const navigatorLanguages =
    typeof navigator !== 'undefined'
      ? navigator.languages && navigator.languages.length > 0
        ? navigator.languages
        : navigator.language
          ? [navigator.language]
          : []
      : [];
  return resolveInitialLocale({
    query: readQueryLocale(),
    stored: readStoredLocale(),
    navigatorLanguages,
  });
}

export function applyHtmlLang(locale: Locale): void {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale;
  }
}
