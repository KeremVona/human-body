import { parseMeshId, type MeshId, type Side, type StructureId } from './ids';
import { CenterlinesFileSchema, type CenterlinesFile } from './centerlines';
import {
  JourneysFileSchema,
  JourneyTextsFileSchema,
  type JourneyId,
  type JourneysFile,
  type JourneyTextsFile,
  type StageId,
} from '../features/journey/schema';
import { MotionsFileSchema, type MotionsFile } from '../features/motion/schema';
import {
  ToursFileSchema,
  TourTextsFileSchema,
  type StepId,
  type TourId,
  type ToursFile,
  type TourTextsFile,
} from '../features/tours/schema';
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
const MAX_TOUR_TITLE = 60;
const MAX_TOUR_SUMMARY = 160;
const MAX_STEP_TITLE = 60;
const MAX_STEP_BODY = 400;
const MAX_JOURNEY_NOTE = 160;
const MAX_JOURNEY_EVENT_LABEL = 40;
const MAX_JOURNEY_FOLLOW = 40;
const MAX_JOURNEY_INSPECTOR_LINK = 60;
const MAX_JOURNEY_METERS_TITLE = 40;
const MAX_JOURNEY_METERS_NOTE = 120;
const MAX_METER_LABEL = 40;
const MAX_METER_VALUE = 60;
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
    } else if (def.kind === 'pulse') {
      for (const group of def.groups) {
        for (const meshId of group.meshes) {
          checkMesh(def.id, meshId);
        }
      }
      if (def.center) {
        checkMesh(def.id, def.center.mesh);
      }
    } else if (def.kind === 'breath') {
      for (const group of def.expand) {
        for (const meshId of group.meshes) {
          checkMesh(def.id, meshId);
        }
        checkMesh(def.id, group.center.mesh);
      }
      for (const shift of def.shift ?? []) {
        for (const meshId of shift.meshes) {
          checkMesh(def.id, meshId);
        }
      }
    }
  }
}

function checkTourTextField(
  fileLabel: string,
  target: string,
  field: string,
  value: string,
  maxLength: number,
  errors: string[],
): void {
  if (value.length > maxLength) {
    errors.push(
      `${fileLabel}: "${target}" ${field} is ${value.length} characters (max ${maxLength})`,
    );
  }
  if (MARKUP_RE.test(value)) {
    errors.push(`${fileLabel}: "${target}" ${field} contains markup`);
  }
}

