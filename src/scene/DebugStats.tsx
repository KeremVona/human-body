import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';

/** Sampled WebGL renderer performance snapshot. */
export type RenderStats = {
  fps: number;
  calls: number;
  triangles: number;
};

/** Canvas-internal probe sampling FPS and `gl.info.render` counts every 500 ms. */
export function DebugStatsProbe({
  onSample,
}: {
  onSample: (stats: RenderStats) => void;
}) {
  const framesRef = useRef(0);
  const lastSampleRef = useRef<number | null>(null);

  useFrame(({ gl }) => {
    const now = performance.now();
    if (lastSampleRef.current === null) {
      lastSampleRef.current = now;
    }
    framesRef.current += 1;

    const elapsed = now - lastSampleRef.current;
    if (elapsed >= 500) {
      const fps = Math.round((framesRef.current * 1000) / elapsed);
      onSample({
        fps,
        calls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
      });
      framesRef.current = 0;
      lastSampleRef.current = now;
    }
  });

  return null;
}

function formatTriangles(triangles: number): string {
  if (triangles >= 1_000_000) {
    return `${(triangles / 1_000_000).toFixed(1)}M`;
  }
  if (triangles >= 1_000) {
    return `${(triangles / 1_000).toFixed(1)}K`;
  }
  return String(triangles);
}

/** DOM overlay displaying FPS, draw calls, triangles, and registered mesh count when `?debug` is set. */
export function DebugStats({
  stats,
  meshCount,
}: {
  stats: RenderStats | null;
  meshCount: number;
}) {
  if (!stats) return null;
  return (
    <aside
      aria-label="Renderer statistics"
      aria-live="off"
      className="pointer-events-none fixed top-14 left-1/2 z-20 -translate-x-1/2 rounded-md bg-slate-950/80 px-3 py-1.5 font-mono text-xs text-slate-200 ring-1 ring-white/10 backdrop-blur"
    >
      fps {stats.fps} · draw calls {stats.calls} · triangles{' '}
      {formatTriangles(stats.triangles)} · meshes {meshCount}
    </aside>
  );
}
