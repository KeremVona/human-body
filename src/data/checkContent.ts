import { parseMeshId, type MeshId, type Side, type StructureId } from './ids';
import { MotionsFileSchema, type MotionsFile } from '../features/motion/schema';
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
  type StructureEntry,
  type StructureFile,
  type Taxonomy,
} from './schema';

const TARGET_FEATURED = 125;
const MAX_OVERVIEW = 400;
const MAX_FUNCTION = 600;
const MARKUP_RE = /<\/?[a-z][^>]*>|\*\*|\[[^\]]+\]\([^)]+\)/i;
const Z_ANATOMY_RE = /z-anatomy/i;

/** Returns true when a source URL refers only to the upstream Z-Anatomy model. */
export function isZAnatomySourceUrl(url: string): boolean {
  return Z_ANATOMY_RE.test(url);
}

/** Result of validating content schemas and cross-file consistency. */
export type ContentReport = {
  errors: string[];
  warnings: string[];
};

function formatSchemaErrors(
  file: string,
  error: {
    issues: ReadonlyArray<{
      path: ReadonlyArray<PropertyKey>;
      message: string;
    }>;
  },
): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.map(String).join('.');
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
  const bundleIds = new Set<string>();
  const bundleMeshOwner = new Map<MeshId, string>();

  for (const bundle of manifest.bundles) {
    if (bundleIds.has(bundle.id)) {
      errors.push(`manifest: duplicate bundle id "${bundle.id}"`);
    } else {
      bundleIds.add(bundle.id);
    }

    for (const meshId of bundle.meshIds) {
      const meta = manifest.meshes[meshId];
      if (!meta) {
        errors.push(
          `manifest: bundle "${bundle.id}" references missing mesh "${meshId}"`,
        );
      } else if (meta.bundle !== bundle.id) {
        errors.push(
          `manifest: mesh "${meshId}" lists bundle "${meta.bundle}" but appears in bundle "${bundle.id}"`,
        );
      }

      if (bundleMeshOwner.has(meshId)) {
        errors.push(`manifest: mesh "${meshId}" appears in multiple bundles`);
      } else {
        bundleMeshOwner.set(meshId, bundle.id);
      }
    }
  }

  for (const [meshId, meta] of Object.entries(manifest.meshes)) {
    if (bundleMeshOwner.get(meshId) !== meta.bundle) {
      errors.push(
        `manifest: mesh "${meshId}" is not listed in bundle "${meta.bundle}" meshIds`,
      );
    }
  }

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

function detailsTextFields(details: Details): [string, string][] {
  if (details.kind === 'muscle') {
    return [
      ['origin', details.origin],
      ['insertion', details.insertion],
      ['innervation', details.innervation],
      ['bloodSupply', details.bloodSupply],
      ['action', details.action],
    ];
  }
  if (details.kind === 'bone') {
    return [['boneType', details.boneType]];
  }
  return details.facts.map((fact) => ['facts', fact]);
}

function checkEntryQuality(
  fileName: string,
  entry: StructureEntry,
  byId: Map<StructureId, IndexEntry>,
  errors: string[],
): void {
  if (entry.overview && entry.overview.length > MAX_OVERVIEW) {
    errors.push(
      `${fileName}: "${entry.id}" overview is ${entry.overview.length} characters (max ${MAX_OVERVIEW})`,
    );
  }
  if (entry.function && entry.function.length > MAX_FUNCTION) {
    errors.push(
      `${fileName}: "${entry.id}" function is ${entry.function.length} characters (max ${MAX_FUNCTION})`,
    );
  }

  const textFields: [string, string][] = [];
  if (entry.overview) textFields.push(['overview', entry.overview]);
  if (entry.function) textFields.push(['function', entry.function]);
  if (entry.details) textFields.push(...detailsTextFields(entry.details));

  const flagged = new Set<string>();
  for (const [field, value] of textFields) {
    if (!flagged.has(field) && MARKUP_RE.test(value)) {
      flagged.add(field);
      errors.push(`${fileName}: "${entry.id}" ${field} contains markup`);
    }
  }

  if (entry.details?.kind === 'bone') {
    for (const other of entry.details.articulatesWith) {
      if (!byId.has(other)) {
        errors.push(
          `${fileName}: "${entry.id}" articulates with unknown "${other}"`,
        );
      }
    }
  }
}

