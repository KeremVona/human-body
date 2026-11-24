import { describe, expect, it } from 'vitest';
import type { IndexEntry, IndexFile } from '../../data/schema';
import { buildSearchIndex } from './searchIndex';

function entry(
  id: string,
  common: string,
  opts: Partial<Pick<IndexEntry, 'system'>> & {
    latin?: string;
    synonyms?: string[];
  } = {},
): IndexEntry {
  return {
    id,
    system: opts.system ?? 'skeletal',
    region: 'lower-limb',
    paired: false,
    kind: 'bone',
    tissue: 'bone',
    names: {
      common,
      latin: opts.latin,
      synonyms: opts.synonyms ?? [],
    },
    featured: true,
  };
}

const fixtureIndex: IndexFile = {
  locale: 'en',
  structures: [
    entry('femur', 'Femur', { latin: 'Femur', synonyms: ['thigh bone'] }),
    entry('biceps-brachii', 'Biceps brachii', {
      latin: 'Musculus biceps brachii',
      system: 'muscular',
    }),
    entry('sternum', 'Sternum', {
      latin: 'Sternum',
      synonyms: ['breastbone'],
    }),
  ],
};

function indexWith(count: number, word: string): IndexFile {
  return {
    locale: 'en',
    structures: Array.from({ length: count }, (_, i) =>
      entry(`struct-${i + 1}`, `${word} ${i + 1}`),
    ),
  };
}

describe('buildSearchIndex', () => {
  const s = buildSearchIndex(fixtureIndex);

  it.each([
    ['fem', 'femur'],
    ['FEMUR', 'femur'],
    ['fémur', 'femur'],
    ['femr', 'femur'],
    ['thigh bone', 'femur'],
    ['bic', 'biceps-brachii'],
    ['breast', 'sternum'],
  ])('%s → %s first', (q, id) => {
    expect(s.search(q)[0]?.structureId).toBe(id);
  });

  it('returns nothing for empty or unknown queries and never throws on punctuation', () => {
    expect(s.search('   ')).toEqual([]);
    expect(s.search('zzzz')).toEqual([]);
    expect(() => s.search('(*[')).not.toThrow();
  });

  it('respects the limit and returns one hit per structure', () => {
    const many = buildSearchIndex(indexWith(20, 'rib'));
    expect(many.search('rib')).toHaveLength(8);
    expect(new Set(many.search('rib').map((h) => h.structureId)).size).toBe(8);
  });

  it('indexes both localized and English names when English fallback index is supplied', () => {
    const trIndex: IndexFile = {
      locale: 'tr',
      structures: [
        entry('femur', 'Uyluk kemiği', {
          latin: 'Os femoris',
          synonyms: ['kalça kemiği'],
        }),
      ],
    };
    const localized = buildSearchIndex(trIndex, fixtureIndex);
    expect(localized.search('uyluk')[0]?.common).toBe('Uyluk kemiği');
    expect(localized.search('thigh bone')[0]?.common).toBe('Uyluk kemiği');
  });
});
