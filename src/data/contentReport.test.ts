import { describe, expect, it } from 'vitest';
import taxonomy from '../../content/taxonomy.json';
import { contentReport } from './contentReport';

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
    },
  };

  const index = {
    locale: 'en',
    structures: [
      {
        id: 'femur',
        system: 'skeletal',
        region: 'lower-limb',
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
    ],
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
          function: 'Supports body weight when standing or walking.',
          details: { kind: 'bone', boneType: 'long', articulatesWith: [] },
          sources: [source],
        },
      ],
    },
  };

  return { manifest, taxonomy, index, structureFiles };
}

describe('contentReport', () => {
  it('summarizes complete featured rows and reports missing fields cleanly', () => {
    const fixture = makeFixture();
    const rows = contentReport(fixture);
    const skeletal = rows.find((r) => r.system === 'skeletal');
    expect(skeletal).toEqual({
      system: 'skeletal',
      structures: 2,
      featured: 1,
      featuredComplete: 1,
      missingLatin: 1,
      gaps: [],
    });

    const broken = makeFixture();
    const entry = (
      broken.structureFiles['structures/skeletal.json'] as {
        entries: Array<{ function?: string }>;
      }
    ).entries[0];
    delete entry.function;

    const brokenRows = contentReport(broken);
    const brokenSkeletal = brokenRows.find((r) => r.system === 'skeletal');
    expect(brokenSkeletal).toMatchObject({
      featuredComplete: 0,
      gaps: [{ id: 'femur', missing: ['function'] }],
    });
  });

  it('summarizes translated names and featured coverage per locale', async () => {
    const { contentLocaleReport } = await import('./contentReport');
    const fixture = makeFixture();
    const rows = contentLocaleReport({
      ...fixture,
      locales: {
        tr: {
          index: {
            locale: 'tr',
            structures: [
              {
                id: 'femur',
                system: 'skeletal',
                region: 'lower-limb',
                paired: true,
                kind: 'bone',
                tissue: 'bone',
                names: { common: 'Uyluk kemiği', synonyms: [] },
                featured: true,
              },
            ],
          },
          structureFiles: {
            'structures/skeletal.json': {
              system: 'skeletal',
              entries: [
                {
                  id: 'femur',
                  overview: 'Vücuttaki en uzun kemik.',
                  function: 'Vücut ağırlığını taşır.',
                  details: {
                    kind: 'bone',
                    boneType: 'long',
                    articulatesWith: [],
                  },
                  sources: [
                    {
                      title: 'OpenStax Anatomy and Physiology 2e',
                      url: 'https://openstax.org/books/anatomy-and-physiology-2e',
                      license: 'CC-BY-4.0',
                    },
                  ],
                },
              ],
            },
          },
        },
      },
    });
    expect(rows).toEqual([
      {
        locale: 'tr',
        namesTranslated: 1,
        namesTotal: 2,
        featuredTranslated: 1,
        featuredTotal: 1,
      },
    ]);
  });
});
