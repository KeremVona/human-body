import taxonomy from '../../content/taxonomy.json';
import { checkContent } from './checkContent';

function makeFixture() {
  const manifest = {
    version: 1 as const,
    generatedAt: '2026-11-21T00:00:00Z',
    source: { name: 'Z-Anatomy', version: '1.0', license: 'CC-BY-SA-4.0' },
    bundles: [
      {
        id: 'skeletal',
        file: 'skeletal.1a2b3c4d.glb',
        bytes: 1024,
        sha256: 'a'.repeat(64),
        meshIds: ['femur--l', 'femur--r', 'sternum'],
      },
    ],
    meshes: {
      'femur--l': {
        bundle: 'skeletal',
        bounds: { min: [0, 0, 0], max: [0.1, 0.4, 0.1] },
        triangles: 100,
        sizeClass: 'large',
      },
      'femur--r': {
        bundle: 'skeletal',
        bounds: { min: [-0.1, 0, 0], max: [0, 0.4, 0.1] },
        triangles: 100,
        sizeClass: 'large',
      },
      sternum: {
        bundle: 'skeletal',
        bounds: { min: [-0.05, 0.3, 0], max: [0.05, 0.5, 0.05] },
        triangles: 80,
        sizeClass: 'medium',
      },
    } as Record<string, unknown>,
  };

  const femur = {
    id: 'femur',
    system: 'skeletal',
    region: 'lower-limb',
    paired: true,
    kind: 'bone',
    tissue: 'bone',
    names: { common: 'Femur', latin: 'Os femoris', synonyms: [] },
    featured: true,
  };

  const sternum = {
    id: 'sternum',
    system: 'skeletal',
    region: 'thorax',
    paired: false,
    kind: 'bone',
    tissue: 'bone',
    names: { common: 'Sternum', synonyms: [] },
    featured: false,
  };

  const index = {
    locale: 'en',
    structures: [femur, sternum],
  };

  const source = {
    title: 'OpenStax Anatomy and Physiology 2e',
    url: 'https://openstax.org/books/anatomy-and-physiology-2e',
    license: 'CC-BY-4.0',
  };

  const structureFiles: Record<string, unknown> = {
    'structures/skeletal.json': {
      system: 'skeletal',
      entries: [
        {
          id: 'femur',
          overview: 'The longest bone in the human body.',
          details: {
            kind: 'bone',
            boneType: 'long',
            articulatesWith: [],
          },
          sources: [source],
        },
      ],
    },
  };

  return { manifest, taxonomy, index, structureFiles, femur, sternum, source };
}

it('passes on consistent content', () => {
  const { manifest, taxonomy: tax, index, structureFiles } = makeFixture();
  expect(
    checkContent({ manifest, taxonomy: tax, index, structureFiles }),
  ).toEqual({
    errors: [],
    warnings: [],
  });
});

it('reports duplicate index ids', () => {
  const {
    manifest,
    taxonomy: tax,
    index,
    structureFiles,
    femur,
  } = makeFixture();
  index.structures.push({ ...femur });
  const report = checkContent({
    manifest,
    taxonomy: tax,
    index,
    structureFiles,
  });
  expect(report.errors).toContain('index.json: duplicate structure id "femur"');
});

it('reports a mesh with no structure', () => {
  const { manifest, taxonomy: tax, index, structureFiles } = makeFixture();
  manifest.meshes['tibia--l'] = manifest.meshes['femur--l'];
  manifest.bundles[0].meshIds.push('tibia--l');
  const report = checkContent({
    manifest,
    taxonomy: tax,
    index,
    structureFiles,
  });
  expect(report.errors).toContain(
    'manifest: mesh "tibia--l" has no structure "tibia" in index.json',
  );
});

it('warns on a structure with no meshes', () => {
  const {
    manifest,
    taxonomy: tax,
    index,
    structureFiles,
    sternum,
  } = makeFixture();
  index.structures.push({
    ...sternum,
    id: 'patella',
    region: 'lower-limb',
    names: { common: 'Patella', synonyms: [] },
  });
  const report = checkContent({
    manifest,
    taxonomy: tax,
    index,
    structureFiles,
  });
  expect(report.errors).toEqual([]);
  expect(report.warnings).toContain(
    'index.json: structure "patella" has no meshes in manifest',
  );
});

it('reports unknown region', () => {
  const { manifest, taxonomy: tax, index, structureFiles } = makeFixture();
  index.structures[0].region = 'leg';
  const report = checkContent({
    manifest,
    taxonomy: tax,
    index,
    structureFiles,
  });
  expect(report.errors.some((e) => e.startsWith('index.json:'))).toBe(true);
});

it('reports a sided mesh on an unpaired structure', () => {
  const { manifest, taxonomy: tax, index, structureFiles } = makeFixture();
  index.structures[0].paired = false;
  const report = checkContent({
    manifest,
    taxonomy: tax,
    index,
    structureFiles,
  });
  expect(report.errors).toContain(
    'manifest: mesh "femur--l" has a side but structure "femur" is not paired',
  );
});

it('reports an unsided mesh on a paired structure', () => {
  const { manifest, taxonomy: tax, index, structureFiles } = makeFixture();
  index.structures[1].paired = true;
  const report = checkContent({
    manifest,
    taxonomy: tax,
    index,
    structureFiles,
  });
  expect(report.errors).toContain(
    'manifest: mesh "sternum" has no side but structure "sternum" is paired',
  );
});

