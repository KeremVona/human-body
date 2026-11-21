/** Download status for an individual asset bundle. */
export type BundleStatus = 'idle' | 'loading' | 'ready' | 'error';

/** Default progressive bundle download sequence (§8.6). */
export const BUNDLE_LOAD_ORDER: readonly string[] = [
  'skeletal',
  'muscular',
  'organs',
  'cardiovascular',
];

/**
 * Selects the next bundle id to download:
 * 1) None while any bundle is already `'loading'`.
 * 2) User-requested `'idle'` bundles first, even if `skeletal` errored.
 * 3) Background loads in `order`, then any remaining manifest bundles, gated on `skeletal` not waiting in error.
 */
export function nextBundleToLoad(
  bundles: Record<string, BundleStatus>,
  order: readonly string[],
  requested: readonly string[],
): string | null {
  for (const status of Object.values(bundles)) {
    if (status === 'loading') return null;
  }

  for (const id of requested) {
    if (bundles[id] === 'idle') return id;
  }

  const skeletalStatus = bundles.skeletal;
  if (skeletalStatus !== 'ready') {
    return skeletalStatus === 'idle' ? 'skeletal' : null;
  }

  for (const id of order) {
    if (bundles[id] === 'idle') return id;
  }

  for (const [id, status] of Object.entries(bundles)) {
    if (status === 'idle') return id;
  }

  return null;
}
