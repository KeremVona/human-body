import {
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type JSX,
} from 'react';
import { Provider } from 'react-redux';
import { useAppDispatch, useAppSelector } from './app/hooks';
import { makeStore, type AppStore } from './app/store';
import { installTestHooks } from './app/testHooks';
import { useShortcuts } from './app/useShortcuts';
import { bundleUrl, loadManifest } from './data/manifest';
import { bundleFailed, bundleReady } from './features/assets/assetsSlice';
import { preloadGltf } from './scene/gltfCache';
import { BundleScheduler } from './features/assets/BundleScheduler';
import { bootstrap } from './features/content/contentSlice';
import type { ContextMenuTarget } from './features/dissection/DissectionMenu';
import { ExitChips } from './features/dissection/ExitChips';
import { Toolbar } from './features/dissection/Toolbar';
import { FirstRunHint } from './features/onboarding/FirstRunHint';
import { HoverLabel } from './features/selection/HoverLabel';
import { SelectionAnnouncer } from './features/selection/SelectionAnnouncer';
import { selected } from './features/selection/selectionSlice';
import { SystemsPanel } from './features/systems/SystemsPanel';
import type { CanvasBundle } from './scene/AtlasCanvas';
import { CameraApiContext, CameraApiProvider } from './scene/camera';

const loadAtlasCanvas = () =>
  import('./scene/AtlasCanvas').then((m) => ({ default: m.AtlasCanvas }));
const AtlasCanvas = lazy(loadAtlasCanvas);
const loadInspector = () =>
  import('./features/inspector/Inspector').then((m) => ({
    default: m.Inspector,
  }));
const Inspector = lazy(loadInspector);
const DissectionMenu = lazy(() =>
  import('./features/dissection/DissectionMenu').then((m) => ({
    default: m.DissectionMenu,
  })),
);
import { DebugStats, type RenderStats } from './scene/DebugStats';
import {
  createMeshRegistry,
  MeshRegistryProvider,
  type MeshRegistry,
} from './scene/meshRegistry';
import type { ContextRequest } from './scene/Picking';

function AtlasShell({
  registry,
  store,
}: {
  registry: MeshRegistry;
  store: AppStore;
}): JSX.Element {
  const dispatch = useAppDispatch();
  const cameraController = useContext(CameraApiContext);
  const boot = useAppSelector((s) => s.assets.boot);
  const manifest = useAppSelector((s) => s.assets.manifest);
  const bundles = useAppSelector((s) => s.assets.bundles);
  const hasSelection = useAppSelector(
    (s) => s.selection.selectedIds.length > 0,
  );
  const [meshCount, setMeshCount] = useState(0);
  const [debugStats, setDebugStats] = useState<RenderStats | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuTarget | null>(
    null,
  );

  const openKeyboardContextMenu = useCallback(() => {
    const selectedIds = store.getState().selection.selectedIds;
    setContextMenu({
      x: typeof window !== 'undefined' ? window.innerWidth / 2 : 0,
      y: typeof window !== 'undefined' ? window.innerHeight / 2 : 0,
      meshIds: [...selectedIds],
    });
  }, [store]);

  useShortcuts(openKeyboardContextMenu);

  const handleContextRequest = useCallback(
    (req: ContextRequest) => {
      if (req.meshId) {
        dispatch(selected([req.meshId]));
        setContextMenu({ x: req.x, y: req.y, meshIds: [req.meshId] });
      } else {
        setContextMenu({ x: req.x, y: req.y, meshIds: [] });
      }
    },
    [dispatch],
  );

  const debug = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).has('debug');
  }, []);

  useEffect(() => {
    installTestHooks({
      registry,
      store,
      camera: cameraController,
      isReady: () => store.getState().assets.bundles.skeletal === 'ready',
    });
  }, [registry, store, cameraController]);

  useEffect(() => {
    void loadAtlasCanvas();
    void dispatch(bootstrap());
    void loadManifest()
      .then((m) => {
        const skeletal = m.bundles.find((b) => b.id === 'skeletal');
        if (skeletal) {
          preloadGltf(bundleUrl(skeletal.file));
        }
      })
      .catch(() => {});
  }, [dispatch]);

  useEffect(() => {
    if (!debug) return;
    return registry.subscribe(() => {
      setMeshCount(registry.size);
    });
  }, [debug, registry]);

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
      if (bundleId === 'skeletal') {
        void loadInspector();
      }
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
        <Suspense fallback={null}>
          <AtlasCanvas
            debug={debug}
            bundles={canvasBundles}
            onBundleReady={handleBundleReady}
            onBundleError={handleBundleError}
            onDebugSample={debug ? setDebugStats : undefined}
            onContextRequest={handleContextRequest}
          />
        </Suspense>
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
      {boot === 'ready' ? (
        <>
          <SystemsPanel />
          {hasSelection ? (
            <Suspense fallback={null}>
              <Inspector />
            </Suspense>
          ) : null}
          <div className="pointer-events-none fixed bottom-16 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2">
            <FirstRunHint />
            <ExitChips />
          </div>
          <Toolbar />
          {contextMenu ? (
            <Suspense fallback={null}>
              <DissectionMenu
                target={contextMenu}
                onClose={() => setContextMenu(null)}
              />
            </Suspense>
          ) : null}
        </>
      ) : null}
      <HoverLabel />
      <SelectionAnnouncer />
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
          <AtlasShell registry={registry} store={defaultStore} />
        </CameraApiProvider>
      </MeshRegistryProvider>
    </Provider>
  );
}
