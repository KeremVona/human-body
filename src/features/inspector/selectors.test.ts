import { describe, expect, it } from 'vitest';
import { makeStore } from '../../app/store';
import type { IndexEntry, Manifest, Taxonomy } from '../../data/schema';
import { bootstrap, loadStructures } from '../content/contentSlice';
import { selected } from '../selection/selectionSlice';
import { selectInspectorModel } from './selectors';

const taxonomy: Taxonomy = {
  systems: [{ id: 'skeletal', label: 'Skeletal', color: '#E8DCC4', order: 1 }],
  regions: [
    { id: 'lower-limb', label: 'Lower limb' },
    { id: 'thorax', label: 'Thorax' },
  ],
  uiGroups: [],
};

const structures: IndexEntry[] = [
  {
    id: 'femur',
    system: 'skeletal',
    region: 'lower-limb',
    group: 'Thigh',
    paired: true,
    kind: 'bone',
    tissue: 'bone',
    names: { common: 'Femur', latin: 'Os femoris', synonyms: [] },
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
];

const manifest: Manifest = {
  version: 1,
  generatedAt: '2026-11-21T00:00:00Z',
  source: { name: 'Z-Anatomy', version: '1', license: 'CC-BY-SA-4.0' },
  bundles: [],
  meshes: {},
};

function setupStore() {
  const store = makeStore();
  store.dispatch(
    bootstrap.fulfilled(
      { manifest, taxonomy, index: { locale: 'en', structures } },
      'req-1',
      undefined,
    ),
  );
  return store;
}

describe('selectInspectorModel', () => {
  it('returns null when nothing is selected', () => {
    const store = setupStore();
    expect(selectInspectorModel(store.getState())).toBeNull();
  });

  it('builds single-side model for paired bone', () => {
    const store = setupStore();
    store.dispatch(selected(['femur--l']));

    expect(selectInspectorModel(store.getState())).toMatchObject({
      structureId: 'femur',
      meshIds: ['femur--l'],
      side: 'Left',
      paired: true,
      common: 'Femur',
      latin: 'Os femoris',
      systemLabel: 'Skeletal',
      systemColor: '#E8DCC4',
      regionLabel: 'Lower limb',
      groupLabel: 'Thigh',
      contentStatus: 'loading',
    });
  });

  it('returns side Both when both sides are selected', () => {
    const store = setupStore();
    store.dispatch(selected(['femur--l', 'femur--r']));
    expect(selectInspectorModel(store.getState())?.side).toBe('Both');
  });

  it('returns side null when an unpaired structure is selected', () => {
    const store = setupStore();
    store.dispatch(selected(['sternum']));
    expect(selectInspectorModel(store.getState())).toMatchObject({
      structureId: 'sternum',
      side: null,
      paired: false,
    });
  });

  it('returns null for a mixed-structure selection', () => {
    const store = setupStore();
    store.dispatch(selected(['femur--l', 'sternum']));
    expect(selectInspectorModel(store.getState())).toBeNull();
  });

  it('marks ready without overview when structure file loaded empty', () => {
    const store = setupStore();
    store.dispatch(loadStructures.fulfilled({}, 'req-2', 'skeletal'));
    store.dispatch(selected(['femur--l']));

    expect(selectInspectorModel(store.getState())).toMatchObject({
      overview: undefined,
      contentStatus: 'ready',
    });
  });
});
