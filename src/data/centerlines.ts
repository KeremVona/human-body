import { z } from 'zod/mini';
import { STRUCTURE_ID_RE } from './ids';
import { Vec3Schema } from './schema';

const CenterlineIdString = z.string().check(z.regex(STRUCTURE_ID_RE));

/** Precomputed 3D anatomical centerlines emitted by the asset pipeline. */
export const CenterlinesFileSchema = z.object({
  version: z.literal(1),
  lines: z.record(
    CenterlineIdString,
    z.array(Vec3Schema).check(z.minLength(2)),
  ),
});
export type CenterlinesFile = z.infer<typeof CenterlinesFileSchema>;
