import { render } from '@testing-library/react';
import { Component, Suspense, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const gltfMocks = vi.hoisted(() => ({
  parse: vi.fn(),
  setMeshoptDecoder: vi.fn(),
}));

vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
  GLTFLoader: class {
    setMeshoptDecoder = gltfMocks.setMeshoptDecoder;
    parse = gltfMocks.parse;
  },
}));

vi.mock('three/examples/jsm/libs/meshopt_decoder.module.js', () => ({
  MeshoptDecoder: { ready: Promise.resolve() },
}));

class TestBoundary extends Component<
  { children: ReactNode; onError: (e: unknown) => void },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: unknown) {
    this.props.onError(error);
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('gltf', () => {
  it('parses prefetched GLB bytes with MeshoptDecoder and suspends cleanly', async () => {
    vi.resetModules();
    const fakeScene = { name: 'skeleton' };
    gltfMocks.parse.mockImplementation((_buf, _url, onLoad) => {
      onLoad({ scene: fakeScene });
    });
    const fetchMock = vi.fn(
      async () => new Response(new ArrayBuffer(16), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { useGltf } = await import('./gltf');
    const seen: unknown[] = [];

    function Probe({ url }: { url: string }) {
      seen.push(useGltf(url).scene);
      return null;
    }

    render(
      <Suspense fallback={null}>
        <Probe url="/models/skeletal.glb" />
      </Suspense>,
    );

    await vi.waitFor(() => {
      expect(seen).toEqual([fakeScene]);
    });
    expect(gltfMocks.setMeshoptDecoder).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects HTTP errors to error boundary and re-fetches after clearGltf', async () => {
    vi.resetModules();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(new ArrayBuffer(8), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    gltfMocks.parse.mockImplementation((_buf, _url, onLoad) => {
      onLoad({ scene: { name: 'recovered' } });
    });

    const { useGltf } = await import('./gltf');
    const { clearGltf } = await import('./gltfCache');
    const errors: unknown[] = [];
    const loaded: unknown[] = [];

    function Probe({ url }: { url: string }) {
      loaded.push(useGltf(url));
      return null;
    }

    const { rerender } = render(
      <TestBoundary onError={(e) => errors.push(e)}>
        <Suspense fallback={null}>
          <Probe url="/models/skeletal.glb" />
        </Suspense>
      </TestBoundary>,
    );

    await vi.waitFor(() => {
      expect(errors).toHaveLength(1);
    });

    clearGltf('/models/skeletal.glb');
    rerender(
      <Suspense fallback={null}>
        <Probe url="/models/skeletal.glb" />
      </Suspense>,
    );

    await vi.waitFor(() => {
      expect(loaded).toHaveLength(1);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    errorSpy.mockRestore();
  });
});
