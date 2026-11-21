import { ManifestSchema, type Manifest } from './schema';

let manifestPromise: Promise<Manifest> | null = null;

/** Fetches and caches `models/manifest.json` relative to Vite's `BASE_URL`. */
export function loadManifest(): Promise<Manifest> {
  if (!manifestPromise) {
    manifestPromise = fetch(`${import.meta.env.BASE_URL}models/manifest.json`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch manifest.json (${res.status})`);
        }
        return res.json();
      })
      .then((json) => ManifestSchema.parse(json))
      .catch((err) => {
        manifestPromise = null;
        throw err;
      });
  }
  return manifestPromise;
}

/** Resolves a bundle filename from `manifest.json` to its runtime URL. */
export function bundleUrl(file: string): string {
  return `${import.meta.env.BASE_URL}models/${file}`;
}
