import { useThree } from '@react-three/fiber';
import { useEffect, type JSX } from 'react';
import {
  type BufferGeometry,
  Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PMREMGenerator,
  PlaneGeometry,
  RingGeometry,
  Scene,
} from 'three';

type StudioPanelSpec = {
  geometry: BufferGeometry;
  color: string;
  intensity: number;
  position: [number, number, number];
  scale?: [number, number, number];
};

function createStudioEnvironmentScene(): {
  scene: Scene;
  dispose: () => void;
} {
  const scene = new Scene();
  const specs: StudioPanelSpec[] = [
    {
      geometry: new PlaneGeometry(6, 6),
      color: '#fff8ef',
      intensity: 1.6,
      position: [-3, 4, 4],
    },
    {
      geometry: new PlaneGeometry(5, 5),
      color: '#d6e6ff',
      intensity: 0.9,
      position: [4, 2, 2],
    },
    {
      geometry: new RingGeometry(0.25, 0.5, 32),
      color: '#ffffff',
      intensity: 1.4,
      position: [0, 3, -4],
      scale: [4, 4, 1],
    },
  ];

  const materials: MeshBasicMaterial[] = [];
  for (const spec of specs) {
    const mat = new MeshBasicMaterial({
      color: new Color(spec.color).multiplyScalar(spec.intensity),
      side: DoubleSide,
      toneMapped: false,
    });
    materials.push(mat);
    const mesh = new Mesh(spec.geometry, mat);
    mesh.position.set(...spec.position);
    if (spec.scale) {
      mesh.scale.set(...spec.scale);
    }
    mesh.lookAt(0, 0, 0);
    scene.add(mesh);
  }

  return {
    scene,
    dispose: () => {
      for (const spec of specs) spec.geometry.dispose();
      for (const mat of materials) mat.dispose();
    },
  };
}

/** Studio three-point lighting plus procedural PMREM IBL reflections (§5.2). */
export function Lights(): JSX.Element {
  const get = useThree((s) => s.get);

  useEffect(() => {
    const { gl, scene, invalidate } = get();
    const pmrem = new PMREMGenerator(gl);
    const studio = createStudioEnvironmentScene();
    const envTarget = pmrem.fromScene(studio.scene, 0.04, 0.1, 100, {
      size: 64,
    });
    studio.dispose();
    pmrem.dispose();

    const target = scene as Scene;
    const prevEnv = target.environment;
    target.environment = envTarget.texture;
    invalidate();

    return () => {
      if (target.environment === envTarget.texture) {
        target.environment = prevEnv;
      }
      envTarget.dispose();
    };
  }, [get]);

  return (
    <>
      <directionalLight position={[-2, 3, 4]} intensity={1.8} color="#fff5e6" />
      <directionalLight position={[3, 1, 2]} intensity={0.7} color="#cfe2ff" />
      <directionalLight position={[0, 2, -4]} intensity={1.5} color="#ffffff" />
    </>
  );
}
