import { z } from 'zod/mini';
import {
  MESH_ID_RE,
  STRUCTURE_ID_RE,
  type MeshId,
  type StructureId,
} from '../../data/ids';
import { SystemIdSchema, type SystemId } from '../../data/schema';
import { AnchorSchema, type Anchor } from '../motion/schema';
import { TourViewStateSchema, type TourViewState } from '../tours/schema';

export type JourneyId = StructureId;
export type StageId = StructureId;
export type MeterId = StructureId;

const KebabIdString = z.string().check(z.regex(STRUCTURE_ID_RE));
const MeshIdString = z.string().check(z.regex(MESH_ID_RE));
const FiniteNumber = z.number().check(z.refine((n) => Number.isFinite(n)));
const PositiveFinite = FiniteNumber.check(
  z.refine((n) => n > 0, 'must be > 0'),
);
const UnitNumber = FiniteNumber.check(
  z.refine((n) => n >= 0 && n <= 1, 'must be in [0, 1]'),
);

export const LineSlicePathItemSchema = z
  .object({
    line: MeshIdString,
    from: z.optional(UnitNumber),
    to: z.optional(UnitNumber),
    reverse: z.optional(z.boolean()),
  })
  .check(
    z.refine(
      (item) => (item.from ?? 0) < (item.to ?? 1),
      'line slice requires from < to',
    ),
  );
export type LineSlicePathItem = z.infer<typeof LineSlicePathItemSchema>;

export const PathItemSchema = z.union([LineSlicePathItemSchema, AnchorSchema]);
export type PathItem = LineSlicePathItem | Anchor;

export const JourneyEventSchema = z
  .object({
    at: UnitNumber,
    kind: z.enum(['secrete', 'highlight']),
    mesh: MeshIdString,
    id: KebabIdString,
    via: z.optional(MeshIdString),
  })
  .check(
    z.refine(
      (ev) => !(ev.kind === 'highlight' && ev.via !== undefined),
      'highlight events must not set via',
    ),
  );
export type JourneyEvent = {
  at: number;
  kind: 'secrete' | 'highlight';
  mesh: MeshId;
  id: StructureId;
  via?: StructureId;
};

export const RealTimeSchema = z
  .object({
    min: PositiveFinite,
    max: PositiveFinite,
    unit: z.enum(['s', 'min', 'h']),
  })
  .check(
    z.refine((r) => r.min <= r.max, 'realTime requires min <= max'),
  );
export type RealTime = z.infer<typeof RealTimeSchema>;

export const LookSchema = z.enum([
  'bolus',
  'chyme',
  'stool',
  'blood-deoxy',
  'blood-oxy',
  'air-fresh',
  'air-stale',
]);
export type Look = z.infer<typeof LookSchema>;

export const JourneyMotionSchema = z.enum(['squeeze', 'churn', 'none']);
export type JourneyMotion = z.infer<typeof JourneyMotionSchema>;

export const RhythmSchema = z.union([
  z.object({
    motion: KebabIdString,
    mode: z.literal('play'),
  }),
  z
    .object({
      motion: KebabIdString,
      mode: z.literal('scrub'),
      from: UnitNumber,
      to: UnitNumber,
    })
    .check(
      z.refine((r) => r.from <= r.to, 'scrub rhythm requires from <= to'),
    ),
]);
export type Rhythm = z.infer<typeof RhythmSchema>;

export const CloseUpIdSchema = z.enum([
  'capillary',
  'lung-capillary',
  'alveolus',
]);
export type CloseUpId = z.infer<typeof CloseUpIdSchema>;

export const MeterDefSchema = z.object({
  id: KebabIdString,
  unit: z.enum(['%', 'relative']),
  max: PositiveFinite,
  decimals: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  monotonic: z.optional(z.boolean()),
  secondary: z.optional(KebabIdString),
});
export type MeterDef = {
  id: MeterId;
  unit: '%' | 'relative';
  max: number;
  decimals: 0 | 1 | 2;
  monotonic?: boolean;
  secondary?: MeterId;
};

