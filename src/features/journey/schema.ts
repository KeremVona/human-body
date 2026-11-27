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

const KebabIdString = z.string().check(z.regex(STRUCTURE_ID_RE));
const MeshIdString = z.string().check(z.regex(MESH_ID_RE));
const FiniteNumber = z.number().check(z.refine((n) => Number.isFinite(n)));
const PositiveFinite = FiniteNumber.check(
  z.refine((n) => n > 0, 'must be > 0'),
);
const UnitNumber = FiniteNumber.check(
  z.refine((n) => n >= 0 && n <= 1, 'must be in [0, 1]'),
);
const Percent = FiniteNumber.check(
  z.refine((n) => n >= 0 && n <= 100, 'must be in [0, 100]'),
);

export const LineSlicePathItemSchema = z
  .object({
    line: KebabIdString,
    from: z.optional(UnitNumber),
    to: z.optional(UnitNumber),
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

export const JourneyEventSchema = z.object({
  at: UnitNumber,
  kind: z.literal('secrete'),
  mesh: MeshIdString,
  id: KebabIdString,
  via: z.optional(KebabIdString),
});
export type JourneyEvent = {
  at: number;
  kind: 'secrete';
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

export const NutrientsSchema = z.object({
  carbs: Percent,
  protein: Percent,
  fat: Percent,
  water: Percent,
  absorbed: Percent,
});
export type Nutrients = z.infer<typeof NutrientsSchema>;

export const FoodStateSchema = z.enum(['bolus', 'chyme', 'stool']);
export type FoodState = z.infer<typeof FoodStateSchema>;

export const JourneyMotionSchema = z.enum(['squeeze', 'churn', 'none']);
export type JourneyMotion = z.infer<typeof JourneyMotionSchema>;

export const JourneyStageSchema = z.object({
  id: KebabIdString,
  durationS: FiniteNumber.check(
    z.refine((n) => n >= 2 && n <= 30, 'durationS must be in [2, 30]'),
  ),
  realTime: z.optional(RealTimeSchema),
  food: FoodStateSchema,
  radius: FiniteNumber.check(
    z.refine((n) => n > 0 && n <= 0.03, 'radius must be in (0, 0.03]'),
  ),
  motion: JourneyMotionSchema,
  organs: z.array(MeshIdString),
  inside: z.optional(z.array(MeshIdString)),
  view: TourViewStateSchema,
  path: z.array(PathItemSchema).check(z.minLength(1)),
  modelled: z.boolean(),
  events: z.optional(z.array(JourneyEventSchema)),
  nutrients: NutrientsSchema,
});

export type JourneyStage = {
  id: StageId;
  durationS: number;
  realTime?: RealTime;
  food: FoodState;
  radius: number;
  motion: JourneyMotion;
  organs: MeshId[];
  inside?: MeshId[];
  view: TourViewState;
  path: PathItem[];
  modelled: boolean;
  events?: JourneyEvent[];
  nutrients: Nutrients;
};

export const JourneySchema = z
  .object({
    id: KebabIdString,
    systems: z.array(SystemIdSchema),
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
  );

export type Journey = {
  id: JourneyId;
  systems: SystemId[];
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

export const JourneyTextsEntrySchema = z.object({
  title: z.optional(z.string()),
  summary: z.optional(z.string()),
  stages: z.optional(z.record(KebabIdString, JourneyStageTextSchema)),
  events: z.optional(z.record(KebabIdString, z.string())),
});

export const JourneyTextsFileSchema = z.object({
  journeys: z.record(KebabIdString, JourneyTextsEntrySchema),
});
export type JourneyTextsFile = z.infer<typeof JourneyTextsFileSchema>;
