import { z } from 'zod/mini';
import { STRUCTURE_ID_RE, type StructureId } from '../../data/ids';
import { SystemIdSchema, type SystemId } from '../../data/schema';
import { ViewStateV1Schema, type ViewStateV1 } from '../share/viewState';

export type TourId = StructureId;
export type StepId = StructureId;

const KebabIdString = z.string().check(z.regex(STRUCTURE_ID_RE));
const NonEmptyString = z.string().check(z.minLength(1));
const UnitNumber = z
  .number()
  .check(z.refine((n) => Number.isFinite(n) && n >= 0 && n <= 1));

const { c, s, o, h, i, f, sel, x } = ViewStateV1Schema.def.shape;

/** View state embedded in a tour step (`ViewStateV1` without pins `p`). */
export const TourViewStateSchema = z.strictObject({
  c,
  s,
  o,
  h,
  i,
  f,
  sel,
  x,
});
export type TourViewState = Omit<ViewStateV1, 'p'>;

export const TourMotionSchema = z.object({
  id: NonEmptyString,
  phase: z.optional(UnitNumber),
  play: z.optional(z.boolean()),
});
export type TourMotion = z.infer<typeof TourMotionSchema>;

export const TourStepSchema = z.object({
  id: KebabIdString,
  view: TourViewStateSchema,
  motion: z.optional(TourMotionSchema),
});
export type TourStep = {
  id: StepId;
  view: TourViewState;
  motion?: TourMotion;
};

export const TourSchema = z.object({
  id: KebabIdString,
  systems: z.optional(z.array(SystemIdSchema)),
  steps: z.array(TourStepSchema),
});
export type Tour = {
  id: TourId;
  systems?: SystemId[];
  steps: TourStep[];
};

export const ToursFileSchema = z.object({
  tours: z.array(TourSchema),
});
export type ToursFile = {
  tours: Tour[];
};

export const TourStepTextSchema = z.object({
  title: z.optional(z.string()),
  body: z.optional(z.string()),
});
export type TourStepText = z.infer<typeof TourStepTextSchema>;

export const TourLocaleEntrySchema = z.object({
  title: z.optional(z.string()),
  summary: z.optional(z.string()),
  steps: z.optional(z.record(z.string(), TourStepTextSchema)),
});
export type TourLocaleEntry = z.infer<typeof TourLocaleEntrySchema>;

export const TourTextsFileSchema = z.object({
  tours: z.record(z.string(), TourLocaleEntrySchema),
});
export type TourTextsFile = z.infer<typeof TourTextsFileSchema>;
