import { render } from '@testing-library/react';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
import { acceleratedRaycast } from 'three-mesh-bvh';
import { BundleModel } from './BundleModel';
import { createMeshRegistry, MeshRegistryProvider } from './meshRegistry';

const mocks = vi.hoisted(() => ({
  scene: null as unknown as Group,
  invalidate: vi.fn(),
}));

vi.mock('@react-three/drei', () => ({
  useGLTF: () => ({ scene: mocks.scene }),
}));

vi.mock('@react-three/fiber', () => ({
  useThree: (selector: (state: { invalidate: () => void }) => unknown) =>
    selector({ invalidate: mocks.invalidate }),
}));

function makeTestMesh(name: string): Mesh {
  const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
  mesh.name = name;
  return mesh;
}

it('attaches BVH bounds trees on mount and cleans up on unmount', () => {
  const femur = makeTestMesh('femur--l');
  mocks.scene = new Group();
  mocks.scene.add(femur);

  const registry = createMeshRegistry();
  const { unmount } = render(
    <MeshRegistryProvider registry={registry}>
      <BundleModel url="/models/skeletal.glb" bundleId="skeletal" />
    </MeshRegistryProvider>,
  );

  expect(registry.size).toBe(1);
  expect(femur.geometry.boundsTree).toBeDefined();
  expect(femur.raycast).toBe(acceleratedRaycast);

  unmount();
  expect(registry.size).toBe(0);
  expect(femur.geometry.boundsTree).toBeNull();
  expect(femur.raycast).toBe(Mesh.prototype.raycast);
});

it('rolls back partial registrations and BVH if duplicate meshId throws', () => {
  const first = makeTestMesh('sternum');
  const duplicate = makeTestMesh('femur--l');
  mocks.scene = new Group();
  mocks.scene.add(first, duplicate);

  const registry = createMeshRegistry();
  registry.register('femur--l', makeTestMesh('femur--l'));

  vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    expect(() =>
      render(
        <MeshRegistryProvider registry={registry}>
          <BundleModel url="/models/skeletal.glb" bundleId="skeletal" />
        </MeshRegistryProvider>,
      ),
    ).toThrow('duplicate mesh id "femur--l"');
  } finally {
    vi.restoreAllMocks();
  }

  expect(registry.get('sternum')).toBeUndefined();
  expect(registry.size).toBe(1);
  expect(first.geometry.boundsTree).toBeNull();
  expect(first.raycast).toBe(Mesh.prototype.raycast);
});
