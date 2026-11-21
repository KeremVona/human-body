import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
} from 'react';
import { installTestHooks } from './app/testHooks';
import { bundleUrl, loadManifest } from './data/manifest';
import { AtlasCanvas, type CanvasBundle } from './scene/AtlasCanvas';
import { DebugStats, type RenderStats } from './scene/DebugStats';
import { createMeshRegistry, MeshRegistryProvider } from './scene/meshRegistry';

export default function App(): JSX.Element {
  const [registry] = useState(() => createMeshRegistry());
  const [bundles, setBundles] = useState<CanvasBundle[]>([]);
  const [failedBundles, setFailedBundles] = useState<string[]>([]);
  const [meshCount, setMeshCount] = useState(0);
  const [debugStats, setDebugStats] = useState<RenderStats | null>(null);
  const readyRef = useRef(false);

  const debug = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).has('debug');
  }, []);

  useEffect(() => {
    installTestHooks({
      registry,
      isReady: () => readyRef.current,
    });
  }, [registry]);

  useEffect(() => {
    let cancelled = false;
    loadManifest()
      .then((manifest) => {
        if (cancelled) return;
        const skeletal = manifest.bundles.find((b) => b.id === 'skeletal');
        if (!skeletal) {
          setFailedBundles((prev) =>
            prev.includes('skeletal') ? prev : [...prev, 'skeletal'],
          );
          return;
        }
        setBundles([{ id: skeletal.id, url: bundleUrl(skeletal.file) }]);
      })
      .catch(() => {
        if (cancelled) return;
        setFailedBundles((prev) =>
          prev.includes('skeletal') ? prev : [...prev, 'skeletal'],
        );
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleBundleReady = useCallback(
    (bundleId: string) => {
      if (bundleId === 'skeletal') {
        readyRef.current = true;
      }
      setMeshCount(registry.size);
    },
    [registry],
  );

  const handleBundleError = useCallback((bundleId: string) => {
    setFailedBundles((prev) =>
      prev.includes(bundleId) ? prev : [...prev, bundleId],
    );
  }, []);

  return (
    <MeshRegistryProvider registry={registry}>
      <main
        aria-label="Anatomy viewer"
        className="relative h-dvh w-full overflow-hidden bg-[radial-gradient(ellipse_at_center,#2a3038_0%,#14171c_100%)]"
      >
        <AtlasCanvas
          debug={debug}
          bundles={bundles}
          onBundleReady={handleBundleReady}
          onBundleError={handleBundleError}
          onDebugSample={debug ? setDebugStats : undefined}
        />

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
      </main>
    </MeshRegistryProvider>
  );
}
