const TOUR_HASH_RE = /^#tour\/([a-z0-9-]+)\/([1-9][0-9]*)$/;

/** Parses a 1-based `#tour/<id>/<step>` hash into a zero-based step index, or `null`. */
export function parseTourHash(
  hash: string,
): { id: string; step: number } | null {
  const match = TOUR_HASH_RE.exec(hash);
  if (!match) return null;
  const step = Number.parseInt(match[2], 10) - 1;
  return Number.isSafeInteger(step) && step >= 0
    ? { id: match[1], step }
    : null;
}

/** Formats a shareable `#tour/<id>/<1-based-step>` hash. */
export function tourHash(id: string, stepIndex: number): string {
  return `#tour/${id}/${stepIndex + 1}`;
}
