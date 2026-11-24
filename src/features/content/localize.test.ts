import { describe, expect, it } from 'vitest';
import type { IndexFile, StructureFile } from '../../data/schema';
import { localizeIndex, localizeStructures } from './localize';

const enIndex: IndexFile = {
  locale: 'en',
  structures: [
    {
      id: 'femur',
      system: 'skeletal',
      region: 'lower-limb',
      group: 'Thigh',
      paired: true,
      kind: 'bone',
      tissue: 'bone',
      names: { common: 'Femur', latin: 'Os femoris', synonyms: ['thigh bone'] },
      featured: true,
    },
    {
      id: 'sternum',
      system: 'skeletal',
      region: 'thorax',
      paired: false,
      kind: 'bone',
      tissue: 'bone',
      names: { common: 'Sternum', synonyms: ['breastbone'] },
      featured: false,
    },
  ],
};

const enStructures: StructureFile = {
  system: 'skeletal',
  entries: [
    {
      id: 'femur',
      overview: 'Longest bone in the body.',
      function: 'Supports body weight.',
      details: {
        kind: 'bone',
        boneType: 'long',
        articulatesWith: ['sternum'],
      },
      sources: [
        {
          title: 'OpenStax',
          url: 'https://openstax.org/books/anatomy-and-physiology-2e',
          license: 'CC-BY-4.0',
        },
      ],
    },
    {
      id: 'sternum',
      overview: 'Flat bone in the chest.',
      sources: [
        {
          title: 'OpenStax',
          url: 'https://openstax.org/books/anatomy-and-physiology-2e',
          license: 'CC-BY-4.0',
        },
      ],
    },
  ],
};

describe('localizeIndex', () => {
  it('returns English entries and marks all ids as fallback when locale file is null', () => {
    const result = localizeIndex(enIndex, null);
    expect(result.file).toEqual(enIndex);
    expect([...result.fallbackIds]).toEqual(['femur', 'sternum']);
  });

  it('overlays only names and never replaces structural attributes from locale index', () => {
    const trIndex: IndexFile = {
      locale: 'tr',
      structures: [
        {
          id: 'femur',
          system: 'muscular',
          region: 'head',
          paired: false,
          kind: 'muscle',
          tissue: 'muscle',
          names: {
            common: 'Uyluk kemiği',
            synonyms: ['femur'],
          },
          featured: false,
        },
      ],
    };

    const result = localizeIndex(enIndex, trIndex);
    expect(result.file.locale).toBe('tr');
    expect(result.file.structures[0]).toEqual({
      ...enIndex.structures[0],
      names: {
        common: 'Uyluk kemiği',
        latin: 'Os femoris',
        synonyms: ['femur'],
      },
    });
    expect(result.file.structures[1]).toEqual(enIndex.structures[1]);
    expect(result.fallbackIds.has('femur')).toBe(false);
    expect(result.fallbackIds.has('sternum')).toBe(true);
  });
});

describe('localizeStructures', () => {
  it('overlays translated fields and falls back per field when missing', () => {
    const trStructures: StructureFile = {
      system: 'skeletal',
      entries: [
        {
          id: 'femur',
          overview: 'Vücuttaki en uzun kemiktir.',
          details: {
            kind: 'bone',
            boneType: 'long',
            articulatesWith: [],
          },
          sources: [
            {
              title: 'OpenStax',
              url: 'https://openstax.org/books/anatomy-and-physiology-2e',
              license: 'CC-BY-4.0',
            },
          ],
        },
      ],
    };

    const result = localizeStructures(enStructures, trStructures);
    const femur = result.file?.entries.find((e) => e.id === 'femur');
    const sternum = result.file?.entries.find((e) => e.id === 'sternum');

    expect(femur?.overview).toBe('Vücuttaki en uzun kemiktir.');
    expect(femur?.function).toBe('Supports body weight.');
    expect(femur?.details).toEqual({
      kind: 'bone',
      boneType: 'long',
      articulatesWith: ['sternum'],
    });
    expect(sternum).toEqual(enStructures.entries[1]);
    expect(result.fallbackIds.has('femur')).toBe(true);
    expect(result.fallbackIds.has('sternum')).toBe(true);
  });
});
