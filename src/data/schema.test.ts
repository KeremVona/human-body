import taxonomy from '../../content/taxonomy.json';
import {
  DetailsSchema,
  IndexEntrySchema,
  ManifestSchema,
  TaxonomySchema,
} from './schema';

const bundle = {
  id: 'skeletal',
  file: 'skeletal.1a2b3c4d.glb',
  bytes: 10,
  sha256: 'a'.repeat(64),
  meshIds: ['femur--l'],
};
const mesh = {
  bundle: 'skeletal',
  bounds: { min: [0, 0, 0], max: [1, 1, 1] },
  triangles: 12,
  sizeClass: 'large',
};
const manifest = {
  version: 1,
  generatedAt: '2026-11-21T00:00:00Z',
  source: { name: 'Z-Anatomy', version: 'x', license: 'CC-BY-SA-4.0' },
  bundles: [bundle],
  meshes: { 'femur--l': mesh },
};

it('accepts a valid manifest', () => {
  expect(ManifestSchema.safeParse(manifest).success).toBe(true);
});

it('rejects bundle files that contain a path or lack a hash', () => {
  for (const file of [
    'models/skeletal.1a2b3c4d.glb',
    'skeletal.glb',
    'skeletal.1A2B3C4D.glb',
  ]) {
    expect(
      ManifestSchema.safeParse({ ...manifest, bundles: [{ ...bundle, file }] })
        .success,
    ).toBe(false);
  }
});

it('rejects invalid mesh ids as manifest keys', () => {
  expect(
    ManifestSchema.safeParse({ ...manifest, meshes: { 'Femur.l': mesh } })
      .success,
  ).toBe(false);
});

it('rejects an unknown tissue', () => {
  const entry = {
    id: 'femur',
    system: 'skeletal',
    region: 'lower-limb',
    paired: true,
    kind: 'bone',
    tissue: 'wood',
    names: { common: 'Femur', synonyms: [] },
    featured: false,
  };
  expect(IndexEntrySchema.safeParse(entry).success).toBe(false);
  expect(IndexEntrySchema.safeParse({ ...entry, tissue: 'bone' }).success).toBe(
    true,
  );
});

it('requires all five muscle detail fields', () => {
  expect(
    DetailsSchema.safeParse({
      kind: 'muscle',
      origin: 'a',
      insertion: 'b',
      innervation: 'c',
      action: 'e',
    }).success,
  ).toBe(false);
});

it('ships a valid taxonomy with nine systems and the Major Organs group', () => {
  const t = TaxonomySchema.parse(taxonomy);
  expect(t.systems).toHaveLength(9);
  const organs = t.uiGroups.find((g) => g.id === 'major-organs')!;
  expect(organs.label).toBe('Major Organs');
  expect(organs.systems).toEqual([
    'nervous',
    'respiratory',
    'digestive',
    'urinary',
    'lymphatic',
  ]);
});
