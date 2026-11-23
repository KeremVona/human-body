import rawTaxonomy from '../../../content/taxonomy.json';
import { makeStore } from '../../app/store';
import {
  SystemIdSchema,
  TaxonomySchema,
  type IndexFile,
  type Manifest,
} from '../../data/schema';
import {
  opacitySet,
  systemToggled,
  systemsReducer,
  uiGroupToggled,
} from './systemsSlice';

const taxonomy = TaxonomySchema.parse(rawTaxonomy);

const fixtureManifest: Manifest = {
  version: 1,
  generatedAt: '2026-11-21T00:00:00Z',
  source: { name: 'Z-Anatomy', version: '2023-05-02', license: 'CC-BY-SA-4.0' },
  bundles: [
    {
      id: 'skeletal',
      file: 'skeletal.1111aaaa.glb',
      bytes: 100,
      sha256: 'a'.repeat(64),
      meshIds: ['femur--l'],
    },
    {
      id: 'muscular',
      file: 'muscular.2222bbbb.glb',
      bytes: 100,
      sha256: 'b'.repeat(64),
      meshIds: ['biceps-brachii--l'],
    },
  ],
  meshes: {
    'femur--l': {
      bundle: 'skeletal',
      bounds: { min: [0, 0, 0], max: [0.1, 0.4, 0.1] },
      triangles: 10,
      sizeClass: 'large',
    },
    'biceps-brachii--l': {
      bundle: 'muscular',
      bounds: { min: [0, 0, 0], max: [0.1, 0.2, 0.1] },
      triangles: 10,
      sizeClass: 'medium',
    },
  },
};

const fixtureIndex: IndexFile = {
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
  ],
};

it('defaults to skeletal only', () => {
  const state = systemsReducer(undefined, { type: '@@init' });
  for (const id of SystemIdSchema.options) {
    expect(state[id]).toEqual({ enabled: id === 'skeletal', opacity: 1 });
  }
});

it('uiGroupToggled turns a mixed group off, then on', () => {
  let state = systemsReducer(undefined, { type: '@@init' });
  state = systemsReducer(state, systemToggled('nervous'));
  expect(state.nervous.enabled).toBe(true);
  expect(state.digestive.enabled).toBe(false);

  state = systemsReducer(state, uiGroupToggled('major-organs'));
  expect(state.nervous.enabled).toBe(false);
  expect(state.digestive.enabled).toBe(false);

  state = systemsReducer(state, uiGroupToggled('major-organs'));
  expect(state.nervous.enabled).toBe(true);
  expect(state.digestive.enabled).toBe(true);
});

it('requests bundles when a system is enabled', () => {
  const store = makeStore({
    assets: {
      manifest: fixtureManifest,
      boot: 'ready',
      bundles: { skeletal: 'ready', muscular: 'idle' },
      requested: [],
    },
    content: {
      taxonomy,
      index: fixtureIndex,
      structures: {},
    },
  });

  store.dispatch(systemToggled('muscular'));
  expect(store.getState().assets.requested).toContain('muscular');
});

it('opacitySet clamps and rounds', () => {
  let state = systemsReducer(undefined, { type: '@@init' });
  state = systemsReducer(
    state,
    opacitySet({ systems: ['nervous', 'digestive'], opacity: 0.47 }),
  );
  expect(state.nervous.opacity).toBe(0.45);
  expect(state.digestive.opacity).toBe(0.45);

  state = systemsReducer(
    state,
    opacitySet({ systems: ['skeletal'], opacity: 1.3 }),
  );
  expect(state.skeletal.opacity).toBe(1);

  state = systemsReducer(
    state,
    opacitySet({ systems: ['skeletal'], opacity: -1 }),
  );
  expect(state.skeletal.opacity).toBe(0);
});
