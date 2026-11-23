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
