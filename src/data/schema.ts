import { z } from 'zod/mini';
import { MESH_ID_RE, STRUCTURE_ID_RE } from './ids';

const StructureIdString = z.string().check(z.regex(STRUCTURE_ID_RE));
const MeshIdString = z.string().check(z.regex(MESH_ID_RE));
const NonEmptyString = z.string().check(z.minLength(1));

/** Anatomical system identifier. */
export const SystemIdSchema = z.enum([
  'skeletal',
  'muscular',
  'cardiovascular',
  'nervous',
  'respiratory',
  'digestive',
  'urinary',
  'lymphatic',
  'integumentary',
]);
export type SystemId = z.infer<typeof SystemIdSchema>;

/** Anatomical body region identifier, in canonical display order. */
export const RegionIdSchema = z.enum([
  'head',
  'neck',
  'thorax',
  'abdomen',
  'pelvis',
  'back',
  'upper-limb',
  'lower-limb',
  'multiple',
]);
export type RegionId = z.infer<typeof RegionIdSchema>;

/** High-level structure category governing Inspector detail layout. */
export const KindSchema = z.enum([
  'muscle',
  'bone',
  'organ',
  'vessel',
  'nerve',
  'other',
]);
export type Kind = z.infer<typeof KindSchema>;

/** Tissue material class governing 3D rendering appearance. */
export const TissueSchema = z.enum([
  'bone',
  'cartilage',
  'muscle',
  'tendon',
  'ligament',
  'artery',
  'vein',
  'nerve',
  'organ',
  'skin',
  'lymph',
  'other',
]);
export type Tissue = z.infer<typeof TissueSchema>;

/** Six-digit hex RGB color string (`#RRGGBB`). */
export const HexColorSchema = z.string().check(z.regex(/^#[0-9a-fA-F]{6}$/));
export type HexColor = z.infer<typeof HexColorSchema>;

/** Systems, regions, and UI system groupings used by the app and content check. */
export const TaxonomySchema = z.object({
  systems: z.array(
    z.object({
      id: SystemIdSchema,
      label: NonEmptyString,
      color: HexColorSchema,
      order: z.number(),
    }),
  ),
  regions: z.array(
    z.object({
      id: RegionIdSchema,
      label: NonEmptyString,
    }),
  ),
  uiGroups: z.array(
    z.object({
      id: NonEmptyString,
      label: NonEmptyString,
      systems: z.array(SystemIdSchema),
    }),
  ),
});
export type Taxonomy = z.infer<typeof TaxonomySchema>;

/** Three-element numeric vector `[x, y, z]`. */
export const Vec3Schema = z.tuple([z.number(), z.number(), z.number()]);
export type Vec3 = z.infer<typeof Vec3Schema>;

/** Generated bundle and mesh manifest emitted by the asset pipeline. */
export const ManifestSchema = z.object({
  version: z.literal(1),
  generatedAt: NonEmptyString,
  source: z.object({
    name: NonEmptyString,
    version: NonEmptyString,
    license: NonEmptyString,
  }),
  bundles: z.array(
    z.object({
      id: StructureIdString,
      file: z.string().check(z.regex(/^[a-z0-9-]+\.[0-9a-f]{8}\.glb$/)),
      bytes: z.number().check(z.int(), z.nonnegative()),
      sha256: z.string().check(z.regex(/^[0-9a-f]{64}$/)),
      meshIds: z.array(MeshIdString),
    }),
  ),
  preview: z.optional(
    z.object({
      file: z.string().check(z.regex(/^skeletal-preview\.[0-9a-f]{8}\.glb$/)),
      bytes: z.number().check(z.int(), z.nonnegative()),
      sha256: z.string().check(z.regex(/^[0-9a-f]{64}$/)),
      bounds: z.object({
        min: Vec3Schema,
        max: Vec3Schema,
      }),
    }),
  ),
  meshes: z.record(
    MeshIdString,
    z.object({
      bundle: StructureIdString,
      bounds: z.object({
        min: Vec3Schema,
        max: Vec3Schema,
      }),
      triangles: z.number().check(z.int(), z.nonnegative()),
      sizeClass: z.enum(['tiny', 'small', 'medium', 'large']),
    }),
  ),
});
export type Manifest = z.infer<typeof ManifestSchema>;

/** Lightweight structure metadata loaded at startup for search, tree, and materials. */
export const IndexEntrySchema = z.object({
  id: StructureIdString,
  system: SystemIdSchema,
  region: RegionIdSchema,
  group: z.optional(NonEmptyString),
  paired: z.boolean(),
  kind: KindSchema,
  tissue: TissueSchema,
  color: z.optional(HexColorSchema),
  names: z.object({
    common: NonEmptyString,
    latin: z.optional(NonEmptyString),
    synonyms: z.array(z.string()),
  }),
  featured: z.boolean(),
});
export type IndexEntry = z.infer<typeof IndexEntrySchema>;

/** Locale index JSON file containing all structure summaries. */
export const IndexFileSchema = z.object({
  locale: NonEmptyString,
  structures: z.array(IndexEntrySchema),
});
export type IndexFile = z.infer<typeof IndexFileSchema>;

/** Kind-specific structured anatomy details shown in the Inspector. */
export const DetailsSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('muscle'),
    origin: NonEmptyString,
    insertion: NonEmptyString,
    innervation: NonEmptyString,
    bloodSupply: NonEmptyString,
    action: NonEmptyString,
  }),
  z.object({
    kind: z.literal('bone'),
    boneType: z.enum(['long', 'short', 'flat', 'irregular', 'sesamoid']),
    articulatesWith: z.array(StructureIdString),
  }),
  z.object({
    kind: z.literal('facts'),
    facts: z.array(NonEmptyString).check(z.minLength(1)),
  }),
]);
export type Details = z.infer<typeof DetailsSchema>;

/** Attribution reference for a structure's written content. */
export const SourceSchema = z.object({
  title: NonEmptyString,
  url: z.url(),
  license: NonEmptyString,
});
export type Source = z.infer<typeof SourceSchema>;

/** Full descriptive entry stored per system under `content/<locale>/structures/`. */
export const StructureEntrySchema = z.object({
  id: StructureIdString,
  overview: z.optional(NonEmptyString),
  function: z.optional(NonEmptyString),
  details: z.optional(DetailsSchema),
  sources: z.array(SourceSchema).check(z.minLength(1)),
});
export type StructureEntry = z.infer<typeof StructureEntrySchema>;

/** Per-system descriptive structure content file. */
export const StructureFileSchema = z.object({
  system: SystemIdSchema,
  entries: z.array(StructureEntrySchema),
});
export type StructureFile = z.infer<typeof StructureFileSchema>;
