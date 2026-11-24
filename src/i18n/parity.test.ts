import { describe, expect, it } from 'vitest';
import { en } from './messages/en';
import { tr } from './messages/tr';

function flatten(
  obj: Record<string, unknown>,
  prefix = '',
): Array<[string, string]> {
  const entries: Array<[string, string]> = [];
  for (const [key, val] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (typeof val === 'string') {
      entries.push([full, val]);
    } else if (val && typeof val === 'object') {
      entries.push(...flatten(val as Record<string, unknown>, full));
    }
  }
  return entries;
}

function placeholders(str: string): string[] {
  return [...str.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((m) => m[1]).sort();
}

describe('i18n catalogue key parity', () => {
  it('contains every English leaf key in Turkish as non-empty with identical placeholders', () => {
    const enLeaves = flatten(en);
    const trMap = new Map(flatten(tr));

    expect(enLeaves.length).toBeGreaterThan(50);
    for (const [key, enVal] of enLeaves) {
      const trVal = trMap.get(key);
      expect(trVal, `missing key in tr: ${key}`).toBeDefined();
      expect(trVal!.trim().length, `empty key in tr: ${key}`).toBeGreaterThan(
        0,
      );
      expect(
        placeholders(trVal!),
        `placeholder mismatch on key: ${key}`,
      ).toEqual(placeholders(enVal));
    }

    const enKeys = new Set(enLeaves.map(([k]) => k));
    for (const [key] of trMap) {
      expect(enKeys.has(key), `extra key in tr: ${key}`).toBe(true);
    }
  });
});
