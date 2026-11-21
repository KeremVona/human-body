import { describe, expect, it } from 'vitest';
import type { IndexEntry } from '../data/schema';
import {
  resolveMeshState,
  selectResolvedMeshStates,
  type MeshState,
} from './resolveMeshState';
import { makeStore } from '../app/store';
import { bootstrap } from '../features/content/contentSlice';
import { hide } from '../features/dissection/dissectionSlice';
import { hovered, selected } from '../features/selection/selectionSlice';
import { systemToggled } from '../features/systems/systemsSlice';

const baseDissection = {
  hidden: [],
  isolated: null,
  faded: null,
  fadeOpacity: 0.15,
};

type ResolveInput = Parameters<typeof resolveMeshState>[0];

function resolveWith(
  overrides: Partial<Omit<ResolveInput, 'dissection'>> & {
    dissection?: Partial<ResolveInput['dissection']>;
  } = {},
): MeshState {
  const { dissection: dOverrides, ...rest } = overrides;
  return resolveMeshState({
    meshId: 'femur--l',
    systemEnabled: true,
    systemOpacity: 1,
    dissection: { ...baseDissection, ...dOverrides },
    selectedIds: [],
    hoveredId: null,
    ...rest,
  });
}

describe('resolveMeshState', () => {
  it.each<{
    name: string;
    overrides: Parameters<typeof resolveWith>[0];
    expected: Partial<MeshState>;
  }>([
    {
      name: 'default',
      overrides: {},
      expected: {
        visible: true,
        opacity: 1,
        ghost: false,
        highlight: 'none',
        pickable: true,
      },
    },
    {
      name: 'system off',
      overrides: { systemEnabled: false },
      expected: { visible: false, pickable: false },
    },
    {
      name: 'hidden',
      overrides: { dissection: { hidden: ['femur--l'] } },
      expected: { visible: false },
    },
    {
      name: 'isolated other',
      overrides: { dissection: { isolated: ['sternum'] } },
      expected: { visible: false },
    },
    {
      name: 'isolated self',
      overrides: { dissection: { isolated: ['femur--l'] } },
      expected: { visible: true },
    },
    {
      name: 'faded other',
      overrides: { dissection: { faded: ['sternum'] } },
      expected: { opacity: 0.15, ghost: true, pickable: false },
    },
    {
      name: 'faded self',
      overrides: { dissection: { faded: ['femur--l'] } },
      expected: { opacity: 1, ghost: false },
    },
    {
      name: 'selected',
      overrides: { selectedIds: ['femur--l'] },
      expected: { highlight: 'selected' },
    },
    {
      name: 'hovered',
      overrides: { hoveredId: 'femur--l' },
      expected: { highlight: 'hovered' },
    },
    {
      name: 'both selected and hovered',
      overrides: { selectedIds: ['femur--l'], hoveredId: 'femur--l' },
      expected: { highlight: 'selected' },
    },
    {
      name: 'invisible selected',
      overrides: {
        dissection: { hidden: ['femur--l'] },
        selectedIds: ['femur--l'],
      },
      expected: { highlight: 'none' },
    },
    {
      name: 'half opacity',
      overrides: { systemOpacity: 0.5 },
      expected: { opacity: 0.5, pickable: true, ghost: false },
    },
    {
      name: 'low opacity',
      overrides: { systemOpacity: 0.49 },
      expected: { pickable: false },
    },
  ])('$name', ({ overrides, expected }) => {
    expect(resolveWith(overrides)).toMatchObject(expected);
  });
});

describe('selectResolvedMeshStates', () => {
  const structures: IndexEntry[] = [
    {
      id: 'femur',
      system: 'skeletal',
      region: 'lower-limb',
      paired: true,
      kind: 'bone',
      tissue: 'bone',
      names: { common: 'Femur', synonyms: [] },
      featured: false,
    },
    {
      id: 'biceps-brachii',
      system: 'muscular',
      region: 'upper-limb',
      paired: true,
      kind: 'muscle',
      tissue: 'muscle',
      names: { common: 'Biceps brachii', synonyms: [] },
      featured: false,
    },
  ];

  function bootstrappedStore() {
    const store = makeStore();
    store.dispatch(
      bootstrap.fulfilled(
        {
          manifest: {
            version: 1,
            generatedAt: '2026-11-21T00:00:00Z',
            source: {
              name: 'Z-Anatomy',
              version: '1',
              license: 'CC-BY-SA-4.0',
            },
            bundles: [],
            meshes: {},
          },
          taxonomy: { systems: [], regions: [], uiGroups: [] },
          index: { locale: 'en', structures },
        },
        'req-1',
        undefined,
      ),
    );
    return store;
  }

  it('resolves known structures and treats unknown structures as systemEnabled: false', () => {
    const store = bootstrappedStore();
    store.dispatch(selected(['femur--l']));
    store.dispatch(hovered('femur--r'));
    store.dispatch(hide(['femur--l']));

    const result = selectResolvedMeshStates(store.getState(), [
      'femur--l',
      'femur--r',
      'biceps-brachii--l',
      'unknown-part',
    ]);

    expect(result.get('femur--l')).toMatchObject({
      visible: false,
      highlight: 'none',
      pickable: false,
    });
    expect(result.get('femur--r')).toMatchObject({
      visible: true,
      highlight: 'hovered',
      pickable: true,
    });
    expect(result.get('biceps-brachii--l')).toMatchObject({
      visible: false,
      pickable: false,
    });
    expect(result.get('unknown-part')).toMatchObject({
      visible: false,
      pickable: false,
    });

    store.dispatch(systemToggled('muscular'));
    const updated = selectResolvedMeshStates(store.getState(), [
      'biceps-brachii--l',
    ]);
    expect(updated.get('biceps-brachii--l')).toMatchObject({
      visible: true,
      pickable: true,
    });
  });

  it('memoises the returned map across unchanged state and equal meshIds', () => {
    const store = bootstrappedStore();
    const state = store.getState();

    const first = selectResolvedMeshStates(state, ['femur--l', 'femur--r']);
    const second = selectResolvedMeshStates(state, ['femur--l', 'femur--r']);
    expect(second).toBe(first);
  });
});
