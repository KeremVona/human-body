import { z } from 'zod/mini';
import type { MeshId } from '../../data/ids';
import { SystemIdSchema, type SystemId } from '../../data/schema';

export type SharedPin = {
  m: MeshId;
  l: [number, number, number];
  t: string;
  n?: string;
};

export type ViewStateV1 = {
  c: [number, number, number, number, number, number];
  s: SystemId[];
  o?: Partial<Record<SystemId, number>>;
  h: MeshId[];
  i?: MeshId[];
  f?: MeshId[];
  sel: MeshId[];
  x?: [0 | 1 | 2, number, 0 | 1];
  p?: SharedPin[];
};

const FiniteNumber = z.number().check(z.refine((n) => Number.isFinite(n)));
const UnitNumber = z
  .number()
  .check(z.refine((n) => Number.isFinite(n) && n >= 0 && n <= 1));

export const SharedPinSchema = z.object({
  m: z.string().check(z.minLength(1)),
  l: z.tuple([FiniteNumber, FiniteNumber, FiniteNumber]),
  t: z.string().check(z.minLength(1), z.maxLength(80)),
  n: z.optional(z.string().check(z.maxLength(500))),
});

export const ViewStateV1Schema = z.object({
  c: z.tuple([
    FiniteNumber,
    FiniteNumber,
    FiniteNumber,
    FiniteNumber,
    FiniteNumber,
    FiniteNumber,
  ]),
  s: z.array(SystemIdSchema),
  o: z.optional(z.partialRecord(SystemIdSchema, UnitNumber)),
  h: z.array(z.string().check(z.minLength(1))),
  i: z.optional(z.array(z.string().check(z.minLength(1)))),
  f: z.optional(z.array(z.string().check(z.minLength(1)))),
  sel: z.array(z.string().check(z.minLength(1))),
  x: z.optional(
    z.tuple([
      z.union([z.literal(0), z.literal(1), z.literal(2)]),
      UnitNumber,
      z.union([z.literal(0), z.literal(1)]),
    ]),
  ),
  p: z.optional(z.array(SharedPinSchema).check(z.maxLength(200))),
});
