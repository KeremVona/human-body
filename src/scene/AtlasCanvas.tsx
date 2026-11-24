import { Canvas } from '@react-three/fiber';
import { lazy, Suspense, useContext } from 'react';
import { Provider, useStore } from 'react-redux';
import { AgXToneMapping } from 'three';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import type { RootState } from '../app/store';
import {
  hovered,
  selectionCleared,
} from '../features/selection/selectionSlice';
import { useT } from '../i18n/t';
import { BundleErrorBoundary } from './BundleErrorBoundary';
import { BundleModel } from './BundleModel';
import { CameraApiContext, CameraApiProvider } from './camera';
import { CameraRig } from './CameraRig';
import { DebugStatsProbe, type RenderStats } from './DebugStats';
import { Effects } from './Effects';
import { lastHit } from './lastHit';
import { Lights } from './Lights';
import { MeshRegistryProvider, useMeshRegistry } from './meshRegistry';
import { Picking, type ContextRequest } from './Picking';
import { SceneStateApplier } from './SceneStateApplier';
import { SectionController } from './SectionController';

const PinProbe = lazy(() =>
  import('./PinProbe').then((m) => ({ default: m.PinProbe })),
);
const MotionPlayer = lazy(() =>
  import('./MotionPlayer').then((m) => ({ default: m.MotionPlayer })),
);

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
  const tr = useT();
  const hasPins = useAppSelector((s) => s.pins.items.length > 0);
  const hasMotion = useAppSelector((s) => s.motion.activeId !== null);
  const registry = useMeshRegistry();
  const cameraController = useContext(CameraApiContext);

  return (
    <div
      role="region"
      aria-label={tr('app.canvasAria')}
      className="h-full w-full"
      onContextMenu={(e) => e.preventDefault()}
      onPointerLeave={() => {
        lastHit.set(null);
        if (store.getState().selection.hoveredId !== null) {
          dispatch(hovered(null));
        }
      }}
    >
      <Canvas
        className="h-full w-full"
        dpr={[1, 1.5]}
        frameloop={debug ? 'always' : 'demand'}
        camera={{ fov: 35, near: 0.01, far: 100, position: [0, 0, 3.2] }}
        gl={{ alpha: true, antialias: true, toneMapping: AgXToneMapping }}
        onPointerMissed={(e) => {
          if (
            store.getState().quiz.status === 'off' &&
            (!('button' in e) || e.button === 0)
          ) {
            dispatch(selectionCleared());
          }
        }}
        onCreated={({ raycaster }) => {
          Object.assign(raycaster, { firstHitOnly: true });
        }}
      >
        <Provider store={store}>
          <MeshRegistryProvider registry={registry}>
            <CameraApiProvider controller={cameraController ?? undefined}>
              <Lights />

              <CameraRig />

              <SceneStateApplier />

              <Picking
                onContextRequest={onContextRequest ?? noopContextRequest}
              >
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

              <Effects />

              <SectionController />

              {hasMotion ? (
                <Suspense fallback={null}>
                  <MotionPlayer />
                </Suspense>
              ) : null}

              {hasPins ? (
                <Suspense fallback={null}>
                  <PinProbe />
                </Suspense>
              ) : null}

              {debug && onDebugSample ? (
                <DebugStatsProbe onSample={onDebugSample} />
              ) : null}
            </CameraApiProvider>
          </MeshRegistryProvider>
        </Provider>
      </Canvas>
    </div>
  );
}
