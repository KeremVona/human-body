const JOURNEY_HASH_RE = /^#journey\/([a-z0-9-]+)(?:\/([1-9][0-9]*))?$/;

/** Parses a 1-based `#journey/<id>` or `#journey/<id>/<stage>` hash into a zero-based stage index, or `null`. */
export function parseJourneyHash(
  hash: string,
): { id: string; stage: number } | null {
  const match = JOURNEY_HASH_RE.exec(hash);
  if (!match) return null;
  if (!match[2]) {
    return { id: match[1], stage: 0 };
  }
  const stage = Number.parseInt(match[2], 10) - 1;
  return Number.isSafeInteger(stage) && stage >= 0
    ? { id: match[1], stage }
    : null;
}

/** Formats a shareable `#journey/<id>` or `#journey/<id>/<1-based-stage>` hash. */
export function journeyHash(id: string, stageIndex?: number): string {
  if (stageIndex === undefined) {
    return `#journey/${id}`;
  }
  return `#journey/${id}/${stageIndex + 1}`;
}
