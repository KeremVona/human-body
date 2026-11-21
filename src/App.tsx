import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import { Provider, useStore } from 'react-redux';
import { useAppDispatch, useAppSelector } from './app/hooks';
import { makeStore, type AppStore, type RootState } from './app/store';
import { installTestHooks } from './app/testHooks';
import { bundleUrl } from './data/manifest';
import { bundleFailed, bundleReady } from './features/assets/assetsSlice';
import { BundleScheduler } from './features/assets/BundleScheduler';
import { bootstrap } from './features/content/contentSlice';
import { HoverLabel } from './features/selection/HoverLabel';
import { SystemsPanel } from './features/systems/SystemsPanel';
import { AtlasCanvas, type CanvasBundle } from './scene/AtlasCanvas';
import { CameraApiProvider } from './scene/camera';
import { DebugStats, type RenderStats } from './scene/DebugStats';
import {
  createMeshRegistry,
  MeshRegistryProvider,
  type MeshRegistry,
} from './scene/meshRegistry';

function AtlasShell({ registry }: { registry: MeshRegistry }): JSX.Element {
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();
  const boot = useAppSelector((s) => s.assets.boot);
  const manifest = useAppSelector((s) => s.assets.manifest);
  const bundles = useAppSelector((s) => s.assets.bundles);
  const [meshCount, setMeshCount] = useState(0);
  const [debugStats, setDebugStats] = useState<RenderStats | null>(null);

  const debug = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).has('debug');
  }, []);

  useEffect(() => {
    installTestHooks({
      registry,
      isReady: () => store.getState().assets.bundles.skeletal === 'ready',
    });
  }, [registry, store]);

  useEffect(() => {
    void dispatch(bootstrap());
  }, [dispatch]);

  const canvasBundles: CanvasBundle[] = useMemo(() => {
    if (!manifest) return [];
    return manifest.bundles
      .filter((b) => bundles[b.id] && bundles[b.id] !== 'idle')
      .map((b) => ({ id: b.id, url: bundleUrl(b.file) }));
  }, [manifest, bundles]);

  const failedBundles = useMemo(
    () =>
      Object.entries(bundles)
        .filter(([, status]) => status === 'error')
        .map(([id]) => id),
    [bundles],
  );

  const handleBundleReady = useCallback(
    (bundleId: string) => {
      setMeshCount(registry.size);
      dispatch(bundleReady(bundleId));
    },
    [dispatch, registry],
  );

  const handleBundleError = useCallback(
    (bundleId: string) => {
      dispatch(bundleFailed(bundleId));
    },
    [dispatch],
  );

  return (
    <main
      aria-label="Anatomy viewer"
      className="relative h-dvh w-full overflow-hidden bg-[radial-gradient(ellipse_at_center,#2a3038_0%,#14171c_100%)]"
    >
      {boot === 'ready' ? (
        <AtlasCanvas
          debug={debug}
          bundles={canvasBundles}
          onBundleReady={handleBundleReady}
          onBundleError={handleBundleError}
          onDebugSample={debug ? setDebugStats : undefined}
        />
      ) : null}

      {boot === 'idle' || boot === 'loading' ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <div className="h-24 w-24 animate-pulse rounded-full bg-slate-700/30 motion-reduce:animate-none" />
        </div>
      ) : null}

      {boot === 'error' ? (
        <div className="fixed inset-x-0 top-4 z-20 flex justify-center px-4">
          <p
            role="alert"
            className="rounded-lg bg-red-950/90 px-4 py-2 text-sm text-red-100 shadow-lg ring-1 ring-red-500/40 backdrop-blur"
          >
            Couldn&apos;t start the atlas. Please reload.
          </p>
        </div>
      ) : null}

      {failedBundles.length > 0 ? (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-20 flex flex-col items-center gap-2">
          {failedBundles.map((bundleId) => (
            <p
              key={bundleId}
              role="alert"
              className="rounded-lg bg-red-950/90 px-4 py-2 text-sm text-red-100 shadow-lg ring-1 ring-red-500/40 backdrop-blur"
            >
              Couldn&apos;t load the {bundleId} model.
            </p>
          ))}
        </div>
      ) : null}

      {debug ? <DebugStats stats={debugStats} meshCount={meshCount} /> : null}
      {boot === 'ready' ? <SystemsPanel /> : null}
      <HoverLabel />
    </main>
  );
}

export default function App({ store }: { store?: AppStore } = {}): JSX.Element {
  const [defaultStore] = useState(() => store ?? makeStore());
  const [registry] = useState(() => createMeshRegistry());

  return (
    <Provider store={defaultStore}>
      <MeshRegistryProvider registry={registry}>
        <CameraApiProvider>
          <BundleScheduler />
          <AtlasShell registry={registry} />
        </CameraApiProvider>
      </MeshRegistryProvider>
    </Provider>
  );
}
