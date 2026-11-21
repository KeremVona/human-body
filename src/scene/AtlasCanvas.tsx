import { CameraControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import { Provider, useStore } from 'react-redux';
import { AgXToneMapping } from 'three';
import type { RootState } from '../app/store';
import { BundleErrorBoundary } from './BundleErrorBoundary';
import { BundleModel } from './BundleModel';
import { DebugStatsProbe, type RenderStats } from './DebugStats';
import { Lights } from './Lights';
import { MeshRegistryProvider, useMeshRegistry } from './meshRegistry';
import { SceneStateApplier } from './SceneStateApplier';

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
  const store = useStore<RootState>();
  const registry = useMeshRegistry();

  return (
    <Canvas
      aria-label="Interactive 3D human anatomy canvas"
      className="h-full w-full"
      frameloop={debug ? 'always' : 'demand'}
      camera={{ fov: 35, near: 0.01, far: 50, position: [0, 0, 3.2] }}
      gl={{ alpha: true, antialias: true, toneMapping: AgXToneMapping }}
      onCreated={({ raycaster }) => {
        Object.assign(raycaster, { firstHitOnly: true });
      }}
    >
      <Provider store={store}>
        <MeshRegistryProvider registry={registry}>
          <Lights />

          <CameraControls makeDefault />

          <SceneStateApplier />

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

          {debug && onDebugSample ? (
            <DebugStatsProbe onSample={onDebugSample} />
          ) : null}
        </MeshRegistryProvider>
      </Provider>
    </Canvas>
  );
}
