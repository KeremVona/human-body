import {
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
} from 'react';
import { Provider } from 'react-redux';
import { useAppDispatch, useAppSelector } from './app/hooks';
import { makeStore, type AppStore, type CameraRef } from './app/store';
import { installTestHooks } from './app/testHooks';
import { useShortcuts } from './app/useShortcuts';
import { bundleUrl, loadManifest } from './data/manifest';
import { bundleFailed, bundleReady } from './features/assets/assetsSlice';
import { preloadGltf } from './scene/gltfCache';
import { TopBar } from './features/about/TopBar';
import { applyHtmlLang } from './i18n/locale';
import { loadMessages, useT } from './i18n/t';
import { BundleScheduler } from './features/assets/BundleScheduler';
import { bootstrap } from './features/content/contentSlice';
import type { ContextMenuTarget } from './features/dissection/DissectionMenu';
import { ExitChips } from './features/dissection/ExitChips';
import { Toolbar } from './features/dissection/Toolbar';
import { FirstRunHint } from './features/onboarding/FirstRunHint';
import { QuizBanner } from './features/quiz/QuizBanner';
import { emptyPoolDismissed } from './features/quiz/quizSlice';
import { QuizSummary } from './features/quiz/QuizSummary';
import { startQuiz } from './features/quiz/thunks';
import { SearchBox } from './features/search/SearchBox';
import { HoverLabel } from './features/selection/HoverLabel';
import { SelectionAnnouncer } from './features/selection/SelectionAnnouncer';
import { selected } from './features/selection/selectionSlice';
import { SettingsMenu } from './features/settings/SettingsMenu';
import { LeftPanel } from './features/tree/LeftPanel';
import type { CanvasBundle } from './scene/AtlasCanvas';
import {
  CameraApiContext,
  CameraApiProvider,
  createCameraController,
} from './scene/camera';

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
const ShareNotice = lazy(() =>
  import('./features/share/ShareNotice').then((m) => ({
    default: m.ShareNotice,
  })),
);
const PinLayer = lazy(() =>
  import('./features/pins/PinLayer').then((m) => ({
    default: m.PinLayer,
  })),
);
const PinEditor = lazy(() =>
  import('./features/pins/PinEditor').then((m) => ({
    default: m.PinEditor,
  })),
);
const SharePopover = lazy(() =>
  import('./features/share/SharePopover').then((m) => ({
    default: m.SharePopover,
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
  const tr = useT();
  const locale = useAppSelector((s) => s.ui.locale);
  const cameraController = useContext(CameraApiContext);
  const boot = useAppSelector((s) => s.assets.boot);
  const manifest = useAppSelector((s) => s.assets.manifest);
  const bundles = useAppSelector((s) => s.assets.bundles);
  const hasSelection = useAppSelector(
    (s) => s.selection.selectedIds.length > 0,
  );
  const [meshCount, setMeshCount] = useState(0);
  const [debugStats, setDebugStats] = useState<RenderStats | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareLoaded, setShareLoaded] = useState(false);
  const emptyPoolAlert = useAppSelector((s) => s.quiz.emptyPoolAlert);
  const shareNotice = useAppSelector((s) => s.share.notice);
  const pinsStorageFailed = useAppSelector((s) => s.pins.storageFailed);
  const pinsStorageNoticeShown = useAppSelector(
    (s) => s.pins.storageNoticeShown,
  );
  const hasPins = useAppSelector((s) => s.pins.items.length > 0);
  const editingPinId = useAppSelector((s) => s.pins.editingId);
  const systems = useAppSelector((s) => s.systems);
  const quizActive = useAppSelector((s) => s.quiz.status !== 'off');
  const bootShareStartedRef = useRef(false);
  const pinsHydratedRef = useRef(false);
  const shareButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (pinsHydratedRef.current || boot !== 'ready') return;
    pinsHydratedRef.current = true;
    try {
      const raw = localStorage.getItem('atlas.pins.v1');
      if (raw && raw.length > 2) {
        void Promise.all([
          import('./features/pins/storage'),
          import('./features/pins/pinsSlice'),
        ]).then(([{ loadPins }, { pinsHydrated }]) => {
          store.dispatch(pinsHydrated(loadPins()));
        });
      }
    } catch {
      // Ignore unavailable storage during boot
    }
  }, [boot, store]);

  useEffect(() => {
    if (bootShareStartedRef.current) return;
    if (boot !== 'ready' || bundles.skeletal !== 'ready') return;
    if (
      typeof window === 'undefined' ||
      !/^#v\d+\./.test(window.location.hash)
    ) {
      return;
    }
    bootShareStartedRef.current = true;
    void import('./features/share/bootShare')
      .then(({ bootShare }) => bootShare(store))
      .catch(() => {});
  }, [boot, bundles.skeletal, store]);

  useEffect(() => {
    if (emptyPoolAlert) {
      dispatch(emptyPoolDismissed());
    }
    // Clear alert automatically when system toggles, opacities, or bundle readiness change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [systems, bundles, dispatch]);
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
        setContextMenu({
          x: req.x,
          y: req.y,
          meshIds: [req.meshId],
          point: req.point ?? null,
        });
      } else {
        setContextMenu({ x: req.x, y: req.y, meshIds: [], point: null });
      }
    },
    [dispatch],
  );

  const debug = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).has('debug');
  }, []);

  useEffect(() => {
    applyHtmlLang(locale);
    void loadMessages(locale);
  }, [locale]);

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
      aria-label={tr('app.viewerAria')}
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
        <div className="fixed inset-x-0 top-16 z-20 flex justify-center px-4">
          <p
            role="alert"
            className="rounded-lg bg-red-950/90 px-4 py-2 text-sm text-red-100 shadow-lg ring-1 ring-red-500/40 backdrop-blur"
          >
            {tr('app.bootError')}
          </p>
        </div>
      ) : null}

      {failedBundles.length > 0 ? (
        <div className="pointer-events-none fixed inset-x-0 top-16 z-20 flex flex-col items-center gap-2">
          {failedBundles.map((bundleId) => (
            <p
              key={bundleId}
              role="alert"
              className="rounded-lg bg-red-950/90 px-4 py-2 text-sm text-red-100 shadow-lg ring-1 ring-red-500/40 backdrop-blur"
            >
              {tr('app.bundleError', { bundle: bundleId })}
            </p>
          ))}
        </div>
      ) : null}

      <TopBar
        searchSlot={boot === 'ready' && !quizActive ? <SearchBox /> : null}
        rightSlot={
          <>
            {boot === 'ready' && !quizActive ? (
              <>
                <button
                  ref={shareButtonRef}
                  type="button"
                  aria-expanded={shareOpen}
                  aria-haspopup="dialog"
                  onClick={() => {
                    setShareLoaded(true);
                    setShareOpen((prev) => !prev);
                  }}
                  className="rounded-lg px-2 py-1 text-xs font-medium text-slate-100 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                >
                  {tr('topbar.shareView')}
                </button>
                <button
                  type="button"
                  onClick={() => dispatch(startQuiz())}
                  className="rounded-lg px-2 py-1 text-xs font-medium text-slate-100 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                >
                  {tr('topbar.startQuiz')}
                </button>
              </>
            ) : null}
            {shareLoaded ? (
              <Suspense fallback={null}>
                <SharePopover
                  open={shareOpen}
                  onOpenChange={setShareOpen}
                  triggerRef={shareButtonRef}
                />
              </Suspense>
            ) : null}
            <SettingsMenu />
          </>
        }
      />
      {emptyPoolAlert ? (
        <div className="pointer-events-none fixed inset-x-0 top-16 z-20 flex justify-center px-4">
          <div
            role="alert"
            className="pointer-events-auto flex items-center gap-2 rounded-lg bg-amber-950/90 px-4 py-2 text-xs text-amber-100 shadow-lg ring-1 ring-amber-400/40 backdrop-blur"
          >
            <span>{tr('app.emptyPoolAlert')}</span>
            <button
              type="button"
              aria-label={tr('app.dismissAlert')}
              onClick={() => dispatch(emptyPoolDismissed())}
              className="rounded px-1.5 py-0.5 text-amber-200 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-sky-400"
            >
              {tr('app.dismiss')}
            </button>
          </div>
        </div>
      ) : null}
      {debug ? <DebugStats stats={debugStats} meshCount={meshCount} /> : null}
      {boot === 'ready' ? (
        <>
          {shareNotice || (pinsStorageFailed && !pinsStorageNoticeShown) ? (
            <div className="pointer-events-none fixed inset-x-0 top-16 z-30 flex flex-col items-center gap-2 px-4">
              {shareNotice ? (
                <Suspense fallback={null}>
                  <ShareNotice />
                </Suspense>
              ) : null}
              {pinsStorageFailed && !pinsStorageNoticeShown ? (
                <div
                  role="status"
                  className="pointer-events-auto flex items-center gap-2 rounded-lg bg-amber-950/90 px-4 py-2 text-xs text-amber-100 shadow-lg ring-1 ring-amber-400/40 backdrop-blur"
                >
                  <span>{tr('app.pinsStorageError')}</span>
                  <button
                    type="button"
                    aria-label={tr('app.dismissStorageNotice')}
                    onClick={() => {
                      void import('./features/pins/pinsSlice').then(
                        ({ storageNoticeShown }) =>
                          dispatch(storageNoticeShown()),
                      );
                    }}
                    className="rounded px-1.5 py-0.5 text-amber-200 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-sky-400"
                  >
                    {tr('app.dismiss')}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
          <QuizBanner />
          <QuizSummary />
          {hasPins ? (
            <Suspense fallback={null}>
              <PinLayer />
            </Suspense>
          ) : null}
          {!quizActive && editingPinId ? (
            <Suspense fallback={null}>
              <PinEditor />
            </Suspense>
          ) : null}
          <LeftPanel />
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
  const [cameraRef] = useState<CameraRef>(() => ({ current: null }));
  const [cameraController] = useState(() => createCameraController(cameraRef));
  const [registry] = useState(() => createMeshRegistry());
  const [defaultStore] = useState(
    () => store ?? makeStore(undefined, { camera: cameraRef, registry }),
  );

  return (
    <Provider store={defaultStore}>
      <MeshRegistryProvider registry={registry}>
        <CameraApiProvider controller={cameraController}>
          <BundleScheduler />
          <AtlasShell registry={registry} store={defaultStore} />
        </CameraApiProvider>
      </MeshRegistryProvider>
    </Provider>
  );
}