function checkTours(
  toursFile: ToursFile,
  tourTexts: Record<string, TourTextsFile>,
  manifest: Manifest,
  taxonomy: Taxonomy,
  motionsFile: MotionsFile | null,
  errors: string[],
): void {
  const knownMeshes = new Set(Object.keys(manifest.meshes));
  const knownSystems = new Set(taxonomy.systems.map((s) => s.id));
  const knownMotions = new Set(motionsFile?.motions.map((m) => m.id) ?? []);
  const stepsByTour = new Map<TourId, Set<StepId>>();

  for (const tour of toursFile.tours) {
    if (stepsByTour.has(tour.id)) {
      errors.push(`tours.json: duplicate tour id "${tour.id}"`);
      continue;
    }

    if (tour.steps.length < 4 || tour.steps.length > 7) {
      errors.push(
        `tours.json: "${tour.id}" has ${tour.steps.length} steps (allowed 4–7)`,
      );
    }

    for (const sys of tour.systems ?? []) {
      if (!knownSystems.has(sys)) {
        errors.push(`tours.json: "${tour.id}" references unknown system "${sys}"`);
      }
    }

    const stepIds = new Set<StepId>();
    stepsByTour.set(tour.id, stepIds);

    for (const step of tour.steps) {
      const target = `${tour.id}/${step.id}`;
      if (stepIds.has(step.id)) {
        errors.push(`tours.json: "${tour.id}" has duplicate step id "${step.id}"`);
        continue;
      }
      stepIds.add(step.id);

      const referencedSystems = new Set<string>([
        ...step.view.s,
        ...Object.keys(step.view.o ?? {}),
      ]);
      for (const sys of referencedSystems) {
        if (!knownSystems.has(sys as Taxonomy['systems'][number]['id'])) {
          errors.push(`tours.json: "${target}" references unknown system "${sys}"`);
        }
      }

      const meshArrays = [
        step.view.h,
        step.view.i ?? [],
        step.view.f ?? [],
        step.view.sel,
      ];
      for (const list of meshArrays) {
        for (const meshId of list) {
          if (!knownMeshes.has(meshId)) {
            errors.push(`tours.json: "${target}" references unknown mesh "${meshId}"`);
          }
        }
      }

      if (step.motion && !knownMotions.has(step.motion.id)) {
        errors.push(
          `tours.json: "${target}" references unknown motion "${step.motion.id}"`,
        );
      }
    }
  }

  const enTexts = tourTexts.en;
  if (enTexts || toursFile.tours.length > 0) {
    for (const tour of toursFile.tours) {
      const entry = enTexts?.tours[tour.id];
      if (!entry?.title?.trim()) {
        errors.push(`content/en/tours.json: missing title for "${tour.id}"`);
      }
      if (!entry?.summary?.trim()) {
        errors.push(`content/en/tours.json: missing summary for "${tour.id}"`);
      }
      for (const step of tour.steps) {
        const stepEntry = entry?.steps?.[step.id];
        const target = `${tour.id}/${step.id}`;
        if (!stepEntry?.title?.trim()) {
          errors.push(`content/en/tours.json: missing title for "${target}"`);
        }
        if (!stepEntry?.body?.trim()) {
          errors.push(`content/en/tours.json: missing body for "${target}"`);
        }
      }
    }
  }

  for (const [locale, textFile] of Object.entries(tourTexts)) {
    const fileLabel = `content/${locale}/tours.json`;
    for (const [tourId, entry] of Object.entries(textFile.tours)) {
      const validSteps = stepsByTour.get(tourId);
      if (!validSteps) {
        errors.push(`${fileLabel}: "${tourId}" is not in tours.json`);
        continue;
      }
      if (entry.title !== undefined) {
        checkTourTextField(
          fileLabel,
          tourId,
          'title',
          entry.title,
          MAX_TOUR_TITLE,
          errors,
        );
      }
      if (entry.summary !== undefined) {
        checkTourTextField(
          fileLabel,
          tourId,
          'summary',
          entry.summary,
          MAX_TOUR_SUMMARY,
          errors,
        );
      }
      for (const [stepId, stepText] of Object.entries(entry.steps ?? {})) {
        const target = `${tourId}/${stepId}`;
        if (!validSteps.has(stepId)) {
          errors.push(`${fileLabel}: "${target}" is not in tours.json`);
          continue;
        }
        if (stepText.title !== undefined) {
          checkTourTextField(
            fileLabel,
            target,
            'title',
            stepText.title,
            MAX_STEP_TITLE,
            errors,
          );
        }
        if (stepText.body !== undefined) {
          checkTourTextField(
            fileLabel,
            target,
            'body',
            stepText.body,
            MAX_STEP_BODY,
            errors,
          );
        }
      }
    }
  }
}

