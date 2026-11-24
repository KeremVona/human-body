import { z } from 'zod/mini';
import { MESH_ID_RE } from '../../data/ids';
import { MAX_OWN_PINS, type Pin } from './pinsSlice';

export const PINS_STORAGE_KEY = 'atlas.pins.v1';

const FiniteNumber = z.number().check(z.refine((n) => Number.isFinite(n)));

const StoredPinSchema = z.object({
  id: z.string().check(z.minLength(1)),
  meshId: z.string().check(z.regex(MESH_ID_RE)),
  local: z.tuple([FiniteNumber, FiniteNumber, FiniteNumber]),
  label: z.string().check(z.minLength(1), z.maxLength(80)),
  note: z.string().check(z.maxLength(500)),
  createdAt: FiniteNumber,
});

/** Loads persisted own pins from `localStorage['atlas.pins.v1']`, dropping invalid entries. */
export function loadPins(): Pin[] {
  try {
    const raw = localStorage.getItem(PINS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: Pin[] = [];
    for (const item of parsed) {
      if (out.length >= MAX_OWN_PINS) break;
      const res = StoredPinSchema.safeParse(item);
      if (!res.success) continue;
      if (
        item &&
        typeof item === 'object' &&
        'shared' in item &&
        item.shared === true
      ) {
        continue;
      }
      out.push(res.data);
    }
    return out;
  } catch {
    return [];
  }
}

/** Persists own pins (excluding shared pins) to `localStorage['atlas.pins.v1']`. */
export function savePins(pins: readonly Pin[]): boolean {
  try {
    const own = pins.filter((p) => !p.shared).slice(0, MAX_OWN_PINS);
    localStorage.setItem(PINS_STORAGE_KEY, JSON.stringify(own));
    return true;
  } catch {
    return false;
  }
}
