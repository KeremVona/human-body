import { cleanup, render } from '@testing-library/react';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PreviewModel } from './PreviewModel';
import { previewState } from './previewState';

const mocks = vi.hoisted(() => ({
  gltf: null as { scene: Group } | null,
  invalidate: vi.fn(),
  clearGltf: vi.fn(),
  frameCallback: null as ((state: unknown, delta: number) => void) | null,
}));

vi.mock('./gltf', () => ({
  useOptionalGltf: () => mocks.gltf,
}));

vi.mock('./gltfCache', () => ({
  clearGltf: (...args: unknown[]) => mocks.clearGltf(...args),
}));

vi.mock('@react-three/fiber', () => ({
  useThree: (selector: (state: { invalidate: () => void }) => unknown) =>
    selector({ invalidate: mocks.invalidate }),
  useFrame: (cb: (state: unknown, delta: number) => void) => {
    mocks.frameCallback = cb;
  },
}));

function stubJsdomGroupMethods(): {
  add: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
} {
  const add = vi.fn();
  const remove = vi.fn();
  Object.defineProperty(HTMLElement.prototype, 'add', {
    configurable: true,
    value: add,
  });
  Object.defineProperty(HTMLElement.prototype, 'remove', {
    configurable: true,
    value: remove,
  });
  return { add, remove };
}

afterEach(() => {
  cleanup();
  previewState.set('loading');
  mocks.invalidate.mockClear();
  mocks.clearGltf.mockClear();
  mocks.frameCallback = null;
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).add;
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).remove;
  vi.restoreAllMocks();
});

function makePreviewScene(): Group {
  const scene = new Group();
  const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
  mesh.name = 'skeletal-preview';
  scene.add(mesh);
  return scene;
}

describe('PreviewModel', () => {
  it('mounts with noop raycast, enters shown state, fades over 300ms, and clears cache on gone', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    const { add } = stubJsdomGroupMethods();
    mocks.gltf = { scene: makePreviewScene() };

    const { rerender, unmount } = render(
      <PreviewModel url="/models/preview.glb" skeletalReady={false} />,
    );

    expect(previewState.get()).toBe('shown');
    expect(mocks.invalidate).toHaveBeenCalled();

    const mountedGroup = add.mock.calls[0]?.[0] as Group;
    const mountedMesh = mountedGroup.children[0] as Mesh;
    expect(mountedMesh.raycast).not.toBe(Mesh.prototype.raycast);

    rerender(<PreviewModel url="/models/preview.glb" skeletalReady />);
    expect(previewState.get()).toBe('fading');

    // Step frame timer past 300 ms in 100 ms chunks (delta is clamped to 0.1)
    mocks.frameCallback?.({}, 0.1);
    mocks.frameCallback?.({}, 0.1);
    mocks.frameCallback?.({}, 0.1);
    expect(previewState.get()).toBe('gone');

    unmount();
    expect(mocks.clearGltf).toHaveBeenCalledWith('/models/preview.glb');
  });

  it('transitions straight to gone under reduced motion without fading', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    stubJsdomGroupMethods();
    mocks.gltf = { scene: makePreviewScene() };

    const { rerender } = render(
      <PreviewModel url="/models/preview.glb" skeletalReady={false} />,
    );
    expect(previewState.get()).toBe('shown');

    rerender(<PreviewModel url="/models/preview.glb" skeletalReady />);
    expect(previewState.get()).toBe('gone');
  });

  it('transitions loading -> gone cleanly when optional preview returns null', () => {
    mocks.gltf = null;
    const { container } = render(
      <PreviewModel url="/models/preview.glb" skeletalReady={false} />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(previewState.get()).toBe('gone');
  });
});
