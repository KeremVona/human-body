import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {
  GLTFLoader,
  type GLTF,
} from 'three/examples/jsm/loaders/GLTFLoader.js';
import { fetchGltfBuffer, registerGltfHandlers } from './gltfCache';

type CacheEntry =
  | { status: 'pending'; promise: Promise<void> }
  | { status: 'ready'; gltf: GLTF }
  | { status: 'error'; error: unknown };

const cache = new Map<string, CacheEntry>();

function startLoad(url: string): CacheEntry {
  const existing = cache.get(url);
  if (existing) {
    return existing;
  }

  const promise = (async () => {
    try {
      const [buffer] = await Promise.all([
        fetchGltfBuffer(url),
        MeshoptDecoder.ready,
      ]);
      const loader = new GLTFLoader();
      loader.setMeshoptDecoder(MeshoptDecoder);
      const gltf = await new Promise<GLTF>((resolve, reject) => {
        loader.parse(buffer, url, resolve, reject);
      });
      cache.set(url, { status: 'ready', gltf });
    } catch (error) {
      cache.set(url, { status: 'error', error });
    }
  })();

  const entry: CacheEntry = { status: 'pending', promise };
  cache.set(url, entry);
  return entry;
}

/** Suspends while fetching and Meshopt-decoding a static GLB bundle, reusing early preloads. */
export function useGltf(url: string): GLTF {
  const entry = startLoad(url);
  if (entry.status === 'pending') {
    throw entry.promise;
  }
  if (entry.status === 'error') {
    throw entry.error;
  }
  return entry.gltf;
}

/** Suspends while fetching an optional GLB, returning `null` instead of throwing on error. */
export function useOptionalGltf(url: string): GLTF | null {
  const entry = startLoad(url);
  if (entry.status === 'pending') {
    throw entry.promise;
  }
  if (entry.status === 'error') {
    return null;
  }
  return entry.gltf;
}

/** Starts fetching and decoding a GLB bundle ahead of mount. */
export function preloadGltf(url: string): void {
  startLoad(url);
}

/** Drops a cached GLB bundle so error retry re-fetches cleanly. */
export function clearGltf(url: string): void {
  cache.delete(url);
}

registerGltfHandlers({ clear: clearGltf, preload: preloadGltf });
