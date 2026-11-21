import type { z } from 'zod';
import { parseMeshId, type Side, type StructureId } from './ids';
import {
  IndexFileSchema,
  ManifestSchema,
  StructureFileSchema,
  TaxonomySchema,
  type Details,
  type IndexEntry,
  type IndexFile,
  type Kind,
  type Manifest,
  type StructureFile,
  type Taxonomy,
} from './schema';

/** Result of validating content schemas and cross-file consistency. */
export type ContentReport = {
  errors: string[];
  warnings: string[];
};

function formatSchemaErrors(file: string, error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join('.');
    return path
      ? `${file}: ${path}: ${issue.message}`
      : `${file}: ${issue.message}`;
  });
}

function expectedDetailsKind(kind: Kind): Details['kind'] {
  if (kind === 'muscle' || kind === 'bone') return kind;
  return 'facts';
}

function indexStructures(
  index: IndexFile,
  taxonomy: Taxonomy,
  errors: string[],
): Map<StructureId, IndexEntry> {
  const validSystems = new Set(taxonomy.systems.map((s) => s.id));
  const validRegions = new Set(taxonomy.regions.map((r) => r.id));
  const byId = new Map<StructureId, IndexEntry>();

  for (const entry of index.structures) {
    if (byId.has(entry.id)) {
      errors.push(`index.json: duplicate structure id "${entry.id}"`);
      continue;
    }
    byId.set(entry.id, entry);
    if (!validSystems.has(entry.system)) {
      errors.push(
        `index.json: structure "${entry.id}" references unknown system "${entry.system}"`,
      );
    }
    if (!validRegions.has(entry.region)) {
      errors.push(
        `index.json: structure "${entry.id}" references unknown region "${entry.region}"`,
      );
    }
  }

  return byId;
}

function checkManifestMeshes(
  manifest: Manifest,
  byId: Map<StructureId, IndexEntry>,
  errors: string[],
  warnings: string[],
): void {
  const sidesByStructure = new Map<StructureId, Set<Side>>();

  for (const meshId of Object.keys(manifest.meshes)) {
    const { structureId, side } = parseMeshId(meshId);
    const structure = byId.get(structureId);
    if (!structure) {
      errors.push(
        `manifest: mesh "${meshId}" has no structure "${structureId}" in index.json`,
      );
      continue;
    }

    let sides = sidesByStructure.get(structureId);
    if (!sides) {
      sides = new Set<Side>();
      sidesByStructure.set(structureId, sides);
    }
    sides.add(side);

    if (side !== null && !structure.paired) {
      errors.push(
        `manifest: mesh "${meshId}" has a side but structure "${structureId}" is not paired`,
      );
    } else if (side === null && structure.paired) {
      errors.push(
        `manifest: mesh "${meshId}" has no side but structure "${structureId}" is paired`,
      );
    }
  }

  for (const structure of byId.values()) {
    const sides = sidesByStructure.get(structure.id);
    if (!sides) {
      warnings.push(
        `index.json: structure "${structure.id}" has no meshes in manifest`,
      );
      continue;
    }
    if (structure.paired && (sides.has('left') || sides.has('right'))) {
      if (!sides.has('left')) {
        warnings.push(
          `manifest: paired structure "${structure.id}" has no left mesh`,
        );
      }
      if (!sides.has('right')) {
        warnings.push(
          `manifest: paired structure "${structure.id}" has no right mesh`,
        );
      }
    }
  }
}

function checkStructureFiles(
  structureFiles: [string, StructureFile][],
  byId: Map<StructureId, IndexEntry>,
  errors: string[],
): void {
  for (const [fileName, file] of structureFiles) {
    const seen = new Set<StructureId>();
    for (const entry of file.entries) {
      if (seen.has(entry.id)) {
        errors.push(`${fileName}: duplicate structure id "${entry.id}"`);
        continue;
      }
      seen.add(entry.id);

      const structure = byId.get(entry.id);
      if (!structure) {
        errors.push(`${fileName}: "${entry.id}" is not in index.json`);
        continue;
      }
      if (structure.system !== file.system) {
        errors.push(
          `${fileName}: "${entry.id}" belongs to system "${structure.system}"`,
        );
      }
      if (entry.details) {
        const expected = expectedDetailsKind(structure.kind);
        if (entry.details.kind !== expected) {
          errors.push(
            `${fileName}: "${entry.id}" has ${entry.details.kind} details but kind "${structure.kind}"`,
          );
        }
      }
    }
  }
}

/** Validates schemas and cross-references across manifest, taxonomy, index, and structure files. */
export function checkContent(input: {
  manifest: unknown;
  taxonomy: unknown;
  index: unknown;
  structureFiles: Record<string, unknown>;
}): ContentReport {
  const schemaErrors: string[] = [];

  const manifestResult = ManifestSchema.safeParse(input.manifest);
  if (!manifestResult.success) {
    schemaErrors.push(
      ...formatSchemaErrors('manifest.json', manifestResult.error),
    );
  }

  const taxonomyResult = TaxonomySchema.safeParse(input.taxonomy);
  if (!taxonomyResult.success) {
    schemaErrors.push(
      ...formatSchemaErrors('taxonomy.json', taxonomyResult.error),
    );
  }

  const indexResult = IndexFileSchema.safeParse(input.index);
  if (!indexResult.success) {
    schemaErrors.push(...formatSchemaErrors('index.json', indexResult.error));
  }

  const parsedStructureFiles: [string, StructureFile][] = [];
  for (const [fileName, raw] of Object.entries(input.structureFiles)) {
    const res = StructureFileSchema.safeParse(raw);
    if (!res.success) {
      schemaErrors.push(...formatSchemaErrors(fileName, res.error));
    } else {
      parsedStructureFiles.push([fileName, res.data]);
    }
  }

  if (
    schemaErrors.length > 0 ||
    !manifestResult.success ||
    !taxonomyResult.success ||
    !indexResult.success
  ) {
    return { errors: schemaErrors, warnings: [] };
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  const byId = indexStructures(indexResult.data, taxonomyResult.data, errors);
  checkManifestMeshes(manifestResult.data, byId, errors, warnings);
  checkStructureFiles(parsedStructureFiles, byId, errors);

  return { errors, warnings };
}
