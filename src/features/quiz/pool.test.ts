import { describe, expect, it } from 'vitest';
import type { IndexEntry, IndexFile, Manifest } from '../../data/schema';
import { buildQuizPool } from './pool';

const bounds = {
  min: [0, 0, 0] as [number, number, number],
  max: [0.1, 0.2, 0.1] as [number, number, number],
};

function makeEntry(
  id: string,
  system: IndexEntry['system'],
  paired: boolean,
  featured: boolean,
): IndexEntry {
  return {
    id,
    system,
    region: 'lower-limb',
    paired,
    kind: 'other',
    tissue: 'other',
    names: { common: id, synonyms: [] },
    featured,
  };
}

const index: IndexFile = {
  locale: 'en',
  structures: [
    makeEntry('femur', 'skeletal', true, true),
    makeEntry('stapes', 'skeletal', true, true),
    makeEntry('sternum', 'skeletal', false, false),
    makeEntry('biceps-brachii', 'muscular', true, true),
  ],
};

const manifest: Manifest = {
  version: 1,
  generatedAt: '2026-11-21T00:00:00Z',
  source: { name: 'Z-Anatomy', version: '2023-05-02', license: 'CC-BY-SA-4.0' },
  bundles: [],
  meshes: {
    'femur--l': {
      bundle: 'skeletal',
      bounds,
      triangles: 10,
      sizeClass: 'large',
    },
    'femur--r': {
      bundle: 'skeletal',
      bounds,
      triangles: 10,
      sizeClass: 'large',
    },
    'stapes--l': {
      bundle: 'skeletal',
      bounds,
      triangles: 10,
      sizeClass: 'tiny',
    },
    'stapes--r': {
      bundle: 'skeletal',
      bounds,
      triangles: 10,
      sizeClass: 'tiny',
    },
    sternum: { bundle: 'skeletal', bounds, triangles: 10, sizeClass: 'medium' },
    'biceps-brachii--l': {
      bundle: 'muscular',
      bounds,
      triangles: 10,
      sizeClass: 'medium',
    },
    'biceps-brachii--r': {
      bundle: 'muscular',
      bounds,
      triangles: 10,
      sizeClass: 'medium',
    },
  },
};

describe('buildQuizPool', () => {
  it('keeps featured, enabled, medium/large meshes, sides separately', () => {
    expect(buildQuizPool(index, manifest, (s) => s === 'skeletal')).toEqual([
      'femur--l',
      'femur--r',
    ]);
    expect(buildQuizPool(index, manifest, () => true)).toEqual([
      'biceps-brachii--l',
      'biceps-brachii--r',
      'femur--l',
      'femur--r',
    ]);
    expect(buildQuizPool(index, manifest, () => false)).toEqual([]);
  });
});
