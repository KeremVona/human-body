import { describe, expect, it } from 'vitest';
import type { IndexFile, Manifest, Taxonomy } from '../../data/schema';
import { ancestorsOf, buildTree, flattenTree } from './buildTree';

const taxonomy: Taxonomy = {
  systems: [
    { id: 'skeletal', label: 'Skeletal', color: '#E8DCC4', order: 1 },
    { id: 'muscular', label: 'Muscular', color: '#C0504D', order: 2 },
  ],
  regions: [
    { id: 'thorax', label: 'Thorax' },
    { id: 'upper-limb', label: 'Upper limb' },
    { id: 'lower-limb', label: 'Lower limb' },
  ],
  uiGroups: [],
};

const bounds = {
  min: [0, 0, 0] as [number, number, number],
  max: [0.1, 0.2, 0.1] as [number, number, number],
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

const index: IndexFile = {
  locale: 'en',
  structures: [
    {
      id: 'femur',
      system: 'skeletal',
      region: 'lower-limb',
      paired: true,
      kind: 'bone',
      tissue: 'bone',
      names: { common: 'Femur', synonyms: [] },
      featured: true,
    },
    {
      id: 'sternum',
      system: 'skeletal',
      region: 'thorax',
      paired: false,
      kind: 'bone',
      tissue: 'bone',
      names: { common: 'Sternum', synonyms: [] },
      featured: false,
    },
    {
      id: 'biceps-brachii',
      system: 'muscular',
      region: 'upper-limb',
      group: 'arm-anterior',
      paired: true,
      kind: 'muscle',
      tissue: 'muscle',
      names: { common: 'Biceps brachii', synonyms: [] },
      featured: true,
    },
  ],
};

describe('buildTree', () => {
  const tree = buildTree(taxonomy, index, manifest);

  it('nests system › region › group › structure › side', () => {
    expect(tree.map((n) => n.key)).toEqual(['sys:skeletal', 'sys:muscular']);
    const arm = tree[1].children[0].children[0];
    expect(arm.key).toBe('grp:muscular/upper-limb/arm-anterior');
    expect(arm.children[0].children.map((c) => c.label)).toEqual([
      'Left',
      'Right',
    ]);
    expect(tree[0].children.map((r) => r.key)).toEqual([
      'reg:skeletal/thorax',
      'reg:skeletal/lower-limb',
    ]);
    expect(tree[0].meshIds.slice().sort()).toEqual([
      'femur--l',
      'femur--r',
      'sternum',
    ]);
  });

  it('flattens only expanded nodes', () => {
    expect(flattenTree(tree, new Set()).map((r) => r.key)).toEqual([
      'sys:skeletal',
      'sys:muscular',
    ]);
    expect(
      flattenTree(tree, new Set(['sys:skeletal'])).map((r) => [r.key, r.depth]),
    ).toEqual([
      ['sys:skeletal', 0],
      ['reg:skeletal/thorax', 1],
      ['reg:skeletal/lower-limb', 1],
      ['sys:muscular', 0],
    ]);
  });

  it('finds ancestors', () => {
    expect(ancestorsOf('mesh:femur--l', tree)).toEqual([
      'sys:skeletal',
      'reg:skeletal/lower-limb',
      'str:femur',
    ]);
  });
});
