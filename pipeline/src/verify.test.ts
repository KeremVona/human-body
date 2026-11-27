import type { Manifest } from '../../src/data/schema';
import { PipelineConfigSchema, type PipelineConfig } from './config';
import { verifyManifest } from './verify';

type Tweak = {
  skeletalBytes?: number;
  badHash?: boolean;
  missingFile?: boolean;
  skullY?: number;
  sternumZ?: number;
  femurLX?: number;
  height?: number;
};

function boxBounds(cx: number, cy: number, cz: number, halfY = 0.05) {
  return {
    min: [cx - 0.05, cy - halfY, cz - 0.05] as [number, number, number],
    max: [cx + 0.05, cy + halfY, cz + 0.05] as [number, number, number],
  };
}

function fixture(
  tweak: Tweak,
): [
  Manifest,
  PipelineConfig,
  Record<string, { bytes: number; sha256: string } | undefined>,
] {
  const bytes = tweak.skeletalBytes ?? 1_000_000;
  const sha = 'a'.repeat(64);
  const file = 'skeletal.1a2b3c4d.glb';
  const height = tweak.height ?? 1.7;
  const skullY = tweak.skullY ?? height - 0.9;
  const femurY = -0.2;

  const config = PipelineConfigSchema.parse({
    source: {
      file: 'pipeline/source/Z-Anatomy.blend',
      name: 'Z-Anatomy',
      version: '1.0',
      license: 'CC-BY-SA-4.0',
    },
    orientation: {
      checks: {
        above: [['skull', 'femur--l']],
        anterior: [['sternum', 'vertebra-t6']],
        leftSide: ['femur--l'],
      },
    },
    budgets: {
      perBundleBytes: { skeletal: 5_242_880 },
      defaultBundleBytes: 15_728_640,
      totalBytes: 41_943_040,
    },
    bundles: [{ id: 'skeletal', rules: [] }],
  });

  const manifest: Manifest = {
    version: 1,
    generatedAt: '2026-11-21T00:00:00Z',
    source: { name: 'Z-Anatomy', version: '1.0', license: 'CC-BY-SA-4.0' },
    bundles: [
      {
        id: 'skeletal',
        file,
        bytes,
        sha256: sha,
        meshIds: ['femur--l', 'skull', 'sternum', 'vertebra-t6'],
      },
    ],
    meshes: {
      skull: {
        bundle: 'skeletal',
        bounds: boxBounds(0, skullY, 0.05),
        triangles: 12,
        sizeClass: 'large',
      },
      'femur--l': {
        bundle: 'skeletal',
        bounds: boxBounds(tweak.femurLX ?? 0.1, femurY, 0, 0.65),
        triangles: 12,
        sizeClass: 'large',
      },
      sternum: {
        bundle: 'skeletal',
        bounds: boxBounds(0, 0.3, tweak.sternumZ ?? 0.1),
        triangles: 12,
        sizeClass: 'medium',
      },
      'vertebra-t6': {
        bundle: 'skeletal',
        bounds: boxBounds(0, 0.3, -0.05),
        triangles: 12,
        sizeClass: 'small',
      },
    },
  };

  const files: Record<string, { bytes: number; sha256: string } | undefined> =
    tweak.missingFile
      ? {}
      : {
          [file]: {
            bytes,
            sha256: tweak.badHash ? 'b'.repeat(64) : sha,
          },
        };

  return [manifest, config, files];
}

it.each([
  [
    'over budget',
    { skeletalBytes: 6_000_000 },
    'bundle "skeletal" is 6000000 bytes, over its 5242880-byte budget',
  ],
  [
    'hash mismatch',
    { badHash: true },
    'bundle "skeletal": file hash does not match manifest',
  ],
  [
    'missing file',
    { missingFile: true },
    'bundle "skeletal": file skeletal.1a2b3c4d.glb not found',
  ],
  [
    'upside down',
    { skullY: -0.7 },
    'orientation: "skull" should be above "femur--l"',
  ],
  [
    'facing backwards',
    { sternumZ: -0.1 },
    'orientation: "sternum" should be anterior to "vertebra-t6"',
  ],
  [
    'mirrored',
    { femurLX: -0.1 },
    'orientation: "femur--l" should be on +X (patient left)',
  ],
  [
    'wrong units',
    { height: 17 },
    'body height 17.00 is outside 1.4–2.2 (check orientation.scale)',
  ],
])('reports %s', (_, tweak, message) => {
  expect(verifyManifest(...fixture(tweak))).toContain(message);
});

it('reports a stray glb file in models directory', () => {
  const [manifest, config, files] = fixture({});
  files['skeletal.deadbeef.glb'] = { bytes: 100, sha256: 'c'.repeat(64) };
  expect(verifyManifest(manifest, config, files)).toContain(
    'stray unreferenced glb file "skeletal.deadbeef.glb" in models directory',
  );
});

it('reports an empty origin bundle', () => {
  const [manifest, config, files] = fixture({});
  manifest.bundles[0].meshIds = [];
  manifest.meshes = {};
  expect(verifyManifest(manifest, config, files)).toContain(
    'orientation: origin bundle "skeletal" has no meshes',
  );
});

it('passes a good manifest', () => {
  expect(verifyManifest(...fixture({}))).toEqual([]);
});

it('verifies preview byte budget and bounds against skeletal bundle', () => {
  const [manifest, config, files] = fixture({});
  const previewFile = 'skeletal-preview.12345678.glb';
  const previewSha = 'c'.repeat(64);
  manifest.preview = {
    file: previewFile,
    bytes: 700_000,
    sha256: previewSha,
    bounds: {
      min: [-0.05, -0.85, -0.1],
      max: [0.15, 0.85, 0.15],
    },
  };
  files[previewFile] = { bytes: 700_000, sha256: previewSha };

  expect(verifyManifest(manifest, config, files)).toContain(
    'preview is 700000 bytes, over its 600000-byte budget',
  );

  manifest.preview.bytes = 400_000;
  files[previewFile] = { bytes: 400_000, sha256: previewSha };
  manifest.preview.bounds = {
    min: [-0.05, -0.8, -0.1], // offset by 0.05m on minY
    max: [0.15, 0.85, 0.15],
  };
  const errs = verifyManifest(manifest, config, files);
  expect(errs.some((e) => e.startsWith('preview bounds differ from skeletal bounds by '))).toBe(true);
});

it('verifies centerlines file existence, hash, byte budget, and stray files', () => {
  const [manifest, config, files] = fixture({});
  const lineFile = 'centerlines.11223344.json';
  const lineSha = 'd'.repeat(64);
  const centerlines = {
    file: lineFile,
    bytes: 65_000,
    sha256: lineSha,
  };
  manifest.centerlines = centerlines;
  files[lineFile] = { bytes: 65_000, sha256: lineSha };

  expect(verifyManifest(manifest, config, files)).toContain(
    'centerlines is 65000 bytes, over its 60,000-byte budget',
  );

  centerlines.bytes = 40_000;
  files[lineFile] = { bytes: 40_000, sha256: lineSha };
  files['centerlines.deadbeef.json'] = { bytes: 100, sha256: 'e'.repeat(64) };
  expect(verifyManifest(manifest, config, files)).toContain(
    'stray unreferenced centerlines file "centerlines.deadbeef.json" in models directory',
  );

  delete files['centerlines.deadbeef.json'];
  delete files[lineFile];
  expect(verifyManifest(manifest, config, files)).toContain(
    `centerlines: file ${lineFile} not found`,
  );
});