it('warns on a missing side', () => {
  const { manifest, taxonomy: tax, index, structureFiles } = makeFixture();
  delete manifest.meshes['femur--r'];
  manifest.bundles[0].meshIds = ['femur--l', 'sternum'];
  const report = checkContent({
    manifest,
    taxonomy: tax,
    index,
    structureFiles,
  });
  expect(report.errors).toEqual([]);
  expect(report.warnings).toContain(
    'manifest: paired structure "femur" has no right mesh',
  );
});

it('reports details for an unknown id', () => {
  const {
    manifest,
    taxonomy: tax,
    index,
    structureFiles,
    source,
  } = makeFixture();
  structureFiles['structures/skeletal.json'] = {
    system: 'skeletal',
    entries: [{ id: 'humerus', sources: [source] }],
  };
  const report = checkContent({
    manifest,
    taxonomy: tax,
    index,
    structureFiles,
  });
  expect(report.errors).toContain(
    'structures/skeletal.json: "humerus" is not in index.json',
  );
});

it('reports details in the wrong system file', () => {
  const {
    manifest,
    taxonomy: tax,
    index,
    structureFiles,
    source,
  } = makeFixture();
  structureFiles['structures/muscular.json'] = {
    system: 'muscular',
    entries: [{ id: 'femur', sources: [source] }],
  };
  const report = checkContent({
    manifest,
    taxonomy: tax,
    index,
    structureFiles,
  });
  expect(report.errors).toContain(
    'structures/muscular.json: "femur" belongs to system "skeletal"',
  );
});

it('reports details whose kind disagrees', () => {
  const {
    manifest,
    taxonomy: tax,
    index,
    structureFiles,
    source,
  } = makeFixture();
  structureFiles['structures/skeletal.json'] = {
    system: 'skeletal',
    entries: [
      {
        id: 'femur',
        details: {
          kind: 'muscle',
          origin: 'a',
          insertion: 'b',
          innervation: 'c',
          bloodSupply: 'd',
          action: 'e',
        },
        sources: [source],
      },
    ],
  };
  const report = checkContent({
    manifest,
    taxonomy: tax,
    index,
    structureFiles,
  });
  expect(report.errors).toContain(
    'structures/skeletal.json: "femur" has muscle details but kind "bone"',
  );
});

it('accepts facts details for non-muscle/non-bone kinds and rejects mismatched details', () => {
  const {
    manifest,
    taxonomy: tax,
    index,
    structureFiles,
    source,
  } = makeFixture();
  manifest.meshes['heart'] = manifest.meshes['sternum'];
  manifest.bundles[0].meshIds.push('heart');
  index.structures.push({
    id: 'heart',
    system: 'cardiovascular',
    region: 'thorax',
    paired: false,
    kind: 'organ',
    tissue: 'organ',
    names: { common: 'Heart', synonyms: [] },
    featured: true,
  });
  structureFiles['structures/cardiovascular.json'] = {
    system: 'cardiovascular',
    entries: [
      {
        id: 'heart',
        details: { kind: 'facts', facts: ['Pumps blood through the body.'] },
        sources: [source],
      },
    ],
  };
  expect(
    checkContent({ manifest, taxonomy: tax, index, structureFiles }),
  ).toEqual({ errors: [], warnings: [] });

  structureFiles['structures/cardiovascular.json'] = {
    system: 'cardiovascular',
    entries: [
      {
        id: 'heart',
        details: { kind: 'bone', boneType: 'flat', articulatesWith: [] },
        sources: [source],
      },
    ],
  };
  expect(
    checkContent({ manifest, taxonomy: tax, index, structureFiles }).errors,
  ).toContain(
    'structures/cardiovascular.json: "heart" has bone details but kind "organ"',
  );
});

it('reports bundle.meshIds and manifest.meshes mismatches', () => {
  const missingMesh = makeFixture();
  missingMesh.manifest.bundles[0].meshIds.push('humerus--l');
  expect(
    checkContent({
      manifest: missingMesh.manifest,
      taxonomy: missingMesh.taxonomy,
      index: missingMesh.index,
      structureFiles: missingMesh.structureFiles,
    }).errors,
  ).toContain(
    'manifest: bundle "skeletal" references missing mesh "humerus--l"',
  );

  const unlistedMesh = makeFixture();
  unlistedMesh.manifest.bundles[0].meshIds = ['femur--l', 'femur--r'];
  expect(
    checkContent({
      manifest: unlistedMesh.manifest,
      taxonomy: unlistedMesh.taxonomy,
      index: unlistedMesh.index,
      structureFiles: unlistedMesh.structureFiles,
    }).errors,
  ).toContain(
    'manifest: mesh "sternum" is not listed in bundle "skeletal" meshIds',
  );

  const mismatchedBundle = makeFixture();
  mismatchedBundle.manifest.meshes['sternum'] = {
    ...(mismatchedBundle.manifest.meshes['sternum'] as Record<string, unknown>),
    bundle: 'muscular',
  };
  expect(
    checkContent({
      manifest: mismatchedBundle.manifest,
      taxonomy: mismatchedBundle.taxonomy,
      index: mismatchedBundle.index,
      structureFiles: mismatchedBundle.structureFiles,
    }).errors,
  ).toContain(
    'manifest: mesh "sternum" lists bundle "muscular" but appears in bundle "skeletal"',
  );
});
