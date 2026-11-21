import { Bvh, CameraControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import { ACESFilmicToneMapping } from 'three';
import { BundleErrorBoundary } from './BundleErrorBoundary';
import { BundleModel } from './BundleModel';
import { DebugStatsProbe, type RenderStats } from './DebugStats';
import { MeshRegistryProvider, useMeshRegistry } from './meshRegistry';

export type CanvasBundle = {
  id: string;
  url: string;
};

type AtlasCanvasProps = {
  debug: boolean;
  bundles: CanvasBundle[];
  onBundleReady?: (bundleId: string, count: number) => void;
  onBundleError: (bundleId: string) => void;
  onDebugSample?: (stats: RenderStats) => void;
};

/** Full-bleed WebGL viewer hosting camera controls, lighting, BVH picking acceleration, and bundles. */
export function AtlasCanvas({
  debug,
  bundles,
  onBundleReady,
  onBundleError,
  onDebugSample,
}: AtlasCanvasProps) {
  const registry = useMeshRegistry();

  return (
    <Canvas
      aria-label="Interactive 3D human anatomy canvas"
      className="h-full w-full"
      frameloop={debug ? 'always' : 'demand'}
      camera={{ fov: 35, near: 0.01, far: 50, position: [0, 0, 3.2] }}
      gl={{ antialias: true, toneMapping: ACESFilmicToneMapping }}
    >
      <MeshRegistryProvider registry={registry}>
        <ambientLight intensity={0.35} />
        <directionalLight
          position={[-2, 3, 4]}
          intensity={1.8}
          color="#fff5e6"
        />
        <directionalLight
          position={[3, 1, 2]}
          intensity={0.7}
          color="#cfe2ff"
        />
        <directionalLight
          position={[0, 2, -4]}
          intensity={1.4}
          color="#ffffff"
        />

        <CameraControls makeDefault />

        <Bvh firstHitOnly>
          {bundles.map((bundle) => (
            <BundleErrorBoundary
              key={bundle.id}
              bundleId={bundle.id}
              onError={onBundleError}
            >
              <Suspense fallback={null}>
                <BundleModel
                  url={bundle.url}
                  bundleId={bundle.id}
                  onReady={(count) => onBundleReady?.(bundle.id, count)}
                />
              </Suspense>
            </BundleErrorBoundary>
          ))}
        </Bvh>

        {debug && onDebugSample ? (
          <DebugStatsProbe onSample={onDebugSample} />
        ) : null}
      </MeshRegistryProvider>
    </Canvas>
  );
}