function checkStructureFiles(
  structureFiles: [string, StructureFile][],
  byId: Map<StructureId, IndexEntry>,
  errors: string[],
): Map<StructureId, { fileName: string; entry: StructureEntry }> {
  const entriesById = new Map<
    StructureId,
    { fileName: string; entry: StructureEntry }
  >();

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
      } else if (!entriesById.has(entry.id)) {
        entriesById.set(entry.id, { fileName, entry });
      }
      if (entry.details) {
        const expected = expectedDetailsKind(structure.kind);
        if (entry.details.kind !== expected) {
          errors.push(
            `${fileName}: "${entry.id}" has ${entry.details.kind} details but kind "${structure.kind}"`,
          );
        }
      }
      checkEntryQuality(fileName, entry, byId, errors);
    }
  }

  return entriesById;
}

function checkFeaturedStructures(
  byId: Map<StructureId, IndexEntry>,
  entriesById: Map<StructureId, { fileName: string; entry: StructureEntry }>,
  errors: string[],
  warnings: string[],
): void {
  let featuredCount = 0;

  for (const structure of byId.values()) {
    if (!structure.featured) continue;
    featuredCount++;

    if (!structure.names.latin?.trim()) {
      errors.push(`index.json: featured "${structure.id}" has no Latin name`);
    }

    const located = entriesById.get(structure.id);
    if (!located) {
      errors.push(
        `index.json: featured "${structure.id}" has no entry in structures/${structure.system}.json`,
      );
      continue;
    }

    const { fileName, entry } = located;
    if (!entry.overview?.trim()) {
      errors.push(
        `${fileName}: featured "${structure.id}" is missing overview`,
      );
    }
    if (!entry.function?.trim()) {
      errors.push(
        `${fileName}: featured "${structure.id}" is missing function`,
      );
    }
    if (!entry.sources.some((src) => !isZAnatomySourceUrl(src.url))) {
      errors.push(
        `${fileName}: featured "${structure.id}" needs a source other than Z-Anatomy`,
      );
    }
    if (structure.kind === 'muscle' && entry.details?.kind !== 'muscle') {
      errors.push(
        `${fileName}: featured muscle "${structure.id}" has no muscle details`,
      );
    } else if (structure.kind === 'bone' && entry.details?.kind !== 'bone') {
      errors.push(
        `${fileName}: featured bone "${structure.id}" has no bone details`,
      );
    }
  }

  if (featuredCount !== TARGET_FEATURED) {
    warnings.push(
      `index.json: ${featuredCount} featured structures (target ${TARGET_FEATURED})`,
    );
  }
}

function checkMotions(
  motionsFile: MotionsFile,
  manifest: Manifest,
  errors: string[],
): void {
  const knownMeshes = new Set(Object.keys(manifest.meshes));
  const checkMesh = (motionId: string, meshId: MeshId) => {
    if (!knownMeshes.has(meshId)) {
      errors.push(
        `motions.json: "${motionId}" references unknown mesh "${meshId}"`,
      );
    }
  };

  for (const def of motionsFile.motions) {
    if (def.kind === 'hinge') {
      const movingSet = new Set(def.moving);
      for (const meshId of def.moving) {
        checkMesh(def.id, meshId);
      }
      for (const meshId of def.ghost) {
        checkMesh(def.id, meshId);
        if (movingSet.has(meshId)) {
          errors.push(
            `motions.json: "${def.id}" lists "${meshId}" as both moving and ghost`,
          );
        }
      }
      for (const meshId of def.agonists.flex) {
        checkMesh(def.id, meshId);
      }
      for (const meshId of def.agonists.extend) {
        checkMesh(def.id, meshId);
      }
      checkMesh(def.id, def.pivot.mesh);
    } else {
      for (const group of def.groups) {
        for (const meshId of group.meshes) {
          checkMesh(def.id, meshId);
        }
      }
      if (def.center) {
        checkMesh(def.id, def.center.mesh);
      }
    }
  }
}

export type LocaleContentInput = {
  index: unknown;
  structureFiles: Record<string, unknown>;
};

