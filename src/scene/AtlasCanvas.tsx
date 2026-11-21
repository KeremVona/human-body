import { CameraControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import { Provider, useStore } from 'react-redux';
import { AgXToneMapping } from 'three';
import { useAppDispatch } from '../app/hooks';
import type { RootState } from '../app/store';
import {
  hovered,
  selectionCleared,
} from '../features/selection/selectionSlice';
import { BundleErrorBoundary } from './BundleErrorBoundary';
import { BundleModel } from './BundleModel';
import { DebugStatsProbe, type RenderStats } from './DebugStats';
import { Lights } from './Lights';
import { MeshRegistryProvider, useMeshRegistry } from './meshRegistry';
import { Picking, type ContextRequest } from './Picking';
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
  onContextRequest?: (request: ContextRequest) => void;
};

const noopContextRequest = () => {};

/** Full-bleed WebGL viewer hosting camera controls, lighting, BVH picking acceleration, and bundles. */
export function AtlasCanvas({
  debug,
  bundles,
  onBundleReady,
  onBundleError,
  onDebugSample,
  onContextRequest,
}: AtlasCanvasProps) {
  const store = useStore<RootState>();
  const dispatch = useAppDispatch();
  const registry = useMeshRegistry();

  return (
    <div
      className="h-full w-full"
      onContextMenu={(e) => e.preventDefault()}
      onPointerLeave={() => {
        if (store.getState().selection.hoveredId !== null) {
          dispatch(hovered(null));
        }
      }}
    >
      <Canvas
        aria-label="Interactive 3D human anatomy canvas"
        className="h-full w-full"
        frameloop={debug ? 'always' : 'demand'}
        camera={{ fov: 35, near: 0.01, far: 50, position: [0, 0, 3.2] }}
        gl={{ alpha: true, antialias: true, toneMapping: AgXToneMapping }}
        onPointerMissed={(e) => {
          if (!('button' in e) || e.button === 0) {
            dispatch(selectionCleared());
          }
        }}
        onCreated={({ raycaster }) => {
          Object.assign(raycaster, { firstHitOnly: true });
        }}
      >
        <Provider store={store}>
          <MeshRegistryProvider registry={registry}>
            <Lights />

            <CameraControls makeDefault />

            <SceneStateApplier />

            <Picking onContextRequest={onContextRequest ?? noopContextRequest}>
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
            </Picking>

            {debug && onDebugSample ? (
              <DebugStatsProbe onSample={onDebugSample} />
            ) : null}
          </MeshRegistryProvider>
        </Provider>
      </Canvas>
    </div>
  );
}
