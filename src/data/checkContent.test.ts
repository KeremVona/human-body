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
    names: {
      common: 'Femur',
      latin: 'Os femoris',
      synonyms: [] as string[],
    } as { common: string; latin?: string; synonyms: string[] },
    featured: true,
  };

  const sternum = {
    id: 'sternum',
    system: 'skeletal',
    region: 'thorax',
    paired: false,
    kind: 'bone',
    tissue: 'bone',
    names: { common: 'Sternum', synonyms: [] as string[] } as {
      common: string;
      latin?: string;
      synonyms: string[];
    },
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
          function:
            'Supports body weight during standing, walking, and running.',
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

it('passes without errors on consistent content', () => {
  const { manifest, taxonomy: tax, index, structureFiles } = makeFixture();
  const report = checkContent({
    manifest,
    taxonomy: tax,
    index,
    structureFiles,
  });
  expect(report.errors).toEqual([]);
  expect(report.warnings).toEqual([
    'index.json: 1 featured structures (target 125)',
  ]);
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
    featured: false,
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
    checkContent({ manifest, taxonomy: tax, index, structureFiles }).errors,
  ).toEqual([]);

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

it('featured content passes when complete', () => {
  const { manifest, taxonomy: tax, index, structureFiles } = makeFixture();
  const report = checkContent({
    manifest,
    taxonomy: tax,
    index,
    structureFiles,
  });
  expect(report.errors).toEqual([]);
});

it('featured needs a Latin name', () => {
  const { manifest, taxonomy: tax, index, structureFiles } = makeFixture();
  delete (index.structures[0].names as { latin?: string }).latin;
  const report = checkContent({
    manifest,
    taxonomy: tax,
    index,
    structureFiles,
  });
  expect(report.errors).toContain(
    'index.json: featured "femur" has no Latin name',
  );
});

it('featured needs an entry', () => {
  const { manifest, taxonomy: tax, index, structureFiles } = makeFixture();
  (
    structureFiles['structures/skeletal.json'] as { entries: unknown[] }
  ).entries = [];
  const report = checkContent({
    manifest,
    taxonomy: tax,
    index,
    structureFiles,
  });
  expect(report.errors).toContain(
    'index.json: featured "femur" has no entry in structures/skeletal.json',
  );
});

it('featured needs overview and function', () => {
  const { manifest, taxonomy: tax, index, structureFiles } = makeFixture();
  const file = structureFiles['structures/skeletal.json'] as {
    entries: Array<{ overview?: string; function?: string }>;
  };
  delete file.entries[0].overview;
  delete file.entries[0].function;
  const report = checkContent({
    manifest,
    taxonomy: tax,
    index,
    structureFiles,
  });
  expect(report.errors).toContain(
    'structures/skeletal.json: featured "femur" is missing overview',
  );
  expect(report.errors).toContain(
    'structures/skeletal.json: featured "femur" is missing function',
  );
});

it('featured needs a non-Z-Anatomy source', () => {
  const { manifest, taxonomy: tax, index, structureFiles } = makeFixture();
  const file = structureFiles['structures/skeletal.json'] as {
    entries: Array<{ sources: unknown[] }>;
  };
  file.entries[0].sources = [
    {
      title: 'Z-Anatomy',
      url: 'https://github.com/LluisV/Z-Anatomy',
      license: 'CC-BY-SA-4.0',
    },
  ];
  const report = checkContent({
    manifest,
    taxonomy: tax,
    index,
    structureFiles,
  });
  expect(report.errors).toContain(
    'structures/skeletal.json: featured "femur" needs a source other than Z-Anatomy',
  );
});

it('featured bone needs bone details and featured muscle needs muscle details', () => {
  const { manifest, taxonomy: tax, index, structureFiles } = makeFixture();
  const file = structureFiles['structures/skeletal.json'] as {
    entries: Array<{ details?: unknown }>;
  };
  delete file.entries[0].details;
  const boneReport = checkContent({
    manifest,
    taxonomy: tax,
    index,
    structureFiles,
  });
  expect(boneReport.errors).toContain(
    'structures/skeletal.json: featured bone "femur" has no bone details',
  );

  const muscleCase = makeFixture();
  muscleCase.manifest.meshes['biceps--l'] =
    muscleCase.manifest.meshes['femur--l'];
  muscleCase.manifest.bundles[0].meshIds.push('biceps--l');
  muscleCase.index.structures.push({
    id: 'biceps',
    system: 'muscular',
    region: 'upper-limb',
    paired: true,
    kind: 'muscle',
    tissue: 'muscle',
    names: {
      common: 'Biceps brachii',
      latin: 'Musculus biceps brachii',
      synonyms: [],
    },
    featured: true,
  });
  muscleCase.manifest.meshes['biceps--l'] = {
    bundle: 'skeletal',
    bounds: { min: [0, 0, 0], max: [0.1, 0.2, 0.1] },
    triangles: 10,
    sizeClass: 'medium',
  };
  muscleCase.structureFiles['structures/muscular.json'] = {
    system: 'muscular',
    entries: [
      {
        id: 'biceps',
        overview: 'Muscle at the front of the upper arm.',
        function: 'Flexes the elbow and supinates the forearm.',
        sources: [muscleCase.source],
      },
    ],
  };
  const muscleReport = checkContent({
    manifest: muscleCase.manifest,
    taxonomy: muscleCase.taxonomy,
    index: muscleCase.index,
    structureFiles: muscleCase.structureFiles,
  });
  expect(muscleReport.errors).toContain(
    'structures/muscular.json: featured muscle "biceps" has no muscle details',
  );
});

it('enforces length limits', () => {
  const { manifest, taxonomy: tax, index, structureFiles } = makeFixture();
  const file = structureFiles['structures/skeletal.json'] as {
    entries: Array<{ overview?: string; function?: string }>;
  };
  file.entries[0].overview = 'x'.repeat(401);
  file.entries[0].function = 'y'.repeat(601);
  const report = checkContent({
    manifest,
    taxonomy: tax,
    index,
    structureFiles,
  });
  expect(report.errors).toContain(
    'structures/skeletal.json: "femur" overview is 401 characters (max 400)',
  );
  expect(report.errors).toContain(
    'structures/skeletal.json: "femur" function is 601 characters (max 600)',
  );
});

it('rejects markup in text fields', () => {
  for (const snippet of [
    'The <b>femur</b> bone.',
    '**long** bone.',
    'See [ref](https://x.y).',
  ]) {
    const { manifest, taxonomy: tax, index, structureFiles } = makeFixture();
    const file = structureFiles['structures/skeletal.json'] as {
      entries: Array<{ overview?: string }>;
    };
    file.entries[0].overview = snippet;
    const report = checkContent({
      manifest,
      taxonomy: tax,
      index,
      structureFiles,
    });
    expect(report.errors).toContain(
      'structures/skeletal.json: "femur" overview contains markup',
    );
  }
});

it('rejects unknown articulation ids', () => {
  const { manifest, taxonomy: tax, index, structureFiles } = makeFixture();
  const file = structureFiles['structures/skeletal.json'] as {
    entries: Array<{
      details: { kind: 'bone'; boneType: string; articulatesWith: string[] };
    }>;
  };
  file.entries[0].details.articulatesWith = ['tibiaa'];
  const report = checkContent({
    manifest,
    taxonomy: tax,
    index,
    structureFiles,
  });
  expect(report.errors).toContain(
    'structures/skeletal.json: "femur" articulates with unknown "tibiaa"',
  );
});

it('warns when featured count is off target', () => {
  const { manifest, taxonomy: tax, index, structureFiles } = makeFixture();
  const report = checkContent({
    manifest,
    taxonomy: tax,
    index,
    structureFiles,
  });
  expect(report.warnings).toContain(
    'index.json: 1 featured structures (target 125)',
  );
});

it('check:content reports unknown motion meshes and moving/ghost overlaps while staying backward compatible when omitted', () => {
  const { manifest, taxonomy: tax, index, structureFiles } = makeFixture();
  expect(
    checkContent({ manifest, taxonomy: tax, index, structureFiles }).errors,
  ).toEqual([]);

  const badUnknown = checkContent({
    manifest,
    taxonomy: tax,
    index,
    structureFiles,
    motions: {
      motions: [
        {
          id: 'elbow-flexion',
          kind: 'hinge',
          label: 'Elbow',
          view: 'left',
          systems: ['skeletal'],
          moving: ['gone--l'],
          ghost: ['femur--l'],
          agonists: { flex: [], extend: [] },
          pivot: { mesh: 'sternum', anchor: [0.5, 0.5, 0.5] },
          axis: [-1, 0, 0],
          range: [0, 145],
          periodS: 4,
        },
      ],
    },
  });
  expect(badUnknown.errors).toContain(
    'motions.json: "elbow-flexion" references unknown mesh "gone--l"',
  );

  const overlap = checkContent({
    manifest,
    taxonomy: tax,
    index,
    structureFiles,
    motions: {
      motions: [
        {
          id: 'elbow-flexion',
          kind: 'hinge',
          label: 'Elbow',
          view: 'left',
          systems: ['skeletal'],
          moving: ['femur--l'],
          ghost: ['femur--l'],
          agonists: { flex: [], extend: [] },
          pivot: { mesh: 'sternum', anchor: [0.5, 0.5, 0.5] },
          axis: [-1, 0, 0],
          range: [0, 145],
          periodS: 4,
        },
      ],
    },
  });
  expect(overlap.errors).toContain(
    'motions.json: "elbow-flexion" lists "femur--l" as both moving and ghost',
  );
});

it('validates non-en locale folders for unknown ids and mismatched systems while allowing missing translations', () => {
  const { manifest, taxonomy: tax, index, structureFiles } = makeFixture();
  const source = {
    title: 'OpenStax Anatomy and Physiology 2e',
    url: 'https://openstax.org/books/anatomy-and-physiology-2e',
    license: 'CC-BY-4.0',
  };

  const incomplete = checkContent({
    manifest,
    taxonomy: tax,
    index,
    structureFiles,
    locales: {
      tr: {
        index: { locale: 'tr', structures: [] },
        structureFiles: {},
      },
    },
  });
  expect(incomplete.errors).toEqual([]);

  const badLocale = checkContent({
    manifest,
    taxonomy: tax,
    index,
    structureFiles,
    locales: {
      tr: {
        index: {
          locale: 'tr',
          structures: [
            {
              id: 'nonexistent-bone',
              system: 'skeletal',
              region: 'thorax',
              paired: false,
              kind: 'bone',
              tissue: 'bone',
              names: { common: 'Yok Kemik', synonyms: [] },
              featured: false,
            },
          ],
        },
        structureFiles: {
          'structures/muscular.json': {
            system: 'muscular',
            entries: [
              {
                id: 'femur',
                overview: 'Yanlış sistemde.',
                sources: [source],
              },
            ],
          },
        },
      },
    },
  });
  expect(badLocale.errors).toContain(
    'content/tr/index.json: "nonexistent-bone" is not in content/en/index.json',
  );
  expect(badLocale.errors).toContain(
    'content/tr/structures/muscular.json: "femur" belongs to system "skeletal"',
  );
});

describe('checkContent tours validation', () => {
  function makeTourFixture() {
    const base = makeFixture();
    const motions = {
      motions: [
        {
          id: 'elbow-flexion',
          kind: 'hinge',
          label: 'Elbow flexion',
          view: 'left',
          systems: ['skeletal'],
          moving: ['femur--l'],
          ghost: [],
          agonists: { flex: [], extend: [] },
          pivot: { mesh: 'femur--l', anchor: [0.5, 0.5, 0.5] },
          axis: [1, 0, 0],
          range: [0, 90],
          periodS: 4,
        },
      ],
    };

    const stepView = {
      c: [0, 0, 2, 0, 0, 0],
      s: ['skeletal'],
      h: [],
      sel: ['femur--l'],
    };

    const tours = {
      tours: [
        {
          id: 'arm-bone-to-muscle',
          systems: ['skeletal'],
          steps: [
            { id: 'step-1', view: stepView },
            { id: 'step-2', view: { ...stepView, sel: ['femur--l'] } },
            {
              id: 'step-3',
              view: stepView,
              motion: { id: 'elbow-flexion', phase: 0.25 },
            },
            { id: 'step-4', view: stepView },
          ],
        },
      ],
    };

    const enTexts = {
      tours: {
        'arm-bone-to-muscle': {
          title: 'From bone to muscle',
          summary: 'Explore the bones and muscles of the arm.',
          steps: {
            'step-1': { title: 'Step one', body: 'Skeleton overview.' },
            'step-2': { title: 'Step two', body: 'Look at the femur.' },
            'step-3': { title: 'Step three', body: 'Elbow motion demo.' },
            'step-4': { title: 'Step four', body: 'Summary step.' },
          },
        },
      },
    };

    const trTexts = {
      tours: {
        'arm-bone-to-muscle': {
          title: 'Kemikten kasa',
          summary: 'Kol kemiklerini ve kaslarını keşfedin.',
          steps: {
            'step-1': { title: 'Birinci adım', body: 'İskelet genel görünümü.' },
            'step-2': { title: 'İkinci adım', body: 'Femura bakın.' },
            'step-3': { title: 'Üçüncü adım', body: 'Dirsek hareketi demosu.' },
          },
        },
      },
    };

    return {
      ...base,
      motions,
      tours,
      tourTexts: { en: enTexts, tr: trTexts },
    };
  }

  it('passes valid tours with partial non-English translations', () => {
    const f = makeTourFixture();
    const res = checkContent({
      manifest: f.manifest,
      taxonomy: f.taxonomy,
      index: f.index,
      structureFiles: f.structureFiles,
      motions: f.motions,
      tours: f.tours,
      tourTexts: f.tourTexts,
    });
    expect(res.errors).toEqual([]);
  });

  it('reports unknown mesh and unknown motion references', () => {
    const f = makeTourFixture();
    f.tours.tours[0].steps[1].view.sel = ['gone--l'];
    f.tours.tours[0].steps[2].motion = { id: 'jump', phase: 0.5 };
    const res = checkContent({
      manifest: f.manifest,
      taxonomy: f.taxonomy,
      index: f.index,
      structureFiles: f.structureFiles,
      motions: f.motions,
      tours: f.tours,
      tourTexts: f.tourTexts,
    });
    expect(res.errors).toContain(
      'tours.json: "arm-bone-to-muscle/step-2" references unknown mesh "gone--l"',
    );
    expect(res.errors).toContain(
      'tours.json: "arm-bone-to-muscle/step-3" references unknown motion "jump"',
    );
  });

  it('reports invalid step count outside 4-7', () => {
    const f = makeTourFixture();
    f.tours.tours[0].steps = f.tours.tours[0].steps.slice(0, 3);
    const res = checkContent({
      manifest: f.manifest,
      taxonomy: f.taxonomy,
      index: f.index,
      structureFiles: f.structureFiles,
      motions: f.motions,
      tours: f.tours,
      tourTexts: { en: f.tourTexts.en },
    });
    expect(res.errors).toContain(
      'tours.json: "arm-bone-to-muscle" has 3 steps (allowed 4–7)',
    );
  });

  it('requires English text for every tour and step', () => {
    const f = makeTourFixture();
    delete (
      f.tourTexts.en.tours['arm-bone-to-muscle'].steps['step-3'] as {
        body?: string;
      }
    ).body;
    const res = checkContent({
      manifest: f.manifest,
      taxonomy: f.taxonomy,
      index: f.index,
      structureFiles: f.structureFiles,
      motions: f.motions,
      tours: f.tours,
      tourTexts: f.tourTexts,
    });
    expect(res.errors).toContain(
      'content/en/tours.json: missing body for "arm-bone-to-muscle/step-3"',
    );
  });

  it('flags unknown tour or step ids in locale text and validates limits and markup', () => {
    const f = makeTourFixture();
    (f.tourTexts.tr.tours as Record<string, unknown>)['ghost-tour'] = {
      title: 'Hayalet tur',
    };
    f.tourTexts.tr.tours['arm-bone-to-muscle'].steps['step-1'].body =
      'x'.repeat(401);
    f.tourTexts.en.tours['arm-bone-to-muscle'].title = '**Bold** title';

    const res = checkContent({
      manifest: f.manifest,
      taxonomy: f.taxonomy,
      index: f.index,
      structureFiles: f.structureFiles,
      motions: f.motions,
      tours: f.tours,
      tourTexts: f.tourTexts,
    });

    expect(res.errors).toContain(
      'content/tr/tours.json: "ghost-tour" is not in tours.json',
    );
    expect(res.errors).toContain(
      'content/tr/tours.json: "arm-bone-to-muscle/step-1" body is 401 characters (max 400)',
    );
    expect(res.errors).toContain(
      'content/en/tours.json: "arm-bone-to-muscle" title contains markup',
    );
  });

  it('rejects pins (p) in a step view with tours.json schema error', () => {
    const f = makeTourFixture();
    (f.tours.tours[0].steps[0].view as Record<string, unknown>).p = [
      { m: 'femur--l', l: [0, 0, 0], t: 'Pin' },
    ];
    const res = checkContent({
      manifest: f.manifest,
      taxonomy: f.taxonomy,
      index: f.index,
      structureFiles: f.structureFiles,
      motions: f.motions,
      tours: f.tours,
      tourTexts: f.tourTexts,
    });
    expect(res.errors.some((e) => e.startsWith('tours.json:'))).toBe(true);
  });
});

describe('checkContent journeys validation', () => {
  function makeJourneyFixture() {
    const base = makeFixture();
    const motions = {
      motions: [
        {
          id: 'elbow-flexion',
          kind: 'hinge',
          label: 'Elbow flexion',
          view: 'left',
          systems: ['skeletal'],
          moving: ['femur--l'],
          ghost: [],
          agonists: { flex: [], extend: [] },
          pivot: { mesh: 'femur--l', anchor: [0.5, 0.5, 0.5] },
          axis: [1, 0, 0],
          range: [0, 90],
          periodS: 4,
        },
      ],
    };
    const manifest = {
      ...base.manifest,
      centerlines: {
        file: 'centerlines.1a2b3c4d.json',
        bytes: 120,
        sha256: 'c'.repeat(64),
      },
    };
    const centerlines = {
      version: 1,
      lines: {
        esophagus: [
          [0, 0.5, 0],
          [0, 0.3, 0],
        ],
      },
    };
    const journeys = {
      journeys: [
        {
          id: 'digestion',
          systems: ['skeletal'],
          meters: [
            { id: 'carbs', unit: '%', max: 100, decimals: 0, monotonic: true, secondary: 'absorbed' },
            { id: 'absorbed', unit: '%', max: 100, decimals: 0, monotonic: true },
          ],
          metersStart: { carbs: 0, absorbed: 0 },
          stages: [
            {
              id: 'mouth',
              durationS: 8,
              look: 'bolus',
              radius: 0.007,
              motion: 'none',
              organs: ['femur--l'],
              view: { c: [0, 0, 2, 0, 0, 0], s: ['skeletal'], h: [], sel: [] },
              path: [{ mesh: 'femur--l', anchor: [0.5, 0.5, 0.5] }],
              modelled: true,
              events: [{ at: 0.2, kind: 'secrete', mesh: 'femur--l', id: 'saliva' }],
              meters: { carbs: 5, absorbed: 0 },
            },
            {
              id: 'esophagus',
              durationS: 6,
              look: 'bolus',
              radius: 0.005,
              motion: 'squeeze',
              organs: ['sternum'],
              inside: ['sternum'],
              view: { c: [0, 0, 2, 0, 0, 0], s: ['skeletal'], h: [], sel: [] },
              path: [{ line: 'esophagus', from: 0, to: 1 }],
              modelled: true,
              meters: { carbs: 10, absorbed: 0 },
            },
          ],
        },
      ],
    };
    const journeyTexts = {
      en: {
        journeys: {
          digestion: {
            title: 'Follow a bite of food',
            summary: 'Trace one bite down the tract.',
            follow: 'Follow the food',
            inspectorLink: 'Watch food pass through here',
            metersTitle: "What's been digested",
            metersNote: 'Rounded teaching values',
            meters: {
              carbs: { label: 'Carbohydrates', value: '{v}% broken down, {s}% absorbed' },
              absorbed: { label: 'Absorbed', value: '{v}%' },
            },
            stages: {
              mouth: { title: 'Mouth', body: 'Chew and wet.' },
              esophagus: { title: 'Esophagus', body: 'Squeeze down.' },
            },
            events: { saliva: 'Saliva' },
          },
        },
      },
      tr: {
        journeys: {
          digestion: {
            title: 'Bir lokmanın yolculuğu',
            summary: 'Bir lokmayı yol boyunca izleyin.',
            follow: 'Yiyeceği takip et',
            inspectorLink: 'Yiyeceğin buradan geçişini izle',
            metersTitle: 'Neler sindirildi',
            metersNote: 'Yuvarlanmış öğretici değerler',
            meters: {
              carbs: { label: 'Karbonhidratlar', value: '%{v} parçalandı, %{s} emildi' },
              absorbed: { label: 'Emildi', value: '%{v}' },
            },
            stages: {
              mouth: { title: 'Ağız', body: 'Çiğneme.' },
              esophagus: { title: 'Yemek borusu', body: 'Aşağı iniş.' },
            },
            events: { saliva: 'Tükürük' },
          },
        },
      },
    };
    return { ...base, manifest, centerlines, motions, journeys, journeyTexts };
  }

  it('passes on a valid journey + centerlines + localized texts', () => {
    const f = makeJourneyFixture();
    const res = checkContent({
      manifest: f.manifest,
      taxonomy: f.taxonomy,
      index: f.index,
      structureFiles: f.structureFiles,
      motions: f.motions,
      centerlines: f.centerlines,
      journeys: f.journeys,
      journeyTexts: f.journeyTexts,
    });
    expect(res.errors).toEqual([]);
  });

  it('flags missing centerlines, unknown mesh/line ids, decreasing monotonic meters, missing en labels, and over-limit text', () => {
    const f = makeJourneyFixture();
    f.journeys.journeys[0].stages[0].organs = ['no-such-organ'];
    f.journeys.journeys[0].stages[1].path = [
      { line: 'missing-line', from: 0, to: 1 },
    ];
    f.journeys.journeys[0].stages[1].meters.carbs = 2; // decreased from 5 -> 2
    delete (f.journeyTexts.en.journeys.digestion.events as Record<string, string>).saliva;
    f.journeyTexts.tr.journeys.digestion.events.saliva = 'x'.repeat(41);

    const res = checkContent({
      manifest: f.manifest,
      taxonomy: f.taxonomy,
      index: f.index,
      structureFiles: f.structureFiles,
      motions: f.motions,
      centerlines: f.centerlines,
      journeys: f.journeys,
      journeyTexts: f.journeyTexts,
    });
    expect(res.errors.some((e) => e.includes('no-such-organ') && e.includes('mouth'))).toBe(true);
    expect(res.errors.some((e) => e.includes('missing-line') && e.includes('esophagus'))).toBe(true);
    expect(res.errors.some((e) => e.includes('carbs') && e.includes('esophagus'))).toBe(true);
    expect(res.errors.some((e) => e.includes('saliva') && e.includes('content/en/journeys.json'))).toBe(true);
    expect(res.errors.some((e) => e.includes('41 characters') && e.includes('content/tr/journeys.json'))).toBe(true);

    const noCl = checkContent({
      manifest: { ...f.manifest, centerlines: undefined },
      taxonomy: f.taxonomy,
      index: f.index,
      structureFiles: f.structureFiles,
      journeys: f.journeys,
      journeyTexts: f.journeyTexts,
    });
    expect(noCl.errors.some((e) => e.includes('manifest.centerlines'))).toBe(true);
  });

  it('flags unknown rhythm motion, decreasing scrub range, out-of-range meters, missing v2 en texts, and bad meter template placeholders', () => {
    const f = makeJourneyFixture();
    (f.journeys.journeys[0].stages[0] as Record<string, unknown>).rhythm = {
      motion: 'elbow-flexion',
      mode: 'scrub',
      from: 0.5,
      to: 0.8,
    };
    (f.journeys.journeys[0].stages[1] as Record<string, unknown>).rhythm = {
      motion: 'elbow-flexion',
      mode: 'scrub',
      from: 0.3,
      to: 0.9,
    };
    f.journeys.journeys[0].stages[1].meters.absorbed = 120;
    f.journeyTexts.tr.journeys.digestion.meters.absorbed.value = '{s}% bad {q}';
    delete (f.journeyTexts.en.journeys.digestion as Record<string, unknown>).follow;

    const res = checkContent({
      manifest: f.manifest,
      taxonomy: f.taxonomy,
      index: f.index,
      structureFiles: f.structureFiles,
      motions: f.motions,
      centerlines: f.centerlines,
      journeys: f.journeys,
      journeyTexts: f.journeyTexts,
    });
    expect(res.errors.some((e) => e.includes('scrub rhythm from') && e.includes('esophagus'))).toBe(true);
    expect(res.errors.some((e) => e.includes('absorbed') && e.includes('[0, 100]'))).toBe(true);
    expect(res.errors.some((e) => e.includes('without a secondary meter'))).toBe(true);
    expect(res.errors.some((e) => e.includes('unsupported placeholder "{q}"'))).toBe(true);
    expect(res.errors.some((e) => e.includes('missing follow label'))).toBe(true);

    (f.journeys.journeys[0].stages[0] as Record<string, unknown>).rhythm = {
      motion: 'unknown-motion',
      mode: 'play',
    };
    const resUnknownMotion = checkContent({
      manifest: f.manifest,
      taxonomy: f.taxonomy,
      index: f.index,
      structureFiles: f.structureFiles,
      motions: f.motions,
      centerlines: f.centerlines,
      journeys: f.journeys,
      journeyTexts: f.journeyTexts,
    });
    expect(
      resUnknownMotion.errors.some((e) => e.includes('unknown-motion') && e.includes('mouth')),
    ).toBe(true);
  });
});
