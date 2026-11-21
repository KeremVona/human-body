import { PipelineConfigSchema, type PipelineConfig } from './config';
import { selectObjects } from './select';
import type { InventoryObject } from './types';

function obj(
  name: string,
  collections: string[],
  type = 'MESH',
): InventoryObject {
  return { name, type, collections, vertices: 100, hasUV: false };
}

function cfg(
  rules: Array<{
    system?: PipelineConfig['bundles'][number]['rules'][number]['system'];
    region?: PipelineConfig['bundles'][number]['rules'][number]['region'];
    kind?: PipelineConfig['bundles'][number]['rules'][number]['kind'];
    tissue?: PipelineConfig['bundles'][number]['rules'][number]['tissue'];
    match: { collection?: string; name?: string };
    exclude?: string[];
    types?: Array<'MESH' | 'CURVE'>;
  }>,
): PipelineConfig {
  return PipelineConfigSchema.parse({
    source: {
      file: 'pipeline/source/Z-Anatomy.blend',
      name: 'Z-Anatomy',
      version: '1.0',
      license: 'CC-BY-SA-4.0',
    },
    budgets: {
      perBundleBytes: { skeletal: 5_242_880 },
      defaultBundleBytes: 15_728_640,
      totalBytes: 41_943_040,
    },
    bundles: [
      {
        id: 'skeletal',
        rules: rules.map((r) => ({
          system: r.system ?? 'skeletal',
          region: r.region ?? 'lower-limb',
          kind: r.kind ?? 'bone',
          tissue: r.tissue ?? 'bone',
          match: r.match,
          exclude: r.exclude,
          types: r.types,
        })),
      },
    ],
  });
}

it('matches a collection on whole path segments only', () => {
  const objs = [
    obj('A', ['Skeletal system/Lower limb/Femur']),
    obj('B', ['Skeletal system/Lower limb']),
    obj('C', ['Skeletal system/Lower limbs']),
  ];
  expect(
    selectObjects(
      cfg([{ match: { collection: 'Skeletal system/Lower limb' } }]),
      objs,
    ).selected.map((s) => s.object.name),
  ).toEqual(['A', 'B']);
});

it('applies name regex and exclude, skips non-mesh, first rule wins', () => {
  const objs = [
    obj('Femur.l', ['S']),
    obj('Femur label', ['S']),
    obj('Rib 2', ['S']),
    obj('Rib 1', ['S'], 'FONT'),
  ];
  const r = selectObjects(
    cfg([
      { match: { collection: 'S' }, exclude: ['label$'], region: 'lower-limb' },
      { match: { collection: 'S', name: '^rib' }, region: 'thorax' },
    ]),
    objs,
  );
  // 'Rib 2' matches both rules; the first one wins
  expect(r.selected.map((s) => [s.object.name, s.rule.region])).toEqual([
    ['Femur.l', 'lower-limb'],
    ['Rib 2', 'lower-limb'],
  ]);
  expect(r.unmatched).toBe(1);
});

it('skips CURVE objects by default and selects them only when rule types includes CURVE', () => {
  const objs = [
    obj('Femur.l', ['Vessels'], 'MESH'),
    obj('Abdominal aorta', ['Vessels'], 'CURVE'),
    obj('Aorta.t', ['Vessels'], 'FONT'),
  ];
  expect(
    selectObjects(
      cfg([{ match: { collection: 'Vessels' } }]),
      objs,
    ).selected.map((s) => s.object.name),
  ).toEqual(['Femur.l']);
  expect(
    selectObjects(
      cfg([{ match: { collection: 'Vessels' }, types: ['MESH', 'CURVE'] }]),
      objs,
    ).selected.map((s) => s.object.name),
  ).toEqual(['Femur.l', 'Abdominal aorta']);
});