export const JourneyStageSchema = z.object({
  id: KebabIdString,
  durationS: FiniteNumber.check(
    z.refine((n) => n >= 2 && n <= 30, 'durationS must be in [2, 30]'),
  ),
  realTime: z.optional(RealTimeSchema),
  look: LookSchema,
  radius: FiniteNumber.check(
    z.refine((n) => n > 0 && n <= 0.03, 'radius must be in (0, 0.03]'),
  ),
  motion: JourneyMotionSchema,
  rhythm: z.optional(RhythmSchema),
  closeUp: z.optional(CloseUpIdSchema),
  organs: z.array(MeshIdString),
  inside: z.optional(z.array(MeshIdString)),
  view: TourViewStateSchema,
  path: z.array(PathItemSchema).check(z.minLength(1)),
  modelled: z.boolean(),
  events: z.optional(z.array(JourneyEventSchema)),
  meters: z.record(KebabIdString, FiniteNumber),
});

export type JourneyStage = {
  id: StageId;
  durationS: number;
  realTime?: RealTime;
  look: Look;
  radius: number;
  motion: JourneyMotion;
  rhythm?: Rhythm;
  closeUp?: CloseUpId;
  organs: MeshId[];
  inside?: MeshId[];
  view: TourViewState;
  path: PathItem[];
  modelled: boolean;
  events?: JourneyEvent[];
  meters: Record<MeterId, number>;
};

export const JourneySchema = z
  .object({
    id: KebabIdString,
    systems: z.array(SystemIdSchema),
    meters: z.array(MeterDefSchema).check(z.minLength(1)),
    metersStart: z.optional(z.record(KebabIdString, FiniteNumber)),
    stages: z.array(JourneyStageSchema).check(z.minLength(2)),
  })
  .check(
    z.refine((j) => {
      const seen = new Set<string>();
      for (const stage of j.stages) {
        if (seen.has(stage.id)) return false;
        seen.add(stage.id);
      }
      return true;
    }, 'stage ids must be unique within a journey'),
    z.refine((j) => {
      const meterIds = new Set<string>();
      for (const m of j.meters) {
        if (meterIds.has(m.id)) return false;
        meterIds.add(m.id);
      }
      for (const m of j.meters) {
        if (m.secondary !== undefined) {
          if (m.secondary === m.id || !meterIds.has(m.secondary)) return false;
        }
      }
      return true;
    }, 'meter ids must be unique and secondary meters must reference another defined meter'),
  );

export type Journey = {
  id: JourneyId;
  systems: SystemId[];
  meters: MeterDef[];
  metersStart?: Record<MeterId, number>;
  stages: JourneyStage[];
};

export const JourneysFileSchema = z
  .object({
    journeys: z.array(JourneySchema),
  })
  .check(
    z.refine((f) => {
      const seen = new Set<string>();
      for (const j of f.journeys) {
        if (seen.has(j.id)) return false;
        seen.add(j.id);
      }
      return true;
    }, 'journey ids must be unique'),
  );
export type JourneysFile = {
  journeys: Journey[];
};

export const JourneyStageTextSchema = z.object({
  title: z.optional(z.string()),
  body: z.optional(z.string()),
  note: z.optional(z.string()),
});

export const MeterTextSchema = z.object({
  label: z.optional(z.string()),
  value: z.optional(z.string()),
});

export const JourneyTextsEntrySchema = z.object({
  title: z.optional(z.string()),
  summary: z.optional(z.string()),
  follow: z.optional(z.string()),
  inspectorLink: z.optional(z.string()),
  metersTitle: z.optional(z.string()),
  metersNote: z.optional(z.string()),
  meters: z.optional(z.record(KebabIdString, MeterTextSchema)),
  stages: z.optional(z.record(KebabIdString, JourneyStageTextSchema)),
  events: z.optional(z.record(KebabIdString, z.string())),
});

export const JourneyTextsFileSchema = z.object({
  journeys: z.record(KebabIdString, JourneyTextsEntrySchema),
});
export type JourneyTextsFile = z.infer<typeof JourneyTextsFileSchema>;
