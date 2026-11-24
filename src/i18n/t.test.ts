import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  __resetI18nForTests,
  __setCatalogueForTests,
  loadMessages,
  setActiveLocale,
  t,
} from './t';

afterEach(() => {
  __resetI18nForTests();
  vi.restoreAllMocks();
});

describe('t() helper and lazy message loading', () => {
  it('returns exact English strings and interpolates placeholders', () => {
    expect(t('share.copied')).toBe('Link copied');
    expect(t('motion.playing', { label: 'X' })).toBe('Playing X.');
  });

  it('falls back to English with a dev warning when a non-English key is missing', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    __setCatalogueForTests('tr', { share: { copied: 'Bağlantı kopyalandı' } });
    setActiveLocale('tr');

    expect(t('share.copied')).toBe('Bağlantı kopyalandı');
    expect(t('motion.playing', { label: 'X' })).toBe('Playing X.');
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('dynamically loads Turkish catalogue via loadMessages', async () => {
    await loadMessages('tr');
    setActiveLocale('tr');
    expect(t('settings.language')).toBe('Dil');
    expect(t('content.notTranslated')).toBe('Henüz çevrilmedi');
  });
});
