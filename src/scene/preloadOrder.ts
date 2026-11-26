/** Starts GLB preloads sequentially so the lightweight preview lands before the full skeletal bundle. */
export async function startPreloads(
  doc: Document,
  preload: (url: string) => Promise<unknown>,
): Promise<void> {
  const previewUrl = doc
    .querySelector('meta[name="atlas-preview"]')
    ?.getAttribute('content');
  const skeletalUrl = doc
    .querySelector('meta[name="atlas-skeletal"]')
    ?.getAttribute('content');

  if (previewUrl) {
    try {
      await preload(previewUrl);
    } catch {
      // Proceed to full skeletal download even if preview preload fails.
    }
  }

  if (skeletalUrl) {
    try {
      await preload(skeletalUrl);
    } catch {
      // Scene loading handles HTTP/parse errors via ErrorBoundary.
    }
  }
}
