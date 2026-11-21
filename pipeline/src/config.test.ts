import { PipelineConfigSchema } from './config';

const minimalConfig = {
  source: {
    file: 'pipeline/source/Z-Anatomy.blend',
    name: 'Z-Anatomy',
    version: '2023-05-02',
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
      rules: [],
    },
  ],
};

it('fills defaults', () => {
  const c = PipelineConfigSchema.parse(minimalConfig);
  expect(c.originBundle).toBe('skeletal');
  expect(c.orientation).toMatchObject({ rotateZDeg: 0, scale: 1 });
  expect(c.simplify).toEqual({ ratio: 1, error: 0.001 });
});

it('rejects an originBundle that is not a bundle', () => {
  expect(
    PipelineConfigSchema.safeParse({
      ...minimalConfig,
      originBundle: 'organs',
    }).success,
  ).toBe(false);
});

it('defaults rule types to MESH and accepts CURVE', () => {
  const c = PipelineConfigSchema.parse({
    ...minimalConfig,
    bundles: [
      {
        id: 'skeletal',
        rules: [
          {
            system: 'skeletal',
            region: 'head',
            kind: 'bone',
            tissue: 'bone',
            match: { collection: 'Bones' },
          },
          {
            system: 'cardiovascular',
            region: 'thorax',
            kind: 'vessel',
            tissue: 'artery',
            types: ['MESH', 'CURVE'],
            match: { collection: 'Arteries' },
          },
        ],
      },
    ],
  });
  expect(c.bundles[0].rules[0].types).toEqual(['MESH']);
  expect(c.bundles[0].rules[1].types).toEqual(['MESH', 'CURVE']);
});
