import { z } from 'zod/mini';
import { MESH_ID_RE } from '../../data/ids';
import { SystemIdSchema } from '../../data/schema';

const NonEmptyString = z.string().check(z.minLength(1));
const MeshIdString = z.string().check(z.regex(MESH_ID_RE));
const FiniteNumber = z.number().check(z.refine((n) => Number.isFinite(n)));
const UnitNumber = FiniteNumber.check(
  z.refine((n) => n >= 0 && n <= 1, 'must be in [0, 1]'),
);
const DegreeNumber = FiniteNumber.check(
  z.refine((n) => n >= -180 && n <= 180, 'must be in [-180, 180]'),
);

export const PresetSchema = z.enum([
  'anterior',
  'posterior',
  'left',
  'right',
  'superior',
  'inferior',
]);

export const AnchorSchema = z.object({
  mesh: MeshIdString,
  anchor: z.tuple([UnitNumber, UnitNumber, UnitNumber]),
});
export type Anchor = z.infer<typeof AnchorSchema>;

export const HingeDefSchema = z.object({
  id: NonEmptyString,
  kind: z.literal('hinge'),
  label: NonEmptyString,
  view: PresetSchema,
  systems: z.array(SystemIdSchema).check(z.minLength(1)),
  moving: z.array(MeshIdString),
  ghost: z.array(MeshIdString),
  agonists: z.object({
    flex: z.array(MeshIdString),
    extend: z.array(MeshIdString),
  }),
  pivot: AnchorSchema,
  axis: z
    .tuple([FiniteNumber, FiniteNumber, FiniteNumber])
    .check(
      z.refine(
        (a) => a[0] * a[0] + a[1] * a[1] + a[2] * a[2] > 0,
        'axis must be non-zero',
      ),
    ),
  range: z
    .tuple([DegreeNumber, DegreeNumber])
    .check(z.refine((r) => r[0] < r[1], 'range min must be less than max')),
  periodS: FiniteNumber.check(
    z.refine((n) => n >= 1 && n <= 20, 'periodS must be in [1, 20]'),
  ),
});
export type HingeDef = z.infer<typeof HingeDefSchema>;

export const PulseGroupSchema = z.object({
  meshes: z.array(MeshIdString).check(z.minLength(1)),
  phase: UnitNumber,
});

export const PulseDefSchema = z.object({
  id: NonEmptyString,
  kind: z.literal('pulse'),
  label: NonEmptyString,
  view: PresetSchema,
  systems: z.array(SystemIdSchema).check(z.minLength(1)),
  groups: z.array(PulseGroupSchema).check(z.minLength(1)),
  bpm: FiniteNumber.check(
    z.refine((n) => n >= 40 && n <= 180, 'bpm must be in [40, 180]'),
  ),
  amplitude: FiniteNumber.check(
    z.refine((n) => n > 0 && n <= 0.15, 'amplitude must be in (0, 0.15]'),
  ),
  center: z.optional(AnchorSchema),
});
export type PulseDef = z.infer<typeof PulseDefSchema>;

export const MotionDefSchema = z.discriminatedUnion('kind', [
  HingeDefSchema,
  PulseDefSchema,
]);
export type MotionDef = z.infer<typeof MotionDefSchema>;

export const MotionsFileSchema = z
  .object({
    motions: z.array(MotionDefSchema),
  })
  .check(
    z.refine(
      (file) =>
        new Set(file.motions.map((m) => m.id)).size === file.motions.length,
      'duplicate motion ids',
    ),
  );
export type MotionsFile = z.infer<typeof MotionsFileSchema>;
