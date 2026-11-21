import { PipelineConfigSchema, type PipelineConfig } from './config';
import { resolvePlan } from './resolvePlan';
import type { Inventory } from './types';

function makeConfig(
  rules: Array<{
    region?: PipelineConfig['bundles'][number]['rules'][number]['region'];
    name?: string;
  }> = [{ region: 'lower-limb' }],
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
          system: 'skeletal',
          region: r.region ?? 'lower-limb',
          kind: 'bone',
          tissue: 'bone',
          match: {
            collection: 'Skeletal',
            ...(r.name ? { name: r.name } : {}),
          },
        })),
      },
    ],
  });
}

function makeInventory(names: string[]): Inventory {
  return {
    blenderVersion: '5.3.0',
    sourceFile: 'Z-Anatomy.blend',
    objects: names.map((name) => ({
      name,
      type: 'MESH',
      collections: ['Skeletal'],
      vertices: 100,
      hasUV: false,
    })),
  };
}

const baseNames = ['Sternum', 'Femur.r', 'Femur.l'];
const baseMap = {
  'Femur.l': 'femur--l',
  'Femur.r': 'femur--r',
  Sternum: 'sternum',
};

it('groups selected objects into bundles sorted by mesh id', () => {
  const { plan, problems } = resolvePlan(
    makeConfig(),
    makeInventory(baseNames),
    baseMap,
  );
  expect(problems).toEqual([]);
  expect(plan.bundles[0].objects).toEqual([
    { source: 'Femur.l', meshId: 'femur--l' },
    { source: 'Femur.r', meshId: 'femur--r' },
    { source: 'Sternum', meshId: 'sternum' },
  ]);
});

it('derives one paired stub per structure', () => {
  const { stubs, problems } = resolvePlan(
    makeConfig(),
    makeInventory(baseNames),
    baseMap,
  );
  expect(problems).toEqual([]);
  const femur = stubs.find((s) => s.id === 'femur');
  expect(femur).toEqual({
    id: 'femur',
    displayName: 'Femur',
    system: 'skeletal',
    region: 'lower-limb',
    kind: 'bone',
    tissue: 'bone',
    paired: true,
    meshIds: ['femur--l', 'femur--r'],
  });
  const sternum = stubs.find((s) => s.id === 'sternum');
  expect(sternum?.paired).toBe(false);
});

it('reports a selected object missing from the name-map', () => {
  const { problems } = resolvePlan(
    makeConfig(),
    makeInventory([...baseNames, 'Patella.l']),
    baseMap,
  );
  expect(problems).toContain(
    'name-map: no id for "Patella.l" (run npm run assets:namemap)',
  );
});

it('rejects two sources mapping to one mesh id', () => {
  const { problems } = resolvePlan(
    makeConfig(),
    makeInventory(['Femur.l', 'Femur.l.001']),
    { 'Femur.l': 'femur--l', 'Femur.l.001': 'femur--l' },
  );
  expect(problems).toContain(
    'name-map: "Femur.l" and "Femur.l.001" both map to "femur--l"',
  );
});

it('reports meshes of one structure that disagree', () => {
  const config = makeConfig([
    { name: '\\.l$', region: 'lower-limb' },
    { name: '\\.r$', region: 'pelvis' },
  ]);
  const { problems } = resolvePlan(
    config,
    makeInventory(['Femur.l', 'Femur.r']),
    { 'Femur.l': 'femur--l', 'Femur.r': 'femur--r' },
  );
  expect(problems).toContain(
    'structure "femur": meshes disagree on region (lower-limb vs pelvis)',
  );
});

it('copies origin and orientation settings', () => {
  const { plan } = resolvePlan(makeConfig(), makeInventory(baseNames), baseMap);
  expect(plan.originBundle).toBe('skeletal');
  expect(plan.rotateZDeg).toBe(0);
  expect(plan.scale).toBe(1);
});
