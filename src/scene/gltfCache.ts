type GltfHandlers = {
  clear: (url: string) => void;
  preload: (url: string) => void;
};

let handlers: GltfHandlers | null = null;
const bufferPromises = new Map<string, Promise<ArrayBuffer>>();

/** Fetches (and shares) raw GLB bytes early before the 3D scene loader finishes loading. */
export function fetchGltfBuffer(url: string): Promise<ArrayBuffer> {
  const existing = bufferPromises.get(url);
  if (existing) {
    return existing;
  }
  const promise = fetch(url).then((res) => {
    if (!res.ok) {
      throw new Error(`Failed to fetch GLB ${url} (${res.status})`);
    }
    return res.arrayBuffer();
  });
  bufferPromises.set(url, promise);
  return promise;
}

/** Registers runtime GLTF cache handlers once the 3D scene chunk loads. */
export function registerGltfHandlers(next: GltfHandlers): void {
  handlers = next;
  for (const url of bufferPromises.keys()) {
    next.preload(url);
  }
}

/** Clears cached GLTF data and prefetched bytes for `url` so retries re-fetch cleanly. */
export function clearGltf(url: string): void {
  bufferPromises.delete(url);
  handlers?.clear(url);
}

/** Preloads raw GLB bytes immediately or delegates to the registered GLTF cache. */
export function preloadGltf(url: string): void {
  if (handlers) {
    handlers.preload(url);
  } else {
    void fetchGltfBuffer(url).catch(() => {});
  }
}
