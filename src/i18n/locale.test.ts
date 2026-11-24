import { describe, expect, it } from 'vitest';
import { AVAILABLE_LOCALES, resolveInitialLocale } from './locale';

describe('locale resolution', () => {
  it('supports en and tr', () => {
    expect(AVAILABLE_LOCALES).toEqual(['en', 'tr']);
  });

  it.each([
    [{ query: 'tr', stored: 'en', navigatorLanguages: ['en-US'] }, 'tr'],
    [{ query: 'TR', stored: 'en', navigatorLanguages: ['en-US'] }, 'tr'],
    [{ query: 'xx', stored: 'tr', navigatorLanguages: ['en-US'] }, 'tr'],
    [{ query: null, stored: null, navigatorLanguages: ['tr-TR', 'en'] }, 'tr'],
    [{ query: null, stored: null, navigatorLanguages: ['fr-FR'] }, 'en'],
    [{ query: null, stored: 'invalid', navigatorLanguages: [] }, 'en'],
  ])('resolveInitialLocale(%o) = %s', (input, want) => {
    expect(resolveInitialLocale(input)).toBe(want);
  });
});
