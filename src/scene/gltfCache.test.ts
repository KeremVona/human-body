import { describe, expect, it, vi } from 'vitest';

describe('gltfCache', () => {
  it('starts an early fetch before handler registration and clears cleanly on retry', async () => {
    vi.resetModules();
    const fetchMock = vi.fn(
      async () => new Response(new ArrayBuffer(8), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { clearGltf, fetchGltfBuffer, preloadGltf, registerGltfHandlers } =
      await import('./gltfCache');

    const clear = vi.fn();
    const preload = vi.fn();

    preloadGltf('/models/skeletal.glb');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await fetchGltfBuffer('/models/skeletal.glb');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    registerGltfHandlers({ clear, preload });
    expect(preload).toHaveBeenCalledWith('/models/skeletal.glb');

    clearGltf('/models/skeletal.glb');
    expect(clear).toHaveBeenCalledWith('/models/skeletal.glb');
    vi.unstubAllGlobals();
  });
});
