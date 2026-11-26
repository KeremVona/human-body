import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ManifestSchema } from '../../src/data/schema';
import type { MeshStats } from './optimize';
import { writeOutputs } from './outputs';

it('writeOutputs removes stale bundle files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'outputs-test-'));
  try {
    writeFileSync(join(dir, 'skeletal.deadbeef.glb'), 'old');
    writeFileSync(join(dir, 'notes.txt'), 'keep');

    const bytes = new TextEncoder().encode('glb-data');
    const meshes: Record<string, MeshStats> = {
      'femur--l': {
        bounds: { min: [0, 0, 0], max: [0.1, 0.4, 0.1] },
        triangles: 12,
        sizeClass: 'large',
      },
      sternum: {
        bounds: { min: [-0.05, 0.2, 0], max: [0.05, 0.4, 0.05] },
        triangles: 12,
        sizeClass: 'medium',
      },
    };
    const source = {
      name: 'Z-Anatomy',
      version: '2023-05-02',
      license: 'CC-BY-SA-4.0',
    };

    const m = writeOutputs(
      dir,
      [{ id: 'skeletal', glb: bytes, meshes }],
      source,
    );
    expect(readdirSync(dir).sort()).toEqual(
      [m.bundles[0].file, 'manifest.json', 'notes.txt'].sort(),
    );
    expect(
      ManifestSchema.parse(
        JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')),
      ).bundles[0].meshIds,
    ).toEqual(Object.keys(meshes).sort());
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

it('writeOutputs keeps preview file in manifest and removes stale preview glb', () => {
  const dir = mkdtempSync(join(tmpdir(), 'outputs-preview-'));
  try {
    writeFileSync(join(dir, 'skeletal-preview.deadbeef.glb'), 'stale');

    const bundleBytes = new TextEncoder().encode('glb-data');
    const previewBytes = new TextEncoder().encode('preview-glb');
    const meshes: Record<string, MeshStats> = {
      'femur--l': {
        bounds: { min: [0, 0, 0], max: [0.1, 0.4, 0.1] },
        triangles: 12,
        sizeClass: 'large',
      },
    };
    const source = {
      name: 'Z-Anatomy',
      version: '2023-05-02',
      license: 'CC-BY-SA-4.0',
    };

    const m = writeOutputs(
      dir,
      [{ id: 'skeletal', glb: bundleBytes, meshes }],
      source,
      {
        glb: previewBytes,
        bounds: { min: [0, 0, 0], max: [0.1, 0.4, 0.1] },
      },
    );

    expect(m.preview).toBeDefined();
    expect(m.preview?.file).toMatch(/^skeletal-preview\.[0-9a-f]{8}\.glb$/);
    expect(readdirSync(dir).sort()).toEqual(
      [m.bundles[0].file, m.preview!.file, 'manifest.json'].sort(),
    );
    expect(readdirSync(dir)).not.toContain('skeletal-preview.deadbeef.glb');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
