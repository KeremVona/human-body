import { z } from 'zod';
import { MESH_ID_RE, STRUCTURE_ID_RE } from '../../src/data/ids';
import {
  HexColorSchema,
  KindSchema,
  RegionIdSchema,
  SystemIdSchema,
  TissueSchema,
} from '../../src/data/schema';

const MeshIdString = z.string().regex(MESH_ID_RE);
const BundleIdString = z.string().regex(STRUCTURE_ID_RE);

/** Selection rule mapping Blender objects in a bundle to system, region, kind, and tissue. */
export const PipelineRuleSchema = z.object({
  system: SystemIdSchema,
  region: RegionIdSchema,
  kind: KindSchema,
  tissue: TissueSchema,
  color: z.optional(HexColorSchema),
  types: z.array(z.enum(['MESH', 'CURVE'])).default(['MESH']),
  match: z.object({
    collection: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
  }),
  exclude: z.array(z.string().min(1)).optional(),
});
export type PipelineRule = z.infer<typeof PipelineRuleSchema>;

const OrientationChecksSchema = z.object({
  above: z.array(z.tuple([MeshIdString, MeshIdString])).default([]),
  anterior: z.array(z.tuple([MeshIdString, MeshIdString])).default([]),
  leftSide: z.array(MeshIdString).default([]),
});

const OrientationSchema = z.object({
  rotateZDeg: z.number().default(0),
  scale: z.number().positive().default(1),
  checks: OrientationChecksSchema.prefault({}),
});

const SimplifySchema = z.object({
  ratio: z.number().gt(0).lte(1).default(1),
  error: z.number().nonnegative().default(0.001),
});

const PreviewSchema = z.object({
  from: BundleIdString.default('skeletal'),
  ratio: z.number().gt(0).lte(1).default(0.12),
  error: z.number().nonnegative().default(0.01),
  maxBytes: z.number().int().positive().default(600_000),
});

const CenterlineCurveRuleSchema = z.object({
  id: MeshIdString,
  source: z.string().min(1),
  reverse: z.boolean().default(false),
});

const CenterlineMeshRuleSchema = z.discriminatedUnion('method', [
  z.object({
    id: MeshIdString,
    method: z.literal('slice'),
    axis: z.enum(['x', 'y', 'z']),
    bins: z.number().int().positive(),
    direction: z.union([z.literal(1), z.literal(-1)]),
  }),
  z.object({
    id: MeshIdString,
    method: z.literal('polar'),
    plane: z.enum(['xy', 'xz', 'yz']),
    center: z.tuple([z.number(), z.number(), z.number()]),
    bins: z.number().int().positive(),
    startDeg: z.number(),
    sweep: z.union([z.literal(1), z.literal(-1)]),
  }),
]);

const CenterlinesConfigSchema = z.object({
  curves: z.array(CenterlineCurveRuleSchema).default([]),
  meshes: z.array(CenterlineMeshRuleSchema).default([]),
});

/** Configuration driving object selection, normalization, optimization, and verification. */
export const PipelineConfigSchema = z
  .object({
    source: z.object({
      file: z.string().min(1),
      name: z.string().min(1),
      version: z.string().min(1),
      license: z.string().min(1),
    }),
    originBundle: BundleIdString.default('skeletal'),
    orientation: OrientationSchema.prefault({}),
    simplify: SimplifySchema.prefault({}),
    preview: PreviewSchema.prefault({}),
    centerlines: CenterlinesConfigSchema.optional(),
    budgets: z.object({
      perBundleBytes: z.record(z.string(), z.number().int().positive()),
      defaultBundleBytes: z.number().int().positive(),
      totalBytes: z.number().int().positive(),
    }),
    bundles: z.array(
      z.object({
        id: BundleIdString,
        rules: z.array(PipelineRuleSchema),
      }),
    ),
  })
  .refine((cfg) => cfg.bundles.some((b) => b.id === cfg.originBundle), {
    message: 'originBundle must equal an entry in bundles[].id',
    path: ['originBundle'],
  });
export type PipelineConfig = z.infer<typeof PipelineConfigSchema>;
