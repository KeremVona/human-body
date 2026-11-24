import { useCallback, useSyncExternalStore } from 'react';
import type { Locale } from './locale';
import { en } from './messages/en';

export type DeepStringRecord<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStringRecord<T[K]>;
};

export type Messages = DeepStringRecord<typeof en>;

type LeafPaths<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? Prefix extends ''
      ? K
      : `${Prefix}.${K}`
    : LeafPaths<T[K], Prefix extends '' ? K : `${Prefix}.${K}`>;
}[keyof T & string];

export type MessageKey = LeafPaths<typeof en>;

const catalogues = new Map<Locale, Record<string, unknown>>([['en', en]]);
let activeLocale: Locale = 'en';
let revision = 0;
const listeners = new Set<() => void>();

function notify(): void {
  revision += 1;
  for (const listener of listeners) {
    listener();
  }
}

function getByPath(obj: Record<string, unknown>, path: string): unknown {
  let cur: unknown = obj;
  for (const part of path.split('.')) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function interpolate(
  template: string,
  vars?: Record<string, string | number>,
): string {
  if (!vars) return template;
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name: string) =>
    Object.hasOwn(vars, name) ? String(vars[name]) : match,
  );
}

/** Looks up a message in the active locale with English fallback and `{var}` substitution. */
export function t(
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  const cat = catalogues.get(activeLocale) ?? en;
  let value = getByPath(cat, key);
  if (typeof value !== 'string') {
    if (activeLocale !== 'en' && import.meta.env.DEV) {
      console.warn(`Missing "${activeLocale}" translation for "${key}"`);
    }
    value = getByPath(en, key);
  }
  if (typeof value !== 'string') {
    return key;
  }
  return interpolate(value, vars);
}

export function getActiveLocale(): Locale {
  return activeLocale;
}

export function setActiveLocale(locale: Locale): void {
  if (activeLocale === locale) return;
  activeLocale = locale;
  notify();
}

/** Dynamically loads the message catalogue for non-English locales. */
export async function loadMessages(locale: Locale): Promise<void> {
  if (locale === 'en' || catalogues.has(locale)) {
    return;
  }
  if (locale === 'tr') {
    const mod = await import('./messages/tr');
    catalogues.set('tr', mod.tr);
    if (activeLocale === 'tr') {
      notify();
    }
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): string {
  return `${activeLocale}:${revision}`;
}

/** React hook subscribing components to locale changes and loaded catalogues. */
export function useT(): typeof t {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return useCallback(
    (key: MessageKey, params?: Record<string, string | number>) => {
      void snapshot;
      return t(key, params);
    },
    [snapshot],
  );
}

export function __setCatalogueForTests(
  locale: Locale,
  partial: Record<string, unknown>,
): void {
  catalogues.set(locale, partial);
  notify();
}

export function __resetI18nForTests(): void {
  catalogues.clear();
  catalogues.set('en', en);
  activeLocale = 'en';
  notify();
}