function checkLocaleFolder(
  locale: string,
  locInput: LocaleContentInput,
  enById: Map<StructureId, IndexEntry>,
  errors: string[],
): void {
  const indexLabel = `content/${locale}/index.json`;
  const locIndexRes = IndexFileSchema.safeParse(locInput.index);
  if (!locIndexRes.success) {
    errors.push(...formatSchemaErrors(indexLabel, locIndexRes.error));
  } else {
    if (locIndexRes.data.locale !== locale) {
      errors.push(
        `${indexLabel}: locale "${locIndexRes.data.locale}" does not match folder "${locale}"`,
      );
    }
    const seenIndex = new Set<StructureId>();
    for (const entry of locIndexRes.data.structures) {
      if (seenIndex.has(entry.id)) {
        errors.push(`${indexLabel}: duplicate structure id "${entry.id}"`);
        continue;
      }
      seenIndex.add(entry.id);
      if (!enById.has(entry.id)) {
        errors.push(
          `${indexLabel}: "${entry.id}" is not in content/en/index.json`,
        );
      }
      if (
        MARKUP_RE.test(entry.names.common) ||
        entry.names.synonyms.some((syn) => MARKUP_RE.test(syn))
      ) {
        errors.push(`${indexLabel}: "${entry.id}" names contain markup`);
      }
    }
  }

  for (const [fileName, raw] of Object.entries(locInput.structureFiles)) {
    const fileLabel = `content/${locale}/${fileName}`;
    const res = StructureFileSchema.safeParse(raw);
    if (!res.success) {
      errors.push(...formatSchemaErrors(fileLabel, res.error));
      continue;
    }
    const seen = new Set<StructureId>();
    for (const entry of res.data.entries) {
      if (seen.has(entry.id)) {
        errors.push(`${fileLabel}: duplicate structure id "${entry.id}"`);
        continue;
      }
      seen.add(entry.id);

      const enStructure = enById.get(entry.id);
      if (!enStructure) {
        errors.push(
          `${fileLabel}: "${entry.id}" is not in content/en/index.json`,
        );
        continue;
      }
      if (enStructure.system !== res.data.system) {
        errors.push(
          `${fileLabel}: "${entry.id}" belongs to system "${enStructure.system}"`,
        );
      }
      if (entry.details) {
        const expected = expectedDetailsKind(enStructure.kind);
        if (entry.details.kind !== expected) {
          errors.push(
            `${fileLabel}: "${entry.id}" has ${entry.details.kind} details but kind "${enStructure.kind}"`,
          );
        }
      }
      checkEntryQuality(fileLabel, entry, enById, errors);
    }
  }
}

/** Validates schemas and cross-references across manifest, taxonomy, index, structure files, optional motions, and extra locale folders. */
export function checkContent(input: {
  manifest: unknown;
  taxonomy: unknown;
  index: unknown;
  structureFiles: Record<string, unknown>;
  motions?: unknown;
  locales?: Record<string, LocaleContentInput>;
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

  const motionsResult =
    input.motions !== undefined
      ? MotionsFileSchema.safeParse(input.motions)
      : null;
  if (motionsResult && !motionsResult.success) {
    schemaErrors.push(
      ...formatSchemaErrors('motions.json', motionsResult.error),
    );
  }

  if (
    schemaErrors.length > 0 ||
    !manifestResult.success ||
    !taxonomyResult.success ||
    !indexResult.success ||
    (motionsResult && !motionsResult.success)
  ) {
    return { errors: schemaErrors, warnings: [] };
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  const byId = indexStructures(indexResult.data, taxonomyResult.data, errors);
  checkManifestMeshes(manifestResult.data, byId, errors, warnings);
  const entriesById = checkStructureFiles(parsedStructureFiles, byId, errors);
  checkFeaturedStructures(byId, entriesById, errors, warnings);
  if (motionsResult?.success) {
    checkMotions(motionsResult.data, manifestResult.data, errors);
  }
  if (input.locales) {
    for (const [locale, locInput] of Object.entries(input.locales)) {
      checkLocaleFolder(locale, locInput, byId, errors);
    }
  }

  return { errors, warnings };
}