function checkJourneys(
  journeysFile: JourneysFile,
  journeyTexts: Record<string, JourneyTextsFile>,
  manifest: Manifest,
  taxonomy: Taxonomy,
  centerlinesFile: CenterlinesFile | null,
  motionsFile: MotionsFile | null,
  errors: string[],
): void {
  const knownMeshes = new Set(Object.keys(manifest.meshes));
  const knownSystems = new Set(taxonomy.systems.map((s) => s.id));
  const knownLines = new Set(Object.keys(centerlinesFile?.lines ?? {}));
  const knownMotions = new Set(
    motionsFile ? motionsFile.motions.map((m) => m.id) : [],
  );

  if (journeysFile.journeys.length > 0 && !manifest.centerlines) {
    errors.push(
      'journeys.json: manifest.centerlines is missing (run npm run assets:centerlines)',
    );
  }
  if (journeysFile.journeys.length > 0 && !centerlinesFile) {
    errors.push('journeys.json: centerlines data is missing');
  }

  const stagesByJourney = new Map<JourneyId, Set<StageId>>();
  const eventIdsByJourney = new Map<JourneyId, Set<string>>();
  const metersByJourney = new Map<
    JourneyId,
    Map<string, JourneysFile['journeys'][number]['meters'][number]>
  >();

  for (const journey of journeysFile.journeys) {
    if (stagesByJourney.has(journey.id)) {
      errors.push(`journeys.json: duplicate journey id "${journey.id}"`);
      continue;
    }

    for (const sys of journey.systems) {
      if (!knownSystems.has(sys)) {
        errors.push(
          `journeys.json: "${journey.id}" references unknown system "${sys}"`,
        );
      }
    }

    const meterDefs = new Map(journey.meters.map((m) => [m.id, m]));
    metersByJourney.set(journey.id, meterDefs);

    if (journey.metersStart) {
      for (const m of journey.meters) {
        if (!Object.hasOwn(journey.metersStart, m.id)) {
          errors.push(
            `journeys.json: "${journey.id}" metersStart is missing meter "${m.id}"`,
          );
        }
      }
      for (const [mId, val] of Object.entries(journey.metersStart)) {
        const def = meterDefs.get(mId);
        if (!def) {
          errors.push(
            `journeys.json: "${journey.id}" metersStart sets unknown meter "${mId}"`,
          );
        } else if (val < 0 || val > def.max) {
          errors.push(
            `journeys.json: "${journey.id}" metersStart meter "${mId}" (${val}) must be in [0, ${def.max}]`,
          );
        }
      }
    }

    const stageIds = new Set<StageId>();
    const eventIds = new Set<string>();
    stagesByJourney.set(journey.id, stageIds);
    eventIdsByJourney.set(journey.id, eventIds);

    for (let idx = 0; idx < journey.stages.length; idx += 1) {
      const stage = journey.stages[idx];
      const target = `${journey.id}/${stage.id}`;
      if (stageIds.has(stage.id)) {
        errors.push(
          `journeys.json: "${journey.id}" has duplicate stage id "${stage.id}"`,
        );
        continue;
      }
      stageIds.add(stage.id);

      const referencedSystems = new Set<string>([
        ...stage.view.s,
        ...Object.keys(stage.view.o ?? {}),
      ]);
      for (const sys of referencedSystems) {
        if (!knownSystems.has(sys as Taxonomy['systems'][number]['id'])) {
          errors.push(
            `journeys.json: "${target}" references unknown system "${sys}"`,
          );
        }
      }

      const meshArrays: ReadonlyArray<readonly string[]> = [
        stage.organs,
        stage.inside ?? [],
        stage.view.h,
        stage.view.i ?? [],
        stage.view.f ?? [],
        stage.view.sel,
      ];
      for (const list of meshArrays) {
        for (const meshId of list) {
          if (!knownMeshes.has(meshId)) {
            errors.push(
              `journeys.json: "${target}" references unknown mesh "${meshId}"`,
            );
          }
        }
      }

      for (const item of stage.path) {
        if ('mesh' in item) {
          if (!knownMeshes.has(item.mesh)) {
            errors.push(
              `journeys.json: "${target}" path waypoint references unknown mesh "${item.mesh}"`,
            );
          }
        } else if (centerlinesFile && !knownLines.has(item.line)) {
          errors.push(
            `journeys.json: "${target}" references unknown centerline "${item.line}"`,
          );
        }
      }

      for (const ev of stage.events ?? []) {
        eventIds.add(ev.id);
        if (!knownMeshes.has(ev.mesh)) {
          errors.push(
            `journeys.json: "${target}" event "${ev.id}" references unknown mesh "${ev.mesh}"`,
          );
        }
        if (ev.via && centerlinesFile && !knownLines.has(ev.via)) {
          errors.push(
            `journeys.json: "${target}" event "${ev.id}" references unknown centerline "${ev.via}"`,
          );
        }
      }

      if (stage.rhythm && motionsFile && !knownMotions.has(stage.rhythm.motion)) {
        errors.push(
          `journeys.json: "${target}" rhythm references unknown motion "${stage.rhythm.motion}"`,
        );
      }

      if (idx > 0) {
        const prev = journey.stages[idx - 1];
        if (
          prev.rhythm?.mode === 'scrub' &&
          stage.rhythm?.mode === 'scrub' &&
          prev.rhythm.motion === stage.rhythm.motion &&
          stage.rhythm.from < prev.rhythm.from
        ) {
          errors.push(
            `journeys.json: "${target}" scrub rhythm from (${stage.rhythm.from}) decreases below previous stage "${prev.id}" (${prev.rhythm.from})`,
          );
        }
      }

      for (const m of journey.meters) {
        if (!Object.hasOwn(stage.meters, m.id)) {
          errors.push(
            `journeys.json: "${target}" is missing meter "${m.id}"`,
          );
        }
      }
      for (const [mId, val] of Object.entries(stage.meters)) {
        const def = meterDefs.get(mId);
        if (!def) {
          errors.push(
            `journeys.json: "${target}" sets unknown meter "${mId}"`,
          );
          continue;
        }
        if (val < 0 || val > def.max) {
          errors.push(
            `journeys.json: "${target}" meter "${mId}" (${val}) must be in [0, ${def.max}]`,
          );
        }
      }

      if (idx === 0 && journey.metersStart) {
        for (const m of journey.meters) {
          if (
            m.monotonic &&
            Object.hasOwn(stage.meters, m.id) &&
            Object.hasOwn(journey.metersStart, m.id) &&
            stage.meters[m.id] < journey.metersStart[m.id]
          ) {
            errors.push(
              `journeys.json: "${target}" monotonic meter "${m.id}" (${stage.meters[m.id]}) decreases below metersStart (${journey.metersStart[m.id]})`,
            );
          }
        }
      } else if (idx > 0) {
        const prev = journey.stages[idx - 1];
        for (const m of journey.meters) {
          if (
            m.monotonic &&
            Object.hasOwn(stage.meters, m.id) &&
            Object.hasOwn(prev.meters, m.id) &&
            stage.meters[m.id] < prev.meters[m.id]
          ) {
            errors.push(
              `journeys.json: "${target}" meter "${m.id}" (${stage.meters[m.id]}) decreases below previous stage "${prev.id}" (${prev.meters[m.id]})`,
            );
          }
        }
      }
    }
  }

  const enTexts = journeyTexts.en;
  if (enTexts || journeysFile.journeys.length > 0) {
    for (const journey of journeysFile.journeys) {
      const entry = enTexts?.journeys[journey.id];
      if (!entry?.title?.trim()) {
        errors.push(`content/en/journeys.json: missing title for "${journey.id}"`);
      }
      if (!entry?.summary?.trim()) {
        errors.push(
          `content/en/journeys.json: missing summary for "${journey.id}"`,
        );
      }
      if (!entry?.follow?.trim()) {
        errors.push(`content/en/journeys.json: missing follow label for "${journey.id}"`);
      }
      if (!entry?.inspectorLink?.trim()) {
        errors.push(
          `content/en/journeys.json: missing inspectorLink for "${journey.id}"`,
        );
      }
      if (!entry?.metersTitle?.trim()) {
        errors.push(
          `content/en/journeys.json: missing metersTitle for "${journey.id}"`,
        );
      }
      if (!entry?.metersNote?.trim()) {
        errors.push(
          `content/en/journeys.json: missing metersNote for "${journey.id}"`,
        );
      }
      for (const meter of journey.meters) {
        const mText = entry?.meters?.[meter.id];
        if (!mText?.label?.trim()) {
          errors.push(
            `content/en/journeys.json: missing meter label for "${journey.id}/meters/${meter.id}"`,
          );
        }
        if (!mText?.value?.trim()) {
          errors.push(
            `content/en/journeys.json: missing meter value template for "${journey.id}/meters/${meter.id}"`,
          );
        }
      }
      for (const stage of journey.stages) {
        const st = entry?.stages?.[stage.id];
        const target = `${journey.id}/${stage.id}`;
        if (!st?.title?.trim()) {
          errors.push(`content/en/journeys.json: missing title for "${target}"`);
        }
        if (!st?.body?.trim()) {
          errors.push(`content/en/journeys.json: missing body for "${target}"`);
        }
      }
      for (const eventId of eventIdsByJourney.get(journey.id) ?? []) {
        if (!entry?.events?.[eventId]?.trim()) {
          errors.push(
            `content/en/journeys.json: missing event label for "${journey.id}/${eventId}"`,
          );
        }
      }
    }
  }

  for (const [locale, textFile] of Object.entries(journeyTexts)) {
    const fileLabel = `content/${locale}/journeys.json`;
    for (const [journeyId, entry] of Object.entries(textFile.journeys)) {
      const validStages = stagesByJourney.get(journeyId);
      const validEvents = eventIdsByJourney.get(journeyId);
      const meterDefs = metersByJourney.get(journeyId);
      if (!validStages) {
        errors.push(`${fileLabel}: "${journeyId}" is not in journeys.json`);
        continue;
      }
      if (entry.title !== undefined) {
        checkTourTextField(
          fileLabel,
          journeyId,
          'title',
          entry.title,
          MAX_TOUR_TITLE,
          errors,
        );
      }
      if (entry.summary !== undefined) {
        checkTourTextField(
          fileLabel,
          journeyId,
          'summary',
          entry.summary,
          MAX_TOUR_SUMMARY,
          errors,
        );
      }
      if (entry.follow !== undefined) {
        checkTourTextField(
          fileLabel,
          journeyId,
          'follow',
          entry.follow,
          MAX_JOURNEY_FOLLOW,
          errors,
        );
      }
      if (entry.inspectorLink !== undefined) {
        checkTourTextField(
          fileLabel,
          journeyId,
          'inspectorLink',
          entry.inspectorLink,
          MAX_JOURNEY_INSPECTOR_LINK,
          errors,
        );
      }
      if (entry.metersTitle !== undefined) {
        checkTourTextField(
          fileLabel,
          journeyId,
          'metersTitle',
          entry.metersTitle,
          MAX_JOURNEY_METERS_TITLE,
          errors,
        );
      }
      if (entry.metersNote !== undefined) {
        checkTourTextField(
          fileLabel,
          journeyId,
          'metersNote',
          entry.metersNote,
          MAX_JOURNEY_METERS_NOTE,
          errors,
        );
      }
      for (const [meterId, mText] of Object.entries(entry.meters ?? {})) {
        const target = `${journeyId}/meters/${meterId}`;
        const mDef = meterDefs?.get(meterId);
        if (!mDef) {
          errors.push(`${fileLabel}: "${target}" is not in journeys.json`);
          continue;
        }
        if (mText.label !== undefined) {
          checkTourTextField(
            fileLabel,
            target,
            'label',
            mText.label,
            MAX_METER_LABEL,
            errors,
          );
        }
        if (mText.value !== undefined) {
          checkTourTextField(
            fileLabel,
            target,
            'value',
            mText.value,
            MAX_METER_VALUE,
            errors,
          );
          for (const match of mText.value.matchAll(/\{([^}]+)\}/g)) {
            const name = match[1];
            if (name !== 'v' && name !== 's') {
              errors.push(
                `${fileLabel}: "${target}" value template uses unsupported placeholder "{${name}}"`,
              );
            } else if (name === 's' && mDef.secondary === undefined) {
              errors.push(
                `${fileLabel}: "${target}" value template uses "{s}" without a secondary meter`,
              );
            }
          }
        }
      }
      for (const [stageId, stText] of Object.entries(entry.stages ?? {})) {
        const target = `${journeyId}/${stageId}`;
        if (!validStages.has(stageId)) {
          errors.push(`${fileLabel}: "${target}" is not in journeys.json`);
          continue;
        }
        if (stText.title !== undefined) {
          checkTourTextField(
            fileLabel,
            target,
            'title',
            stText.title,
            MAX_STEP_TITLE,
            errors,
          );
        }
        if (stText.body !== undefined) {
          checkTourTextField(
            fileLabel,
            target,
            'body',
            stText.body,
            MAX_STEP_BODY,
            errors,
          );
        }
        if (stText.note !== undefined) {
          checkTourTextField(
            fileLabel,
            target,
            'note',
            stText.note,
            MAX_JOURNEY_NOTE,
            errors,
          );
        }
      }
      for (const [evId, label] of Object.entries(entry.events ?? {})) {
        const target = `${journeyId}/events/${evId}`;
        if (!validEvents?.has(evId)) {
          errors.push(`${fileLabel}: "${target}" is not in journeys.json`);
          continue;
        }
        checkTourTextField(
          fileLabel,
          target,
          'label',
          label,
          MAX_JOURNEY_EVENT_LABEL,
          errors,
        );
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

/** Validates schemas and cross-references across manifest, taxonomy, index, structure files, optional motions, tours, and extra locale folders. */
export function checkContent(input: {
  manifest: unknown;
  taxonomy: unknown;
  index: unknown;
  structureFiles: Record<string, unknown>;
  motions?: unknown;
  locales?: Record<string, LocaleContentInput>;
  tours?: unknown;
  tourTexts?: Record<string, unknown>;
  centerlines?: unknown;
  journeys?: unknown;
  journeyTexts?: Record<string, unknown>;
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

  const toursResult =
    input.tours !== undefined ? ToursFileSchema.safeParse(input.tours) : null;
  if (toursResult && !toursResult.success) {
    schemaErrors.push(...formatSchemaErrors('tours.json', toursResult.error));
  }

  const parsedTourTexts: Record<string, TourTextsFile> = {};
  if (input.tourTexts) {
    for (const [locale, raw] of Object.entries(input.tourTexts)) {
      const res = TourTextsFileSchema.safeParse(raw);
      if (!res.success) {
        schemaErrors.push(
          ...formatSchemaErrors(`content/${locale}/tours.json`, res.error),
        );
      } else {
        parsedTourTexts[locale] = res.data;
      }
    }
  }

  const centerlinesResult =
    input.centerlines !== undefined
      ? CenterlinesFileSchema.safeParse(input.centerlines)
      : null;
  if (centerlinesResult && !centerlinesResult.success) {
    schemaErrors.push(
      ...formatSchemaErrors('centerlines.json', centerlinesResult.error),
    );
  }

  const journeysResult =
    input.journeys !== undefined
      ? JourneysFileSchema.safeParse(input.journeys)
      : null;
  if (journeysResult && !journeysResult.success) {
    schemaErrors.push(
      ...formatSchemaErrors('journeys.json', journeysResult.error),
    );
  }

  const parsedJourneyTexts: Record<string, JourneyTextsFile> = {};
  if (input.journeyTexts) {
    for (const [locale, raw] of Object.entries(input.journeyTexts)) {
      const res = JourneyTextsFileSchema.safeParse(raw);
      if (!res.success) {
        schemaErrors.push(
          ...formatSchemaErrors(`content/${locale}/journeys.json`, res.error),
        );
      } else {
        parsedJourneyTexts[locale] = res.data;
      }
    }
  }

  if (
    schemaErrors.length > 0 ||
    !manifestResult.success ||
    !taxonomyResult.success ||
    !indexResult.success ||
    (motionsResult && !motionsResult.success) ||
    (toursResult && !toursResult.success) ||
    (centerlinesResult && !centerlinesResult.success) ||
    (journeysResult && !journeysResult.success)
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
  if (toursResult?.success) {
    checkTours(
      toursResult.data,
      parsedTourTexts,
      manifestResult.data,
      taxonomyResult.data,
      motionsResult?.success ? motionsResult.data : null,
      errors,
    );
  }
  if (journeysResult?.success) {
    checkJourneys(
      journeysResult.data,
      parsedJourneyTexts,
      manifestResult.data,
      taxonomyResult.data,
      centerlinesResult?.success ? centerlinesResult.data : null,
      motionsResult?.success ? motionsResult.data : null,
      errors,
    );
  }
  if (input.locales) {
    for (const [locale, locInput] of Object.entries(input.locales)) {
      checkLocaleFolder(locale, locInput, byId, errors);
    }
  }

  return { errors, warnings };
}
