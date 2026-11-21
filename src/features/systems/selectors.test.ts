import rawTaxonomy from '../../../content/taxonomy.json';
import { makeStore } from '../../app/store';
import {
  TaxonomySchema,
  type IndexFile,
  type Manifest,
} from '../../data/schema';
import { selectToggleRows } from './selectors';
import { systemToggled } from './systemsSlice';

const taxonomy = TaxonomySchema.parse(rawTaxonomy);

const bounds = {
  min: [0, 0, 0] as [number, number, number],
  max: [0.1, 0.2, 0.1] as [number, number, number],
};

function makeFixtureState(
  bundles: Record<string, 'idle' | 'loading' | 'ready' | 'error'> = {
    skeletal: 'ready',
    muscular: 'ready',
    cardiovascular: 'idle',
    organs: 'loading',
  },
) {
  const manifest: Manifest = {
    version: 1,
    generatedAt: '2026-11-21T00:00:00Z',
    source: {
      name: 'Z-Anatomy',
      version: '2023-05-02',
      license: 'CC-BY-SA-4.0',
    },
    bundles: [
      {
        id: 'skeletal',
        file: 'skeletal.1111aaaa.glb',
        bytes: 10,
        sha256: 'a'.repeat(64),
        meshIds: ['femur--l'],
      },
      {
        id: 'muscular',
        file: 'muscular.2222bbbb.glb',
        bytes: 10,
        sha256: 'b'.repeat(64),
        meshIds: ['biceps--l'],
      },
      {
        id: 'cardiovascular',
        file: 'cardiovascular.3333cccc.glb',
        bytes: 10,
        sha256: 'c'.repeat(64),
        meshIds: ['heart'],
      },
      {
        id: 'organs',
        file: 'organs.4444dddd.glb',
        bytes: 10,
        sha256: 'd'.repeat(64),
        meshIds: ['spinal-dura', 'stomach'],
      },
    ],
    meshes: {
      'femur--l': {
        bundle: 'skeletal',
        bounds,
        triangles: 10,
        sizeClass: 'large',
      },
      'biceps--l': {
        bundle: 'muscular',
        bounds,
        triangles: 10,
        sizeClass: 'medium',
      },
      heart: {
        bundle: 'cardiovascular',
        bounds,
        triangles: 10,
        sizeClass: 'large',
      },
      'spinal-dura': {
        bundle: 'organs',
        bounds,
        triangles: 10,
        sizeClass: 'medium',
      },
      stomach: { bundle: 'organs', bounds, triangles: 10, sizeClass: 'medium' },
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
        featured: false,
      },
      {
        id: 'biceps',
        system: 'muscular',
        region: 'upper-limb',
        paired: true,
        kind: 'muscle',
        tissue: 'muscle',
        names: { common: 'Biceps', synonyms: [] },
        featured: false,
      },
      {
        id: 'heart',
        system: 'cardiovascular',
        region: 'thorax',
        paired: false,
        kind: 'organ',
        tissue: 'organ',
        names: { common: 'Heart', synonyms: [] },
        featured: false,
      },
      {
        id: 'spinal-dura',
        system: 'nervous',
        region: 'back',
        paired: false,
        kind: 'organ',
        tissue: 'organ',
        names: { common: 'Spinal dura', synonyms: [] },
        featured: false,
      },
      {
        id: 'stomach',
        system: 'digestive',
        region: 'abdomen',
        paired: false,
        kind: 'organ',
        tissue: 'organ',
        names: { common: 'Stomach', synonyms: [] },
        featured: false,
      },
    ],
  };

  return makeStore({
    assets: { manifest, boot: 'ready', bundles, requested: [] },
    content: { taxonomy, index, structures: {} },
  });
}

it('builds Phase 1 rows in taxonomy order', () => {
  const store = makeFixtureState();
  const rows = selectToggleRows(store.getState());
  expect(rows.map((r) => r.id)).toEqual([
    'skeletal',
    'muscular',
    'cardiovascular',
    'major-organs',
  ]);
  const organsRow = rows.find((r) => r.id === 'major-organs')!;
  expect(organsRow.label).toBe('Major Organs');
  expect(organsRow.color).toBe('#E5C34B');
  expect(organsRow.systems).toEqual(['nervous', 'digestive']);
});

it('reports mixed and aggregated status', () => {
  const store = makeFixtureState({
    skeletal: 'ready',
    muscular: 'ready',
    cardiovascular: 'idle',
    organs: 'loading',
  });
  store.dispatch(systemToggled('nervous'));

  let organsRow = selectToggleRows(store.getState()).find(
    (r) => r.id === 'major-organs',
  )!;
  expect(organsRow.on).toBe('mixed');
  expect(organsRow.status).toBe('loading');

  const errStore = makeFixtureState({
    skeletal: 'ready',
    muscular: 'ready',
    cardiovascular: 'idle',
    organs: 'error',
  });
  organsRow = selectToggleRows(errStore.getState()).find(
    (r) => r.id === 'major-organs',
  )!;
  expect(organsRow.status).toBe('error');
});
